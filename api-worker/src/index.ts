import type {
  Env,
  FoodParseOutput,
  PlanAIOutput,
  WeeklyReviewAIOutput,
  WorkerDependencies,
} from './contracts'
import { AI_UNAVAILABLE_MESSAGE, buildFoodParseFallback, buildPlanFallback, buildWeeklyFallback } from './fallbacks'
import { FoodSearchService } from './foodSearch'
import { requestStructuredWithRetry } from './openaiClient'
import { MemoryRateLimiter, RATE_LIMITS, requestFingerprint } from './rateLimit'
import {
  validatePlanAIOutputSafety,
  validatePlanRequestSafety,
  validateWeeklyAIOutputSafety,
  validateWeeklyRequestSafety,
} from './safetyValidation'
import { structuredOutputDefinitions } from './schemas'
import {
  validateFoodParseOutput,
  validateFoodParseRequest,
  validateFoodSearchRequest,
  validatePlanAIOutput,
  validatePlanGenerateRequest,
  validateWeeklyReviewAIOutput,
  validateWeeklyReviewRequest,
} from './validators'

const DEFAULT_PRODUCTION_ORIGIN = 'https://unclesolong.github.io'
const BODY_LIMITS: Record<string, number> = {
  '/v1/plan/generate': 24 * 1_024,
  '/v1/review/weekly': 16 * 1_024,
  '/v1/food/parse': 4 * 1_024,
  '/v1/food/search': 2 * 1_024,
}
const CONSENT_REQUIRED_PATHS = new Set(Object.keys(BODY_LIMITS))

const PLAN_INSTRUCTIONS = `You create a concise draft for a non-medical fat-loss planning app. Deterministic safety bounds in the input are absolute and cannot be widened. Never diagnose, recommend dehydration, purging, laxatives, diuretics, forced exercise, pain-through exercise, or targets outside the supplied bounds. The output only prefills a draft and is never a health record. Use Traditional Chinese for user-facing text. Return only the strict structured output.`

const WEEKLY_INSTRUCTIONS = `You review an aggregate week for a non-medical fat-loss planning app. Use only the supplied aggregate; do not invent daily facts. Deterministic safety bounds are absolute. Incomplete data requires improve_data_first with zero adjustments. Pain level 3 or above requires recovery priority and no activity increase or calorie decrease. Use Traditional Chinese and return only the strict structured output.`

const FOOD_PARSE_INSTRUCTIONS = `Split the user's food text into normalized food names and amounts for later database lookup. Do not estimate or output calories, protein, nutrients, health claims, or food database candidates. Mark raw-versus-cooked ambiguity for confirmation. Use Traditional Chinese and return only the strict structured output.`

type JsonBodyResult = { ok: true; value: unknown } | { ok: false; status: number; code: string; message: string }

interface WorkerRuntimeDependencies extends WorkerDependencies {
  limiter: MemoryRateLimiter
  foodSearch: FoodSearchService
}

const normalizePath = (pathname: string) => pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname

const parseAllowedOrigins = (env: Env) => {
  const configured = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .flatMap((origin) => {
      try {
        return [new URL(origin).origin]
      } catch {
        return []
      }
    })
  return new Set([DEFAULT_PRODUCTION_ORIGIN, ...configured])
}

export const isOriginAllowed = (origin: string | null, env: Env) => {
  if (!origin) return true
  if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/.test(origin)) return true
  return parseAllowedOrigins(env).has(origin)
}

const corsHeaders = (origin: string | null, env: Env) => {
  const headers = new Headers({
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Origin',
  })
  if (origin && isOriginAllowed(origin, env)) headers.set('Access-Control-Allow-Origin', origin)
  return headers
}

const jsonResponse = (body: unknown, status: number, request: Request, env: Env, extra?: HeadersInit) => {
  const headers = corsHeaders(request.headers.get('Origin'), env)
  if (extra) new Headers(extra).forEach((value, key) => headers.set(key, value))
  return new Response(JSON.stringify(body), { status, headers })
}

const success = (
  data: unknown,
  requestId: string,
  request: Request,
  env: Env,
  meta: Record<string, unknown> = {},
) => jsonResponse({ ok: true, data, meta: { requestId, ...meta } }, 200, request, env)

const failure = (
  status: number,
  code: string,
  message: string,
  requestId: string,
  request: Request,
  env: Env,
  retryable = false,
  fields?: string[],
  extraHeaders?: HeadersInit,
) =>
  jsonResponse(
    {
      ok: false,
      error: {
        code,
        message,
        retryable,
        ...(fields && fields.length > 0 ? { fields: fields.slice(0, 12) } : {}),
      },
      requestId,
    },
    status,
    request,
    env,
    extraHeaders,
  )

const readJsonBody = async (request: Request, limit: number): Promise<JsonBodyResult> => {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') ?? '')) {
    return { ok: false, status: 415, code: 'UNSUPPORTED_MEDIA_TYPE', message: '請使用 application/json。' }
  }
  const declaredLength = Number(request.headers.get('Content-Length') ?? 0)
  if (Number.isFinite(declaredLength) && declaredLength > limit) {
    return { ok: false, status: 413, code: 'BODY_TOO_LARGE', message: '請求內容過大。' }
  }
  try {
    const bytes = await request.arrayBuffer()
    if (bytes.byteLength > limit) {
      return { ok: false, status: 413, code: 'BODY_TOO_LARGE', message: '請求內容過大。' }
    }
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return { ok: true, value: JSON.parse(text) }
  } catch {
    return { ok: false, status: 400, code: 'INVALID_JSON', message: '無法讀取這份 JSON 請求。' }
  }
}

const timeoutFromEnv = (env: Env) => {
  const parsed = Number(env.OPENAI_TIMEOUT_MS)
  return Number.isFinite(parsed) ? Math.min(20_000, Math.max(2_000, parsed)) : 12_000
}

const hasConsent = (request: Request) => request.headers.get('X-AI-Consent') === 'granted'

const configuredModel = (value: string | undefined) => {
  const model = value?.trim()
  return model && model.length <= 100 ? model : undefined
}

const planEndpoint = async (
  body: unknown,
  requestId: string,
  request: Request,
  env: Env,
  deps: WorkerRuntimeDependencies,
) => {
  const parsed = validatePlanGenerateRequest(body)
  if (!parsed.ok) {
    return failure(400, 'INVALID_REQUEST', '請求欄位不完整或格式不正確。', requestId, request, env, false, parsed.issues)
  }
  const safetyIssues = validatePlanRequestSafety(parsed.value)
  if (safetyIssues.length > 0) {
    return failure(422, 'SAFETY_RESTRICTED', '目前條件不適合由 AI 產生減脂數字。', requestId, request, env, false, safetyIssues)
  }
  const fallback = buildPlanFallback(parsed.value)
  const model = configuredModel(env.OPENAI_MODEL_PLANNER)
  if (!env.OPENAI_API_KEY || !model) {
    return success(fallback, requestId, request, env, { source: 'fallback', attempts: 0, warning: AI_UNAVAILABLE_MESSAGE })
  }
  const definition = structuredOutputDefinitions.plan
  const result = await requestStructuredWithRetry<PlanAIOutput>({
    apiKey: env.OPENAI_API_KEY,
    model,
    kind: 'plan',
    schemaName: definition.name,
    schema: definition.schema,
    input: parsed.value,
    instructions: PLAN_INSTRUCTIONS,
    reasoningEffort: 'medium',
    maxOutputTokens: 1_100,
    timeoutMs: timeoutFromEnv(env),
    fetcher: deps.fetch,
    validate: validatePlanAIOutput,
    validateDomain: (output) => validatePlanAIOutputSafety(output, parsed.value),
  })
  return result.ok
    ? success(result.value, requestId, request, env, { source: 'ai', attempts: result.attempts })
    : success(fallback, requestId, request, env, {
        source: 'fallback',
        attempts: result.attempts,
        warning: AI_UNAVAILABLE_MESSAGE,
      })
}

const weeklyEndpoint = async (
  body: unknown,
  requestId: string,
  request: Request,
  env: Env,
  deps: WorkerRuntimeDependencies,
) => {
  const parsed = validateWeeklyReviewRequest(body)
  if (!parsed.ok) {
    return failure(400, 'INVALID_REQUEST', '請求欄位不完整或格式不正確。', requestId, request, env, false, parsed.issues)
  }
  const safetyIssues = validateWeeklyRequestSafety(parsed.value)
  if (safetyIssues.length > 0) {
    return failure(422, 'SAFETY_RESTRICTED', '這份每週摘要不符合目前的安全邊界。', requestId, request, env, false, safetyIssues)
  }
  const fallback = buildWeeklyFallback(parsed.value)
  const model = configuredModel(env.OPENAI_MODEL_PLANNER)
  if (!env.OPENAI_API_KEY || !model) {
    return success(fallback, requestId, request, env, { source: 'fallback', attempts: 0, warning: AI_UNAVAILABLE_MESSAGE })
  }
  const definition = structuredOutputDefinitions.weekly_review
  const result = await requestStructuredWithRetry<WeeklyReviewAIOutput>({
    apiKey: env.OPENAI_API_KEY,
    model,
    kind: 'weekly_review',
    schemaName: definition.name,
    schema: definition.schema,
    input: parsed.value,
    instructions: WEEKLY_INSTRUCTIONS,
    reasoningEffort: 'medium',
    maxOutputTokens: 900,
    timeoutMs: timeoutFromEnv(env),
    fetcher: deps.fetch,
    validate: validateWeeklyReviewAIOutput,
    validateDomain: (output) => validateWeeklyAIOutputSafety(output, parsed.value),
  })
  return result.ok
    ? success(result.value, requestId, request, env, { source: 'ai', attempts: result.attempts })
    : success(fallback, requestId, request, env, {
        source: 'fallback',
        attempts: result.attempts,
        warning: AI_UNAVAILABLE_MESSAGE,
      })
}

const foodParseEndpoint = async (
  body: unknown,
  requestId: string,
  request: Request,
  env: Env,
  deps: WorkerRuntimeDependencies,
) => {
  const parsed = validateFoodParseRequest(body)
  if (!parsed.ok) {
    return failure(400, 'INVALID_REQUEST', '食物文字格式不正確。', requestId, request, env, false, parsed.issues)
  }
  const fallback = buildFoodParseFallback(parsed.value.text)
  const model = configuredModel(env.OPENAI_MODEL_PARSER)
  if (!env.OPENAI_API_KEY || !model) {
    return success(fallback, requestId, request, env, { source: 'fallback', attempts: 0, warning: AI_UNAVAILABLE_MESSAGE })
  }
  const definition = structuredOutputDefinitions.food_parse
  const result = await requestStructuredWithRetry<FoodParseOutput>({
    apiKey: env.OPENAI_API_KEY,
    model,
    kind: 'food_parse',
    schemaName: definition.name,
    schema: definition.schema,
    input: parsed.value,
    instructions: FOOD_PARSE_INSTRUCTIONS,
    reasoningEffort: 'low',
    maxOutputTokens: 900,
    timeoutMs: timeoutFromEnv(env),
    fetcher: deps.fetch,
    validate: validateFoodParseOutput,
    validateDomain: () => [],
  })
  return result.ok
    ? success(result.value, requestId, request, env, { source: 'ai', attempts: result.attempts })
    : success(fallback, requestId, request, env, {
        source: 'fallback',
        attempts: result.attempts,
        warning: AI_UNAVAILABLE_MESSAGE,
      })
}

const foodSearchEndpoint = async (
  body: unknown,
  requestId: string,
  request: Request,
  env: Env,
  deps: WorkerRuntimeDependencies,
) => {
  const parsed = validateFoodSearchRequest(body)
  if (!parsed.ok) {
    return failure(400, 'INVALID_REQUEST', '搜尋條件不正確。', requestId, request, env, false, parsed.issues)
  }
  const result = await deps.foodSearch.search(
    {
      text: parsed.value.query.trim(),
      barcode: parsed.value.barcode ?? undefined,
      limit: parsed.value.limit,
      locale: parsed.value.locale,
    },
    env,
  )
  return success(
    {
      candidates: result.candidates,
      providers: result.providers,
      manualEntryAvailable: true,
    },
    requestId,
    request,
    env,
    { source: 'providers', cache: result.cache },
  )
}

const routeRequest = async (request: Request, env: Env, deps: WorkerRuntimeDependencies) => {
  const requestId = deps.randomUUID()
  const url = new URL(request.url)
  const path = normalizePath(url.pathname)
  const origin = request.headers.get('Origin')

  if (!isOriginAllowed(origin, env)) {
    return failure(403, 'ORIGIN_NOT_ALLOWED', '這個網站來源未獲允許。', requestId, request, env)
  }
  if (request.method === 'OPTIONS') {
    const headers = corsHeaders(origin, env)
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    headers.set('Access-Control-Allow-Headers', 'Content-Type, X-AI-Consent, X-Device-Id')
    headers.set('Access-Control-Max-Age', '600')
    headers.delete('Content-Type')
    return new Response(null, { status: 204, headers })
  }
  if (path === '/v1/health') {
    if (request.method !== 'GET') {
      return failure(405, 'METHOD_NOT_ALLOWED', '不支援這個請求方法。', requestId, request, env)
    }
    return success(
      {
        service: '80kg-sprint-api-worker',
        version: 1,
        aiConfigured: Boolean(env.OPENAI_API_KEY && env.OPENAI_MODEL_PLANNER && env.OPENAI_MODEL_PARSER),
        providers: {
          local: true,
          blsConfigured: Boolean(env.BLS_API_BASE_URL),
          usdaConfigured: Boolean(env.USDA_API_KEY),
          openFoodFacts: true,
        },
        timestamp: new Date(deps.now()).toISOString(),
      },
      requestId,
      request,
      env,
      { source: 'worker' },
    )
  }

  const rateRule = RATE_LIMITS[path]
  const bodyLimit = BODY_LIMITS[path]
  if (!rateRule || !bodyLimit) {
    return failure(404, 'NOT_FOUND', '找不到這個 API 路徑。', requestId, request, env)
  }
  if (request.method !== 'POST') {
    return failure(405, 'METHOD_NOT_ALLOWED', '不支援這個請求方法。', requestId, request, env)
  }
  if (CONSENT_REQUIRED_PATHS.has(path) && !hasConsent(request)) {
    return failure(403, 'AI_CONSENT_REQUIRED', '請先明確同意後再傳送規劃或食物資料。', requestId, request, env)
  }
  const rate = deps.limiter.consume(`${path}:${requestFingerprint(request)}`, rateRule)
  if (!rate.allowed) {
    return failure(
      429,
      'RATE_LIMITED',
      '請求過於頻繁，請稍後再試。',
      requestId,
      request,
      env,
      true,
      undefined,
      { 'Retry-After': String(rate.retryAfterSeconds), 'X-RateLimit-Remaining': '0' },
    )
  }
  const body = await readJsonBody(request, bodyLimit)
  if (!body.ok) return failure(body.status, body.code, body.message, requestId, request, env)

  if (path === '/v1/plan/generate') return planEndpoint(body.value, requestId, request, env, deps)
  if (path === '/v1/review/weekly') return weeklyEndpoint(body.value, requestId, request, env, deps)
  if (path === '/v1/food/parse') return foodParseEndpoint(body.value, requestId, request, env, deps)
  return foodSearchEndpoint(body.value, requestId, request, env, deps)
}

export const createWorker = (
  overrides: Partial<WorkerDependencies> = {},
): { fetch(request: Request, env: Env): Promise<Response> } => {
  const deps: WorkerDependencies = {
    fetch: overrides.fetch ?? globalThis.fetch.bind(globalThis),
    now: overrides.now ?? Date.now,
    randomUUID: overrides.randomUUID ?? (() => crypto.randomUUID()),
  }
  const runtime: WorkerRuntimeDependencies = {
    ...deps,
    limiter: new MemoryRateLimiter(deps.now),
    foodSearch: new FoodSearchService(deps.fetch, deps.now),
  }
  return { fetch: (request, env) => routeRequest(request, env, runtime) }
}

export default createWorker()
