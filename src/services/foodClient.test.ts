import { describe, expect, it, vi } from 'vitest'
import type { FoodCandidate } from '../foodData/types'
import { createFoodClient, parseFoodSearchResponse } from './foodClient'

const local: FoodCandidate = {
  source: 'local', sourceId: 'mine', name: '雞胸肉', basis: '100g', kcal: 165, proteinG: 31,
  completeness: 'calorie_protein_only', fetchedAt: '2026-08-07T00:00:00.000Z'
}
const remote: FoodCandidate = {
  source: 'bls', sourceId: 'bls-1', name: '雞胸肉（生）', weightState: 'raw', basis: '100g', kcal: 120, proteinG: 23,
  carbsG: 0, fatG: 2.6, completeness: 'partial', fetchedAt: '2026-08-07T00:00:00.000Z'
}
const responseFetch = (value: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(value), { status })) as unknown as typeof fetch
const searchData = (candidates: FoodCandidate[]) => ({ candidates, providers: [{ source: 'bls' as const, status: candidates.length ? 'ok' as const : 'empty' as const }], manualEntryAvailable: true })
const workerFetch = (value: unknown, status = 200) => responseFetch(status >= 400 ? value : { ok: true, data: value, meta: { requestId: 'test' } }, status)

describe('food service client', () => {
  it('strictly validates candidates while preserving absent nutrients', () => {
    const parsed = parseFoodSearchResponse(searchData([remote]))
    expect(parsed.valid).toBe(true)
    if (parsed.valid) {
      expect(parsed.value.candidates[0].fiberG).toBeUndefined()
      expect(parsed.value.candidates[0].sodiumMg).toBeUndefined()
      expect(parsed.value.candidates[0].carbsG).toBe(0)
    }
    expect(parseFoodSearchResponse(searchData([{ ...remote, rawProviderPayload: {} } as FoodCandidate])).valid).toBe(false)
  })

  it('returns local confirmed candidates when offline without making a request', async () => {
    const fetchImpl = workerFetch(searchData([remote]))
    const client = createFoodClient({ enabled: true, baseUrl: 'https://api.example.com', fetchImpl, hasConsent: () => true, isOnline: () => false })
    const result = await client.search({ text: '雞胸', limit: 5 }, [local])
    expect(result).toMatchObject({ ok: false, error: { code: 'offline' }, fallback: [local] })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('keeps manual/local fallback available before consent', async () => {
    const fetchImpl = workerFetch(searchData([remote]))
    const client = createFoodClient({ enabled: true, baseUrl: 'https://api.example.com', fetchImpl })
    const result = await client.search({ text: '雞胸' }, [local])
    expect(result).toMatchObject({ ok: false, error: { code: 'consent_required' }, fallback: [local] })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('combines and deterministically ranks local and remote results', async () => {
    const fetchImpl = workerFetch(searchData([remote]))
    const client = createFoodClient({ enabled: true, baseUrl: 'https://api.example.com', fetchImpl, hasConsent: () => true })
    const result = await client.search({ text: '雞胸', weightState: 'raw', limit: 5 }, [local])
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.map((item) => item.source)).toEqual(['local', 'bls'])
    const [, init] = vi.mocked(fetchImpl).mock.calls[0]
    expect(JSON.parse(String(init?.body))).toEqual({ query: '雞胸', barcode: null, limit: 5, locale: 'zh-TW' })
    expect((init?.headers as Record<string, string>)['X-AI-Consent']).toBe('granted')
  })

  it('hides external failure details and preserves the offline fallback', async () => {
    const fetchImpl = workerFetch({ message: 'USDA_API_KEY provider detail' }, 503)
    const client = createFoodClient({ enabled: true, baseUrl: 'https://api.example.com', fetchImpl, hasConsent: () => true })
    const result = await client.search({ text: '雞胸' }, [local])
    expect(result).toMatchObject({ ok: false, error: { code: 'unavailable' }, fallback: [local] })
    expect(JSON.stringify(result)).not.toContain('USDA_API_KEY')
  })
})
