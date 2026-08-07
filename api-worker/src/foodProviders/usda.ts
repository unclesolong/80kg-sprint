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

const nutrientValue = (food: Record<string, unknown>, numbers: string[], names: string[]) => {
  if (!Array.isArray(food.foodNutrients)) return undefined
  for (const item of food.foodNutrients) {
    if (!isRecord(item)) continue
    const nutrient = isRecord(item.nutrient) ? item.nutrient : item
    const number = String(nutrient.nutrientNumber ?? nutrient.number ?? '')
    const name = String(nutrient.nutrientName ?? nutrient.name ?? '').toLowerCase()
    if (!numbers.includes(number) && !names.some((expected) => name === expected || name.startsWith(expected))) continue
    const value = positiveNumber(item.value ?? item.amount)
    if (value === undefined) continue
    const unit = String(nutrient.unitName ?? item.unitName ?? '').toLowerCase()
    if (numbers.includes('208') && unit === 'kj') continue
    return value
  }
  return undefined
}

const inferWeightState = (description: string): FoodCandidate['weightState'] => {
  const normalized = description.toLowerCase()
  if (/\b(raw|uncooked)\b/.test(normalized)) return 'raw'
  if (/\b(cooked|boiled|baked|roasted|fried)\b/.test(normalized)) return 'cooked'
  return 'unknown'
}

export class UsdaFoodProvider implements FoodDataProvider {
  readonly source = 'usda' as const
  private readonly timeoutMs: number

  constructor(
    private readonly apiKey: string | undefined,
    private readonly context: ProviderContext,
  ) {
    this.timeoutMs = context.timeoutMs ?? 4_000
  }

  private map(value: unknown): FoodCandidate | null {
    if (!isRecord(value)) return null
    const id = value.fdcId
    const description = value.description
    const kcal = nutrientValue(value, ['208'], ['energy'])
    if ((typeof id !== 'number' && typeof id !== 'string') || typeof description !== 'string' || kcal === undefined) {
      return null
    }
    const candidate: FoodCandidate = {
      source: 'usda',
      sourceId: String(id),
      name: description.slice(0, 180),
      brand:
        typeof value.brandOwner === 'string'
          ? value.brandOwner.slice(0, 120)
          : typeof value.brandName === 'string'
            ? value.brandName.slice(0, 120)
            : undefined,
      weightState: inferWeightState(description),
      basis: '100g',
      kcal,
      proteinG: nutrientValue(value, ['203'], ['protein']),
      carbsG: nutrientValue(value, ['205'], ['carbohydrate']),
      fatG: nutrientValue(value, ['204'], ['total lipid', 'total fat']),
      fiberG: nutrientValue(value, ['291'], ['fiber']),
      sodiumMg: nutrientValue(value, ['307'], ['sodium']),
      completeness: 'partial',
      fetchedAt: new Date(this.context.now()).toISOString(),
    }
    candidate.completeness = determineCompleteness(candidate)
    return candidate
  }

  async search(query: FoodSearchQuery): Promise<FoodCandidate[]> {
    if (!this.apiKey || query.barcode || !query.text.trim()) return []
    try {
      const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search')
      url.searchParams.set('api_key', this.apiKey)
      const response = await withTimeout(this.timeoutMs, (signal) =>
        this.context.fetcher(url.toString(), {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: query.text,
            pageSize: Math.min(query.limit, 20),
            dataType: ['Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Branded'],
          }),
          signal,
        }),
      )
      const payload = await safeJson(response)
      if (!isRecord(payload) || !Array.isArray(payload.foods)) return []
      return payload.foods
        .map((food) => this.map(food))
        .filter((food): food is FoodCandidate => food !== null)
        .slice(0, query.limit)
    } catch {
      return []
    }
  }

  async getById(id: string): Promise<FoodCandidate | null> {
    if (!this.apiKey || !/^\d+$/.test(id)) return null
    try {
      const url = new URL(`https://api.nal.usda.gov/fdc/v1/food/${encodeURIComponent(id)}`)
      url.searchParams.set('api_key', this.apiKey)
      const payload = await withTimeout(this.timeoutMs, async (signal) =>
        safeJson(await this.context.fetcher(url.toString(), { headers: { Accept: 'application/json' }, signal })),
      )
      return this.map(payload)
    } catch {
      return null
    }
  }
}

export { nutrientValue as readUsdaNutrient }
