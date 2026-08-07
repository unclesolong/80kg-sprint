import type { ValidationResult } from './contracts'

type StructuredKind = 'plan' | 'weekly_review' | 'food_parse'

interface StructuredCallOptions<T> {
  apiKey: string
  model: string
  kind: StructuredKind
  schemaName: string
  schema: Record<string, unknown>
  input: unknown
  instructions: string
  reasoningEffort: 'low' | 'medium'
  maxOutputTokens: number
  timeoutMs: number
  fetcher: typeof fetch
  validate: (value: unknown) => ValidationResult<T>
  validateDomain: (value: T) => string[]
}

export type StructuredCallResult<T> =
  | { ok: true; value: T; attempts: number }
  | {
      ok: false
      attempts: number
      reason: 'timeout' | 'refusal' | 'upstream' | 'malformed' | 'schema' | 'domain'
      issues: string[]
    }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const extractOutputText = (payload: unknown): { text?: string; refused: boolean } => {
  if (!isRecord(payload)) return { refused: false }
  if (typeof payload.output_text === 'string') return { text: payload.output_text, refused: false }
  if (!Array.isArray(payload.output)) return { refused: false }

  const textParts: string[] = []
  let refused = false
  for (const item of payload.output) {
    if (!isRecord(item) || !Array.isArray(item.content)) continue
    for (const content of item.content) {
      if (!isRecord(content)) continue
      if (content.type === 'refusal') refused = true
      if (content.type === 'output_text' && typeof content.text === 'string') textParts.push(content.text)
    }
  }
  return { text: textParts.length > 0 ? textParts.join('') : undefined, refused }
}

const safeIssues = (issues: string[]) =>
  [...new Set(issues)]
    .filter((issue) => /^[a-zA-Z0-9_.\[\]-]+$/.test(issue))
    .slice(0, 12)

const makeInstructions = (base: string, feedback: string[]) => {
  if (feedback.length === 0) return base
  return `${base}\nThe previous output was rejected by deterministic validation. Correct these issue codes: ${feedback.join(', ')}. Return a completely new JSON object within the supplied schema and safety bounds.`
}

const singleCall = async <T>(
  options: StructuredCallOptions<T>,
  feedback: string[],
): Promise<StructuredCallResult<T>> => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs)
  try {
    const response = await options.fetcher('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model,
        instructions: makeInstructions(options.instructions, feedback),
        input: [
          {
            role: 'user',
            content: [{ type: 'input_text', text: JSON.stringify(options.input) }],
          },
        ],
        reasoning: { effort: options.reasoningEffort },
        text: {
          format: {
            type: 'json_schema',
            name: options.schemaName,
            strict: true,
            schema: options.schema,
          },
        },
        max_output_tokens: options.maxOutputTokens,
        store: false,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      return { ok: false, attempts: 1, reason: 'upstream', issues: [`upstream_http_${response.status}`] }
    }
    const raw = await response.text()
    if (raw.length > 160_000) {
      return { ok: false, attempts: 1, reason: 'malformed', issues: ['response_too_large'] }
    }
    let payload: unknown
    try {
      payload = JSON.parse(raw)
    } catch {
      return { ok: false, attempts: 1, reason: 'malformed', issues: ['response_envelope_malformed'] }
    }
    const extracted = extractOutputText(payload)
    if (extracted.refused) return { ok: false, attempts: 1, reason: 'refusal', issues: ['model_refusal'] }
    if (!extracted.text) {
      return { ok: false, attempts: 1, reason: 'malformed', issues: ['output_text_missing'] }
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(extracted.text)
    } catch {
      return { ok: false, attempts: 1, reason: 'malformed', issues: ['structured_json_malformed'] }
    }
    const validated = options.validate(parsed)
    if (!validated.ok) {
      return { ok: false, attempts: 1, reason: 'schema', issues: safeIssues(validated.issues) }
    }
    const domainIssues = safeIssues(options.validateDomain(validated.value))
    if (domainIssues.length > 0) {
      return { ok: false, attempts: 1, reason: 'domain', issues: domainIssues }
    }
    return { ok: true, value: validated.value, attempts: 1 }
  } catch (error) {
    const timedOut = controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')
    return {
      ok: false,
      attempts: 1,
      reason: timedOut ? 'timeout' : 'upstream',
      issues: [timedOut ? 'upstream_timeout' : 'upstream_unavailable'],
    }
  } finally {
    clearTimeout(timeout)
  }
}

export const requestStructuredWithRetry = async <T>(
  options: StructuredCallOptions<T>,
): Promise<StructuredCallResult<T>> => {
  let feedback: string[] = []
  let lastFailure: Exclude<StructuredCallResult<T>, { ok: true }> | undefined
  const perAttemptTimeout = Math.max(1_000, Math.floor(options.timeoutMs / 2))
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const result = await singleCall({ ...options, timeoutMs: perAttemptTimeout }, feedback)
    if (result.ok) return { ...result, attempts: attempt }
    lastFailure = result
    feedback = safeIssues(result.issues)
  }
  return {
    ok: false,
    attempts: 2,
    reason: lastFailure?.reason ?? 'upstream',
    issues: lastFailure?.issues ?? ['upstream_unavailable'],
  }
}
