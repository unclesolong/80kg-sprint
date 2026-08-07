import type { FoodCandidate, FoodSearchQuery } from '../contracts'
import type { FoodDataProvider } from './types'

const SOURCE_PRIORITY: Record<FoodCandidate['source'], number> = {
  local: 0,
  bls: 1,
  usda: 2,
  open_food_facts: 3,
  manual: 4,
  ai_estimate: 5,
}

const COMPLETENESS_PRIORITY: Record<FoodCandidate['completeness'], number> = {
  complete: 0,
  partial: 1,
  calorie_protein_only: 2,
  estimated: 3,
}

const normalizeText = (value: string | undefined) =>
  (value ?? '').normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')

const nutritionClose = (left: FoodCandidate, right: FoodCandidate) => {
  const kcalTolerance = Math.max(8, Math.min(left.kcal, right.kcal) * 0.08)
  if (Math.abs(left.kcal - right.kcal) > kcalTolerance) return false
  const nutrients: Array<keyof Pick<FoodCandidate, 'proteinG' | 'carbsG' | 'fatG'>> = [
    'proteinG',
    'carbsG',
    'fatG',
  ]
  return nutrients.every((key) => {
    const leftValue = left[key]
    const rightValue = right[key]
    return leftValue === undefined || rightValue === undefined || Math.abs(leftValue - rightValue) <= 2
  })
}

const candidateScore = (candidate: FoodCandidate, query: FoodSearchQuery) => {
  let score = SOURCE_PRIORITY[candidate.source] * 100 + COMPLETENESS_PRIORITY[candidate.completeness] * 10
  if (query.barcode && candidate.barcode === query.barcode) score -= 1_000
  if (candidate.weightState === 'raw' || candidate.weightState === 'cooked') score -= 3
  if (normalizeText(candidate.name) === normalizeText(query.text)) score -= 5
  return score
}

const preferred = (left: FoodCandidate, right: FoodCandidate, query: FoodSearchQuery) =>
  candidateScore(left, query) <= candidateScore(right, query) ? left : right

export const rankAndDedupeCandidates = (
  candidates: FoodCandidate[],
  query: FoodSearchQuery,
): FoodCandidate[] => {
  const deduped: FoodCandidate[] = []
  for (const candidate of candidates) {
    const duplicateIndex = deduped.findIndex((existing) => {
      if (candidate.barcode && existing.barcode && candidate.barcode === existing.barcode) return true
      if (candidate.source === existing.source && candidate.sourceId === existing.sourceId) return true
      return (
        normalizeText(candidate.name) === normalizeText(existing.name) &&
        normalizeText(candidate.brand) === normalizeText(existing.brand) &&
        candidate.basis === existing.basis &&
        nutritionClose(candidate, existing)
      )
    })
    if (duplicateIndex === -1) deduped.push(candidate)
    else deduped[duplicateIndex] = preferred(deduped[duplicateIndex], candidate, query)
  }
  return deduped.sort((left, right) => {
    const score = candidateScore(left, query) - candidateScore(right, query)
    if (score !== 0) return score
    return `${left.source}:${left.sourceId}`.localeCompare(`${right.source}:${right.sourceId}`)
  })
}

export interface FoodProviderSearchResult {
  candidates: FoodCandidate[]
  providers: Array<{ source: FoodCandidate['source']; status: 'ok' | 'empty' | 'unavailable' }>
}

export const searchFoodProviders = async (
  providers: FoodDataProvider[],
  query: FoodSearchQuery,
): Promise<FoodProviderSearchResult> => {
  const settled = await Promise.allSettled(providers.map((provider) => provider.search(query)))
  const candidates: FoodCandidate[] = []
  const statuses: FoodProviderSearchResult['providers'] = []
  settled.forEach((result, index) => {
    const source = providers[index].source
    if (result.status === 'rejected') {
      statuses.push({ source, status: 'unavailable' })
      return
    }
    candidates.push(...result.value)
    statuses.push({ source, status: result.value.length > 0 ? 'ok' : 'empty' })
  })
  return {
    candidates: rankAndDedupeCandidates(candidates, query).slice(0, query.limit),
    providers: statuses,
  }
}

export { BlsFoodProvider } from './bls'
export { LocalFoodProvider } from './local'
export { OpenFoodFactsProvider } from './openFoodFacts'
export { UsdaFoodProvider } from './usda'
export type { FoodDataProvider } from './types'
