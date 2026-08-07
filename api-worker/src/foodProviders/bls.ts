import type { FoodCandidate, FoodSearchQuery } from '../contracts'
import {
  determineCompleteness,
  optionalNumber,
  positiveNumber,
  safeJson,
  withTimeout,
  type FoodDataProvider,
  type ProviderContext,
} from './types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const validGatewayUrl = (value: string) => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))
  } catch {
    return false
  }
}

export class BlsFoodProvider implements FoodDataProvider {
  readonly source = 'bls' as const
  private readonly timeoutMs: number

  constructor(
    private readonly baseUrl: string | undefined,
    private readonly context: ProviderContext,
  ) {
    this.timeoutMs = context.timeoutMs ?? 4_000
  }

  private map(value: unknown): FoodCandidate | null {
    if (!isRecord(value)) return null
    const sourceId = value.sourceId ?? value.id ?? value.blsCode
    const name = value.name ?? value.description
    const kcal = positiveNumber(value.kcal ?? value.kcalPer100g ?? value.energyKcal)
    if (typeof sourceId !== 'string' || typeof name !== 'string' || kcal === undefined) return null
    const candidate: FoodCandidate = {
      source: 'bls',
      sourceId: sourceId.slice(0, 100),
      name: name.slice(0, 160),
      brand: typeof value.brand === 'string' ? value.brand.slice(0, 120) : undefined,
      preparation: typeof value.preparation === 'string' ? value.preparation.slice(0, 80) : undefined,
      weightState: value.weightState === 'raw' || value.weightState === 'cooked' ? value.weightState : 'unknown',
      basis: value.basis === '100ml' || value.basis === 'serving' ? value.basis : '100g',
      kcal,
      proteinG: optionalNumber(value.proteinG),
      carbsG: optionalNumber(value.carbsG),
      fatG: optionalNumber(value.fatG),
      fiberG: optionalNumber(value.fiberG),
      sodiumMg: optionalNumber(value.sodiumMg),
      completeness: 'partial',
      fetchedAt: new Date(this.context.now()).toISOString(),
    }
    candidate.completeness = determineCompleteness(candidate)
    return candidate
  }

  async search(query: FoodSearchQuery): Promise<FoodCandidate[]> {
    if (!this.baseUrl || !validGatewayUrl(this.baseUrl) || query.barcode) return []
    try {
      const url = new URL(this.baseUrl)
      url.searchParams.set('query', query.text)
      url.searchParams.set('limit', String(query.limit))
      url.searchParams.set('locale', query.locale)
      const payload = await withTimeout(this.timeoutMs, async (signal) =>
        safeJson(await this.context.fetcher(url.toString(), { headers: { Accept: 'application/json' }, signal })),
      )
      if (!isRecord(payload)) return []
      const rows = Array.isArray(payload.foods)
        ? payload.foods
        : Array.isArray(payload.items)
          ? payload.items
          : Array.isArray(payload.results)
            ? payload.results
            : []
      return rows.map((row) => this.map(row)).filter((row): row is FoodCandidate => row !== null).slice(0, query.limit)
    } catch {
      return []
    }
  }

  async getById(id: string): Promise<FoodCandidate | null> {
    if (!this.baseUrl || !validGatewayUrl(this.baseUrl)) return null
    try {
      const url = new URL(this.baseUrl)
      url.pathname = `${url.pathname.replace(/\/$/, '')}/${encodeURIComponent(id)}`
      const payload = await withTimeout(this.timeoutMs, async (signal) =>
        safeJson(await this.context.fetcher(url.toString(), { headers: { Accept: 'application/json' }, signal })),
      )
      return this.map(payload)
    } catch {
      return null
    }
  }
}
