import { describe, expect, it } from 'vitest'
import { dedupeFoodCandidates, rankFoodCandidates } from './ranking'
import { foodSourceKey, type FoodCandidate } from './types'

const candidate = (source: FoodCandidate['source'], sourceId: string, patch: Partial<FoodCandidate> = {}): FoodCandidate => ({
  source, sourceId, name: '雞胸肉', basis: '100g', kcal: 165, proteinG: 31,
  completeness: 'calorie_protein_only', fetchedAt: '2026-08-07T00:00:00.000Z', ...patch
})

describe('deterministic food candidate ranking', () => {
  it('is stable regardless of provider response order', () => {
    const values = [candidate('usda', '2'), candidate('bls', '3'), candidate('local', '1')]
    const forward = rankFoodCandidates(values).map(foodSourceKey)
    const reverse = rankFoodCandidates([...values].reverse()).map(foodSourceKey)
    expect(forward).toEqual(['local:1', 'bls:3', 'usda:2'])
    expect(reverse).toEqual(forward)
  })

  it('places confirmed/recent foods first and gives exact barcode matches priority', () => {
    const local = candidate('local', 'local')
    const exactBarcode = candidate('open_food_facts', 'barcode', { barcode: '4001234567890', brand: 'Brand' })
    const recent = candidate('usda', 'recent')
    const ranked = rankFoodCandidates([local, exactBarcode, recent], {
      barcode: '4001234567890', recentSourceKeys: new Set(['usda:recent'])
    })
    expect(foodSourceKey(ranked[0])).toBe('usda:recent')
    expect(foodSourceKey(ranked[1])).toBe('open_food_facts:barcode')
  })

  it('deduplicates source IDs, barcodes and near nutrition while preserving raw/cooked variants', () => {
    const values = [
      candidate('usda', 'same', { name: '雞胸肉 A', completeness: 'complete', fiberG: 0 }),
      candidate('usda', 'same', { name: '雞胸肉 A', kcal: 166 }),
      candidate('open_food_facts', 'barcode-a', { name: '品牌雞胸', barcode: '12345' }),
      candidate('open_food_facts', 'barcode-b', { name: '品牌雞胸', barcode: '12345', kcal: 166 }),
      candidate('usda', 'near-usda', { name: '近似雞胸', kcal: 165 }),
      candidate('bls', 'near-bls', { name: '近似雞胸', kcal: 164, proteinG: 30.5 }),
      candidate('bls', 'raw', { name: '原始雞胸', weightState: 'raw' }),
      candidate('bls', 'cooked', { name: '原始雞胸', weightState: 'cooked' })
    ]
    const result = dedupeFoodCandidates(values)
    expect(result.filter((item) => item.sourceId === 'same')).toHaveLength(1)
    expect(result.filter((item) => item.barcode === '12345')).toHaveLength(1)
    expect(result.filter((item) => item.name === '近似雞胸')).toHaveLength(1)
    expect(result.some((item) => item.sourceId === 'raw')).toBe(true)
    expect(result.some((item) => item.sourceId === 'cooked')).toBe(true)
    expect(result.find((item) => item.sourceId === 'same')?.fiberG).toBe(0)
  })

  it('does not manufacture missing nutrients while selecting a representative', () => {
    const result = dedupeFoodCandidates([candidate('usda', 'missing', { fiberG: undefined, sodiumMg: undefined })])
    expect(result[0].fiberG).toBeUndefined()
    expect(result[0].sodiumMg).toBeUndefined()
  })
})
