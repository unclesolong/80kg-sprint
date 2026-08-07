import type { Env, FoodCandidate, FoodSearchQuery } from './contracts'
import {
  BlsFoodProvider,
  LocalFoodProvider,
  OpenFoodFactsProvider,
  UsdaFoodProvider,
  searchFoodProviders,
  type FoodProviderSearchResult,
} from './foodProviders'

interface CacheEntry {
  expiresAt: number
  result: FoodProviderSearchResult
}

export class FoodSearchService {
  private readonly cache = new Map<string, CacheEntry>()

  constructor(
    private readonly fetcher: typeof fetch,
    private readonly now: () => number,
  ) {}

  async search(query: FoodSearchQuery, env: Env): Promise<FoodProviderSearchResult & { cache: 'hit' | 'miss' }> {
    const key = [
      query.locale,
      query.text.normalize('NFKC').trim().toLocaleLowerCase(),
      query.barcode ?? '',
      query.limit,
    ].join('|')
    const cached = this.cache.get(key)
    const now = this.now()
    if (cached && cached.expiresAt > now) return { ...cloneResult(cached.result), cache: 'hit' }

    const context = { fetcher: this.fetcher, now: this.now, timeoutMs: 4_000 }
    const providers = [
      new LocalFoodProvider(this.now),
      new BlsFoodProvider(env.BLS_API_BASE_URL, context),
      new UsdaFoodProvider(env.USDA_API_KEY, context),
      new OpenFoodFactsProvider(context, env.FOOD_PROVIDER_USER_AGENT),
    ]
    const result = await searchFoodProviders(providers, query)
    this.cache.set(key, { expiresAt: now + 10 * 60 * 1_000, result: cloneResult(result) })
    if (this.cache.size > 200) {
      const oldestKey = this.cache.keys().next().value as string | undefined
      if (oldestKey) this.cache.delete(oldestKey)
    }
    return { ...result, cache: 'miss' }
  }
}

const cloneCandidate = (candidate: FoodCandidate): FoodCandidate => ({ ...candidate })

const cloneResult = (result: FoodProviderSearchResult): FoodProviderSearchResult => ({
  candidates: result.candidates.map(cloneCandidate),
  providers: result.providers.map((provider) => ({ ...provider })),
})
