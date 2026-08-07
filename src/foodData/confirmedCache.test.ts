import { describe, expect, it } from 'vitest'
import type { FoodMetadata } from '../planner/types'
import { candidatesFromMetadata, makeFoodMetadata, metadataToCandidate, recordConfirmedCandidate, searchConfirmedCache, upsertFoodMetadata } from './confirmedCache'
import type { FoodCandidate } from './types'

const food: FoodCandidate = {
  source: 'bls', sourceId: 'BLS-123', name: 'Hähnchenbrust', brand: 'Test', preparation: 'gegart', weightState: 'cooked',
  basis: '100g', kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6, completeness: 'partial', fetchedAt: '2026-08-01T00:00:00.000Z'
}

describe('confirmed food cache helpers', () => {
  it('stores provenance plus a confirmed offline snapshot in Planner FoodMetadata', () => {
    const metadata = makeFoodMetadata(food, { mealLineKey: 'line 1', now: '2026-08-07T12:00:00.000Z' })
    expect(metadata).toMatchObject({ source: 'bls', sourceId: 'BLS-123', mealLineKey: 'line 1', confirmedAt: '2026-08-07T12:00:00.000Z', fetchedAt: food.fetchedAt, name: food.name, kcal: 165, carbsG: 0 })
    expect(metadataToCandidate(metadata)).toEqual(food)
  })

  it('keeps legacy provenance-only metadata valid without inventing a candidate', () => {
    const legacy: FoodMetadata = { id: 'legacy', source: 'usda', sourceId: 'x', fetchedAt: '2026-01-01' }
    expect(metadataToCandidate(legacy)).toBeNull()
    expect(candidatesFromMetadata([legacy, makeFoodMetadata(food)])).toEqual([food])
  })

  it('upserts metadata by id without mutating the input', () => {
    const current = [makeFoodMetadata(food, { id: 'one', now: '2026-08-01' })]
    const next = makeFoodMetadata({ ...food, kcal: 170 }, { id: 'one', now: '2026-08-02' })
    const updated = upsertFoodMetadata(current, next)
    expect(updated).toHaveLength(1)
    expect(updated[0].kcal).toBe(170)
    expect(current[0].kcal).toBe(165)
  })

  it('tracks aliases and use count for deterministic offline lookup', () => {
    let entries = recordConfirmedCandidate([], food, { query: '雞胸肉', now: '2026-08-01' })
    entries = recordConfirmedCandidate(entries, food, { query: 'chicken breast', now: '2026-08-02' })
    expect(entries[0].useCount).toBe(2)
    expect(searchConfirmedCache(entries, '雞胸')).toEqual([food])
    expect(searchConfirmedCache(entries, 'chicken')).toEqual([food])
  })
})

