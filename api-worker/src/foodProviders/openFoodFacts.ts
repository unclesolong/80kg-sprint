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

const PRODUCT_FIELDS = [
  'code',
  'product_name',
  'product_name_en',
  'brands',
  'serving_size',
  'product_quantity_unit',
  'nutriments',
].join(',')

export class OpenFoodFactsProvider implements FoodDataProvider {
  readonly source = 'open_food_facts' as const
  private readonly timeoutMs: number
  private readonly userAgent: string

  constructor(context: ProviderContext, userAgent?: string) {
    this.context = context
    this.timeoutMs = context.timeoutMs ?? 4_000
    this.userAgent = userAgent?.slice(0, 180) || '80kg-sprint/1.0 (food-data adapter)'
  }

  private readonly context: ProviderContext

  private map(value: unknown): FoodCandidate | null {
    if (!isRecord(value) || !isRecord(value.nutriments)) return null
    const code = value.code
    const name = value.product_name || value.product_name_en
    const nutrients = value.nutriments
    const kcal = positiveNumber(nutrients['energy-kcal_100g'])
    if (typeof code !== 'string' || typeof name !== 'string' || kcal === undefined) return null
    const serving = typeof value.serving_size === 'string' ? value.serving_size : ''
    const basis = value.product_quantity_unit === 'ml' || /\bml\b/i.test(serving) ? '100ml' : '100g'
    const candidate: FoodCandidate = {
      source: 'open_food_facts',
      sourceId: code.slice(0, 40),
      barcode: code.slice(0, 40),
      name: name.slice(0, 180),
      brand: typeof value.brands === 'string' ? value.brands.split(',')[0]?.trim().slice(0, 120) : undefined,
      weightState: 'unknown',
      basis,
      kcal,
      proteinG: optionalNumber(nutrients.proteins_100g),
      carbsG: optionalNumber(nutrients.carbohydrates_100g),
      fatG: optionalNumber(nutrients.fat_100g),
      fiberG: optionalNumber(nutrients.fiber_100g),
      sodiumMg:
        optionalNumber(nutrients.sodium_100g) !== undefined
          ? optionalNumber(nutrients.sodium_100g)! * 1_000
          : undefined,
      completeness: 'partial',
      fetchedAt: new Date(this.context.now()).toISOString(),
    }
    candidate.completeness = determineCompleteness(candidate)
    return candidate
  }

  private headers() {
    return { Accept: 'application/json', 'User-Agent': this.userAgent }
  }

  async search(query: FoodSearchQuery): Promise<FoodCandidate[]> {
    if (query.barcode) {
      const exact = await this.getByBarcode(query.barcode)
      return exact ? [exact] : []
    }
    if (!query.text.trim()) return []
    try {
      const url = new URL('https://world.openfoodfacts.org/cgi/search.pl')
      url.searchParams.set('search_terms', query.text)
      url.searchParams.set('search_simple', '1')
      url.searchParams.set('action', 'process')
      url.searchParams.set('json', '1')
      url.searchParams.set('page_size', String(Math.min(query.limit, 20)))
      url.searchParams.set('fields', PRODUCT_FIELDS)
      const payload = await withTimeout(this.timeoutMs, async (signal) =>
        safeJson(await this.context.fetcher(url.toString(), { headers: this.headers(), signal })),
      )
      if (!isRecord(payload) || !Array.isArray(payload.products)) return []
      return payload.products
        .map((product) => this.map(product))
        .filter((product): product is FoodCandidate => product !== null)
        .slice(0, query.limit)
    } catch {
      return []
    }
  }

  async getById(id: string): Promise<FoodCandidate | null> {
    return this.getByBarcode(id)
  }

  async getByBarcode(barcode: string): Promise<FoodCandidate | null> {
    if (!/^[0-9A-Za-z-]{6,40}$/.test(barcode)) return null
    try {
      const url = new URL(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`)
      url.searchParams.set('fields', PRODUCT_FIELDS)
      const payload = await withTimeout(this.timeoutMs, async (signal) =>
        safeJson(await this.context.fetcher(url.toString(), { headers: this.headers(), signal })),
      )
      if (!isRecord(payload) || payload.status !== 1) return null
      return this.map(payload.product)
    } catch {
      return null
    }
  }
}
