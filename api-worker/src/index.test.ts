import { describe, expect, it, vi } from 'vitest'
import { createWorker } from './index'
import { planOutput, planRequest } from './testFixtures'

const ORIGIN = 'https://unclesolong.github.io'
const ENV = {
  ALLOWED_ORIGINS: ORIGIN,
}

const post = (path: string, body: unknown, extraHeaders: Record<string, string> = {}) =>
  new Request(`https://worker.example${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
      'X-AI-Consent': 'granted',
      'X-Device-Id': 'test-device',
      'CF-Connecting-IP': '192.0.2.1',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  })

const parseResponse = async (response: Response) => ({
  status: response.status,
  headers: response.headers,
  body: await response.json() as Record<string, any>,
})

describe('worker routing, CORS, and error contracts', () => {
  it('serves a no-store health response without exposing configuration values', async () => {
    const worker = createWorker({ now: () => Date.parse('2026-08-07T12:00:00Z'), randomUUID: () => 'req-health' })
    const response = await worker.fetch(
      new Request('https://worker.example/v1/health', { headers: { Origin: ORIGIN } }),
      { ...ENV, OPENAI_API_KEY: 'not-exposed', OPENAI_MODEL_PLANNER: 'planner', OPENAI_MODEL_PARSER: 'parser' },
    )
    const result = await parseResponse(response)
    expect(result.status).toBe(200)
    expect(result.headers.get('Cache-Control')).toBe('no-store')
    expect(result.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN)
    expect(result.body.data).toMatchObject({ service: '80kg-sprint-api-worker', aiConfigured: true })
    expect(JSON.stringify(result.body)).not.toContain('not-exposed')
  })

  it('rejects an unapproved origin and missing AI consent', async () => {
    const worker = createWorker({ randomUUID: () => 'req-cors' })
    const denied = await worker.fetch(
      new Request('https://worker.example/v1/health', { headers: { Origin: 'https://evil.example' } }),
      ENV,
    )
    expect(denied.status).toBe(403)
    expect(denied.headers.get('Access-Control-Allow-Origin')).toBeNull()

    const noConsentRequest = post('/v1/plan/generate', planRequest)
    noConsentRequest.headers.delete('X-AI-Consent')
    const noConsent = await worker.fetch(noConsentRequest, ENV)
    expect(noConsent.status).toBe(403)
    expect((await noConsent.json() as any).error.code).toBe('AI_CONSENT_REQUIRED')
  })

  it('requires consent before disclosing a food search query to Worker providers', async () => {
    const fetcher = vi.fn()
    const worker = createWorker({ fetch: fetcher as typeof fetch, randomUUID: () => 'req-search-consent' })
    const request = post('/v1/food/search', { query: '雞胸', barcode: null, limit: 5, locale: 'zh-TW' })
    request.headers.delete('X-AI-Consent')
    const response = await worker.fetch(request, ENV)
    expect(response.status).toBe(403)
    expect((await response.json() as any).error.code).toBe('AI_CONSENT_REQUIRED')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('rejects unknown PII keys without echoing their value', async () => {
    const worker = createWorker({ randomUUID: () => 'req-private' })
    const response = await worker.fetch(
      post('/v1/plan/generate', { ...planRequest, email: 'private-person@example.test' }),
      ENV,
    )
    const text = await response.text()
    expect(response.status).toBe(400)
    expect(text).not.toContain('private-person')
    expect(text).toContain('INVALID_REQUEST')
  })

  it('enforces body size before JSON/domain processing', async () => {
    const worker = createWorker({ randomUUID: () => 'req-large' })
    const response = await worker.fetch(
      post('/v1/food/search', { query: 'x'.repeat(3_000), barcode: null, limit: 5, locale: 'zh-TW' }),
      ENV,
    )
    expect(response.status).toBe(413)
    expect((await response.json() as any).error.code).toBe('BODY_TOO_LARGE')
  })
})

describe('safe AI fallbacks', () => {
  it('returns the validated local plan when AI is not configured', async () => {
    const fetcher = vi.fn()
    const worker = createWorker({ fetch: fetcher as typeof fetch, randomUUID: () => 'req-plan' })
    const result = await parseResponse(await worker.fetch(post('/v1/plan/generate', planRequest), ENV))
    expect(result.status).toBe(200)
    expect(result.body.meta).toMatchObject({ source: 'fallback', attempts: 0 })
    expect(result.body.data.selectedTargets).toEqual(planRequest.localRecommendation.selectedTargets)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('retries an unsafe AI response once, then discards raw output and uses fallback', async () => {
    const unsafe = {
      ...planOutput,
      selectedTargets: { ...planOutput.selectedTargets, calorieTargetKcal: 900 },
      assumptions: [{ code: 'raw', text: 'provider-secret-raw-output' }],
    }
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          output: [{ content: [{ type: 'output_text', text: JSON.stringify(unsafe) }] }],
        }),
      ),
    )
    const worker = createWorker({ fetch: fetcher as typeof fetch, randomUUID: () => 'req-unsafe' })
    const response = await worker.fetch(post('/v1/plan/generate', planRequest), {
      ...ENV,
      OPENAI_API_KEY: 'openai-secret',
      OPENAI_MODEL_PLANNER: 'pinned-planner',
    })
    const text = await response.text()
    const body = JSON.parse(text)
    expect(response.status).toBe(200)
    expect(body.meta).toMatchObject({ source: 'fallback', attempts: 2 })
    expect(body.data.selectedTargets.calorieTargetKcal).toBe(1_800)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(text).not.toContain('provider-secret')
    expect(text).not.toContain('openai-secret')
  })

  it('uses a conservative parser fallback that has no nutrition fields', async () => {
    const worker = createWorker({ fetch: vi.fn() as typeof fetch, randomUUID: () => 'req-parse' })
    const result = await parseResponse(
      await worker.fetch(
        post('/v1/food/parse', { text: '雞胸200g 白菜500g 蛋2顆', locale: 'zh-TW' }),
        ENV,
      ),
    )
    expect(result.status).toBe(200)
    expect(result.body.meta.source).toBe('fallback')
    expect(result.body.data.items).toHaveLength(3)
    expect(result.body.data.items[0]).toMatchObject({ normalizedName: '雞胸', amount: 200, unit: 'g' })
    const serialized = JSON.stringify(result.body.data)
    expect(serialized).not.toContain('kcal')
    expect(serialized).not.toContain('protein')
  })

  it('blocks safety-restricted requests before any OpenAI call', async () => {
    const fetcher = vi.fn()
    const worker = createWorker({ fetch: fetcher as typeof fetch, randomUUID: () => 'req-blocked' })
    const unsafeRequest = {
      ...planRequest,
      profile: { ...planRequest.profile, age: 16 },
      safety: { ...planRequest.safety, status: 'blocked' as const },
    }
    const response = await worker.fetch(post('/v1/plan/generate', unsafeRequest), {
      ...ENV,
      OPENAI_API_KEY: 'secret',
      OPENAI_MODEL_PLANNER: 'planner',
    })
    expect(response.status).toBe(422)
    expect(fetcher).not.toHaveBeenCalled()
  })
})

describe('food search and abuse limits', () => {
  it('keeps local food search usable when external providers fail', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('external raw failure')
    })
    const worker = createWorker({
      fetch: fetcher as typeof fetch,
      now: () => Date.parse('2026-08-07T12:00:00Z'),
      randomUUID: () => 'req-search',
    })
    const response = await worker.fetch(
      post('/v1/food/search', { query: '雞胸', barcode: null, limit: 5, locale: 'zh-TW' }),
      ENV,
    )
    const text = await response.text()
    const body = JSON.parse(text)
    expect(response.status).toBe(200)
    expect(body.data.candidates[0]).toMatchObject({ source: 'local', name: '雞胸肉' })
    expect(body.data.manualEntryAvailable).toBe(true)
    expect(text).not.toContain('external raw failure')
  })

  it('rate limits plan generation per IP/device fingerprint', async () => {
    const worker = createWorker({ randomUUID: () => 'req-rate' })
    const responses: Response[] = []
    for (let index = 0; index < 5; index += 1) {
      responses.push(await worker.fetch(post('/v1/plan/generate', planRequest), ENV))
    }
    expect(responses.slice(0, 4).every((response) => response.status === 200)).toBe(true)
    expect(responses[4].status).toBe(429)
    expect(responses[4].headers.get('Retry-After')).toBeTruthy()
  })
})
