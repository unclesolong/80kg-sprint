import { dedupeFoodCandidates, normalizeFoodText } from '../foodData/ranking'
import type { FoodCandidate, FoodSearchQuery, FoodSearchResponse } from '../foodData/types'
import { createSafeHttpClient, type HttpClientOptions } from './httpClient'
import { safeServiceError, type ServiceResult } from './serviceTypes'
import { array, boolean, enumeration, exactKeys, literal, number, record, text, validate, type ValidationResult } from './strictValidation'

const OPTIONAL_CANDIDATE_KEYS = ['brand', 'barcode', 'preparation', 'weightState', 'proteinG', 'carbsG', 'fatG', 'fiberG', 'sodiumMg'] as const

const parseFoodCandidate = (value: unknown, path: string): FoodCandidate => {
  const data = record(value, path)
  exactKeys(data, ['source', 'sourceId', 'name', 'basis', 'kcal', 'completeness', 'fetchedAt'], OPTIONAL_CANDIDATE_KEYS, path)
  const candidate: FoodCandidate = {
    source: enumeration(data.source, ['local', 'bls', 'usda', 'open_food_facts', 'manual', 'ai_estimate'] as const, `${path}.source`),
    sourceId: text(data.sourceId, `${path}.sourceId`, 160),
    name: text(data.name, `${path}.name`, 160),
    basis: enumeration(data.basis, ['100g', '100ml', 'serving'] as const, `${path}.basis`),
    kcal: number(data.kcal, `${path}.kcal`, { min: 0, max: 20_000 }),
    completeness: enumeration(data.completeness, ['complete', 'partial', 'calorie_protein_only', 'estimated'] as const, `${path}.completeness`),
    fetchedAt: text(data.fetchedAt, `${path}.fetchedAt`, 40)
  }
  if (data.brand !== undefined) candidate.brand = text(data.brand, `${path}.brand`, 160)
  if (data.barcode !== undefined) candidate.barcode = text(data.barcode, `${path}.barcode`, 40)
  if (data.preparation !== undefined) candidate.preparation = text(data.preparation, `${path}.preparation`, 120)
  if (data.weightState !== undefined) candidate.weightState = enumeration(data.weightState, ['raw', 'cooked', 'unknown'] as const, `${path}.weightState`)
  for (const key of ['proteinG', 'carbsG', 'fatG', 'fiberG', 'sodiumMg'] as const) {
    if (data[key] !== undefined) candidate[key] = number(data[key], `${path}.${key}`, { min: 0, max: 100_000 })
  }
  return candidate
}

export const parseFoodSearchResponse = (value: unknown): ValidationResult<FoodSearchResponse> => validate(() => {
  const data = record(value, 'response')
  exactKeys(data, ['candidates', 'providers', 'manualEntryAvailable'])
  return {
    candidates: array(data.candidates, 'response.candidates', 20, parseFoodCandidate),
    providers: array(data.providers, 'response.providers', 8, (provider, path) => {
      const item = record(provider, path)
      exactKeys(item, ['source', 'status'], [], path)
      return {
        source: enumeration(item.source, ['local', 'bls', 'usda', 'open_food_facts', 'manual', 'ai_estimate'] as const, `${path}.source`),
        status: enumeration(item.status, ['ok', 'empty', 'unavailable'] as const, `${path}.status`)
      }
    }),
    manualEntryAvailable: boolean(data.manualEntryAvailable, 'response.manualEntryAvailable')
  }
})

const matchesOfflineQuery = (candidate: FoodCandidate, query: FoodSearchQuery) => {
  if (query.barcode) return candidate.barcode?.replace(/\D/g, '') === query.barcode.replace(/\D/g, '')
  const needle = normalizeFoodText(query.text)
  if (!needle) return false
  const haystack = `${normalizeFoodText(candidate.name)}${normalizeFoodText(candidate.brand ?? '')}`
  return haystack.includes(needle) || needle.includes(normalizeFoodText(candidate.name))
}

export interface FoodClient {
  readonly configured: boolean
  search(query: FoodSearchQuery, offlineCandidates?: readonly FoodCandidate[]): Promise<ServiceResult<FoodCandidate[]>>
  health(): Promise<ServiceResult<WorkerHealth>>
}

export interface WorkerHealth {
  service: '80kg-sprint-api-worker'
  version: 1
  aiConfigured: boolean
  providers: { local: boolean; blsConfigured: boolean; usdaConfigured: boolean; openFoodFacts: boolean }
  timestamp: string
}

export interface FoodClientOptions extends HttpClientOptions {
  /** External queries stay disabled until the user has accepted the Planner privacy notice. */
  hasConsent?: () => boolean
}

export const createFoodClient = (options: FoodClientOptions = {}): FoodClient => {
  const http = createSafeHttpClient(options)
  const hasConsent = options.hasConsent ?? (() => false)
  return {
    configured: http.configured,
    async search(query, offlineCandidates = []) {
      const textQuery = typeof query?.text === 'string' ? query.text.trim() : ''
      const fallback = dedupeFoodCandidates(offlineCandidates.filter((candidate) => matchesOfflineQuery(candidate, query)), query).slice(0, query.limit ?? 5)
      if ((!textQuery && !query.barcode) || textQuery.length > 160 || (query.barcode?.length ?? 0) > 40) {
        return { ok: false, error: safeServiceError('invalid_request'), fallback }
      }
      if (!http.configured) return { ok: false, error: safeServiceError('disabled'), fallback }
      if (!hasConsent()) return { ok: false, error: safeServiceError('consent_required'), fallback }
      const safeQuery: FoodSearchQuery = {
        text: textQuery,
        barcode: query.barcode?.replace(/\D/g, '').slice(0, 32) || undefined,
        weightState: query.weightState,
        limit: Math.min(20, Math.max(2, Math.round(query.limit ?? 5)))
      }
      const response = await http.request('/v1/food/search', { method: 'POST', body: { query: safeQuery.text, barcode: safeQuery.barcode ?? null, limit: safeQuery.limit, locale: 'zh-TW' }, aiConsent: true })
      if (!response.ok) return { ...response, fallback }
      const schema = parseFoodSearchResponse(response.data)
      if (!schema.valid) return { ok: false, error: safeServiceError('invalid_response'), fallback }
      const candidates = dedupeFoodCandidates([...fallback, ...schema.value.candidates], safeQuery).slice(0, safeQuery.limit)
      return { ok: true, data: candidates, fallback: false, meta: response.meta }
    },
    async health() {
      if (!http.configured) return { ok: false, error: safeServiceError('disabled') }
      const response = await http.request('/v1/health')
      if (!response.ok) return { ok: false, error: response.error }
      const parsed = validate(() => {
        const data = record(response.data, 'response')
        exactKeys(data, ['service', 'version', 'aiConfigured', 'providers', 'timestamp'])
        const providers = record(data.providers, 'response.providers')
        exactKeys(providers, ['local', 'blsConfigured', 'usdaConfigured', 'openFoodFacts'], [], 'response.providers')
        return {
          service: literal(data.service, '80kg-sprint-api-worker', 'response.service'),
          version: literal(data.version, 1, 'response.version'),
          aiConfigured: boolean(data.aiConfigured, 'response.aiConfigured'),
          providers: {
            local: boolean(providers.local, 'response.providers.local'),
            blsConfigured: boolean(providers.blsConfigured, 'response.providers.blsConfigured'),
            usdaConfigured: boolean(providers.usdaConfigured, 'response.providers.usdaConfigured'),
            openFoodFacts: boolean(providers.openFoodFacts, 'response.providers.openFoodFacts')
          },
          timestamp: text(data.timestamp, 'response.timestamp', 40)
        }
      })
      return parsed.valid
        ? { ok: true, data: parsed.value, fallback: false, meta: response.meta }
        : { ok: false, error: safeServiceError('invalid_response') }
    }
  }
}
