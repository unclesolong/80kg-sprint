import { describe, expect, it, vi } from 'vitest'
import type { FoodCandidate, FoodSearchQuery } from '../contracts'
import { rankAndDedupeCandidates, searchFoodProviders } from './index'
import { LocalFoodProvider } from './local'
import { OpenFoodFactsProvider } from './openFoodFacts'
import type { FoodDataProvider } from './types'
import { UsdaFoodProvider } from './usda'

const query: FoodSearchQuery = { text: '雞胸', limit: 5, locale: 'zh-TW' }
const NOW = Date.parse('2026-08-07T12:00:00Z')

describe('food provider normalization', () => {
  it('returns local raw/cooked metadata deterministically', async () => {
    const result = await new LocalFoodProvider(() => NOW).search(query)
    expect(result[0]).toMatchObject({ source: 'local', name: '雞胸肉', weightState: 'raw', basis: '100g' })
  })

  it('keeps missing USDA fiber and sodium undefined instead of zero', async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          foods: [
            {
              fdcId: 123,
              description: 'Chicken breast, raw',
              foodNutrients: [
                { nutrientNumber: '208', nutrientName: 'Energy', unitName: 'KCAL', value: 120 },
                { nutrientNumber: '203', nutrientName: 'Protein', unitName: 'G', value: 23.1 },
              ],
            },
          ],
        }),
      ),
    )
    const provider = new UsdaFoodProvider('usda-test-key', {
      fetcher: fetcher as typeof fetch,
      now: () => NOW,
    })
    const [candidate] = await provider.search(query)
    expect(candidate).toMatchObject({ kcal: 120, proteinG: 23.1, completeness: 'calorie_protein_only' })
    expect(candidate.fiberG).toBeUndefined()
    expect(candidate.sodiumMg).toBeUndefined()
    expect(JSON.stringify(candidate)).not.toContain('fiberG')
    expect(JSON.stringify(candidate)).not.toContain('sodiumMg')
  })

  it('normalizes Open Food Facts sodium grams to milligrams', async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          status: 1,
          product: {
            code: '400000000001',
            product_name: 'Test food',
            nutriments: {
              'energy-kcal_100g': 200,
              proteins_100g: 10,
              carbohydrates_100g: 20,
              fat_100g: 8,
              fiber_100g: 3,
              sodium_100g: 0.4,
            },
          },
        }),
      ),
    )
    const provider = new OpenFoodFactsProvider({ fetcher: fetcher as typeof fetch, now: () => NOW })
    const candidate = await provider.getByBarcode('400000000001')
    expect(candidate).toMatchObject({ sodiumMg: 400, completeness: 'complete' })
  })
})

describe('deterministic provider ranking and failure isolation', () => {
  const base: FoodCandidate = {
    source: 'usda',
    sourceId: 'u1',
    name: 'Chicken breast',
    basis: '100g',
    kcal: 120,
    proteinG: 23,
    completeness: 'calorie_protein_only',
    fetchedAt: new Date(NOW).toISOString(),
  }

  it('deduplicates nutrition-near candidates and prefers local source', () => {
    const result = rankAndDedupeCandidates(
      [base, { ...base, source: 'local', sourceId: 'local-1', kcal: 121 }],
      { text: 'Chicken breast', limit: 5, locale: 'zh-TW' },
    )
    expect(result).toHaveLength(1)
    expect(result[0].source).toBe('local')
  })

  it('puts exact barcode first', () => {
    const result = rankAndDedupeCandidates(
      [
        base,
        { ...base, source: 'open_food_facts', sourceId: '400', barcode: '400', name: 'Brand food' },
      ],
      { text: '', barcode: '400', limit: 5, locale: 'zh-TW' },
    )
    expect(result[0].barcode).toBe('400')
  })

  it('does not let a failed external provider block other candidates', async () => {
    const failed: FoodDataProvider = {
      source: 'usda',
      search: async () => Promise.reject(new Error('raw provider secret')),
      getById: async () => null,
    }
    const local: FoodDataProvider = {
      source: 'local',
      search: async () => [{ ...base, source: 'local', sourceId: 'local' }],
      getById: async () => null,
    }
    const result = await searchFoodProviders([failed, local], query)
    expect(result.candidates).toHaveLength(1)
    expect(result.providers).toContainEqual({ source: 'usda', status: 'unavailable' })
    expect(JSON.stringify(result)).not.toContain('raw provider secret')
  })
})
