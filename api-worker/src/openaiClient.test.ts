import { describe, expect, it, vi } from 'vitest'
import { requestStructuredWithRetry } from './openaiClient'
import { structuredOutputDefinitions } from './schemas'
import { planOutput, planRequest } from './testFixtures'
import { validatePlanAIOutput } from './validators'

const responseEnvelope = (output: unknown) =>
  new Response(
    JSON.stringify({
      id: 'resp_test',
      status: 'completed',
      output: [
        {
          type: 'message',
          content: [{ type: 'output_text', text: JSON.stringify(output), annotations: [] }],
        },
      ],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )

const options = (fetcher: typeof fetch) => ({
  apiKey: 'test-secret-key',
  model: 'pinned-test-model',
  kind: 'plan' as const,
  schemaName: structuredOutputDefinitions.plan.name,
  schema: structuredOutputDefinitions.plan.schema,
  input: planRequest,
  instructions: 'Return a safe plan.',
  reasoningEffort: 'medium' as const,
  maxOutputTokens: 1_100,
  timeoutMs: 100,
  fetcher,
  validate: validatePlanAIOutput,
  validateDomain: () => [] as string[],
})

describe('OpenAI Responses structured output client', () => {
  it('sends store:false, a strict JSON schema, model env value, and returns validated output', async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => responseEnvelope(planOutput))
    const result = await requestStructuredWithRetry(options(fetcher as typeof fetch))
    expect(result).toEqual({ ok: true, value: planOutput, attempts: 1 })
    const requestInit = fetcher.mock.calls[0][1] as RequestInit
    const body = JSON.parse(String(requestInit.body))
    expect(body.store).toBe(false)
    expect(body.model).toBe('pinned-test-model')
    expect(body.reasoning).toEqual({ effort: 'medium' })
    expect(body.text.format.type).toBe('json_schema')
    expect(body.text.format.strict).toBe(true)
    expect(body.max_output_tokens).toBe(1_100)
  })

  it('retries once after a malformed/schema response and accepts the corrected output', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(responseEnvelope({ schemaVersion: 1 }))
      .mockResolvedValueOnce(responseEnvelope(planOutput))
    const result = await requestStructuredWithRetry(options(fetcher as typeof fetch))
    expect(result.ok).toBe(true)
    expect(result.attempts).toBe(2)
    const retryBody = JSON.parse(String((fetcher.mock.calls[1][1] as RequestInit).body))
    expect(retryBody.instructions).toContain('previous output was rejected')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('rejects domain violations twice without clamping them', async () => {
    const fetcher = vi.fn(async () => responseEnvelope(planOutput))
    const result = await requestStructuredWithRetry({
      ...options(fetcher as typeof fetch),
      validateDomain: () => ['calorie_target_out_of_bounds'],
    })
    expect(result).toEqual({
      ok: false,
      attempts: 2,
      reason: 'domain',
      issues: ['calorie_target_out_of_bounds'],
    })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('handles refusal, timeout, and malformed envelope as sanitized failures', async () => {
    const refusal = vi.fn(async () =>
      new Response(
        JSON.stringify({ output: [{ content: [{ type: 'refusal', refusal: 'raw refusal text' }] }] }),
      ),
    )
    const refused = await requestStructuredWithRetry(options(refusal as typeof fetch))
    expect(refused.ok).toBe(false)
    if (!refused.ok) expect(refused.reason).toBe('refusal')

    const timeout = vi.fn(async () => {
      throw new DOMException('upstream secret detail', 'AbortError')
    })
    const timedOut = await requestStructuredWithRetry(options(timeout as typeof fetch))
    expect(timedOut.ok).toBe(false)
    if (!timedOut.ok) expect(timedOut).toMatchObject({ reason: 'timeout', issues: ['upstream_timeout'] })

    const malformed = vi.fn(async () => new Response('{not json', { status: 200 }))
    const malformedResult = await requestStructuredWithRetry(options(malformed as typeof fetch))
    expect(malformedResult.ok).toBe(false)
    expect(JSON.stringify(malformedResult)).not.toContain('not json')
  })
})
