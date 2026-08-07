import { foodSourceKey, type CandidateRankContext, type FoodCandidate, type FoodCompleteness, type FoodSource } from './types'

const SOURCE_PRIORITY: Record<FoodSource, number> = {
  local: 0,
  bls: 1,
  usda: 2,
  open_food_facts: 3,
  manual: 4,
  ai_estimate: 5
}

const COMPLETENESS_PRIORITY: Record<FoodCompleteness, number> = {
  complete: 0,
  partial: 1,
  calorie_protein_only: 2,
  estimated: 3
}

export const normalizeFoodText = (value: string) => value
  .normalize('NFKC')
  .trim()
  .toLocaleLowerCase('zh-TW')
  .replace(/[\s\p{P}\p{S}]+/gu, '')

const normalizedBarcode = (value?: string) => value?.replace(/\D/g, '') || ''

const rankTuple = (candidate: FoodCandidate, context: CandidateRankContext): Array<number | string> => {
  const key = foodSourceKey(candidate)
  const query = normalizeFoodText(context.text ?? '')
  const name = normalizeFoodText(candidate.name)
  const barcodeMatch = Boolean(context.barcode && normalizedBarcode(context.barcode) === normalizedBarcode(candidate.barcode))
  const weightMatch = Boolean(context.weightState && candidate.weightState === context.weightState)
  const exactName = Boolean(query && query === name)
  const partialName = Boolean(query && (name.includes(query) || query.includes(name)))
  return [
    context.confirmedSourceKeys?.has(key) ? 0 : 1,
    context.recentSourceKeys?.has(key) ? 0 : 1,
    context.frequentSourceKeys?.has(key) ? 0 : 1,
    barcodeMatch ? 0 : 1,
    SOURCE_PRIORITY[candidate.source],
    weightMatch ? 0 : 1,
    candidate.weightState && candidate.weightState !== 'unknown' ? 0 : 1,
    exactName ? 0 : partialName ? 1 : 2,
    COMPLETENESS_PRIORITY[candidate.completeness],
    normalizeFoodText(candidate.brand ?? ''),
    name,
    candidate.source,
    candidate.sourceId
  ]
}

const compareTuple = (left: Array<number | string>, right: Array<number | string>) => {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const a = left[index]
    const b = right[index]
    if (a === b) continue
    if (typeof a === 'number' && typeof b === 'number') return a - b
    return String(a).localeCompare(String(b), 'zh-TW')
  }
  return 0
}

export const compareFoodCandidates = (left: FoodCandidate, right: FoodCandidate, context: CandidateRankContext = {}) =>
  compareTuple(rankTuple(left, context), rankTuple(right, context))

export const rankFoodCandidates = (candidates: readonly FoodCandidate[], context: CandidateRankContext = {}) =>
  [...candidates].sort((left, right) => compareFoodCandidates(left, right, context))

const close = (left: number | undefined, right: number | undefined, tolerance: number) =>
  left == null || right == null || Math.abs(left - right) <= tolerance

const nutritionIsClose = (left: FoodCandidate, right: FoodCandidate) =>
  Math.abs(left.kcal - right.kcal) <= 5
  && close(left.proteinG, right.proteinG, 1)
  && close(left.carbsG, right.carbsG, 1.5)
  && close(left.fatG, right.fatG, 1)

const isNearDuplicate = (left: FoodCandidate, right: FoodCandidate) => {
  if (normalizeFoodText(left.name) !== normalizeFoodText(right.name)) return false
  if (normalizeFoodText(left.brand ?? '') !== normalizeFoodText(right.brand ?? '')) return false
  if (left.basis !== right.basis) return false
  if (left.weightState && right.weightState && left.weightState !== 'unknown' && right.weightState !== 'unknown' && left.weightState !== right.weightState) return false
  return nutritionIsClose(left, right)
}

/**
 * Keeps the highest deterministic representative. It intentionally does not fill
 * missing nutrients with zero or mix fields from providers with different provenance.
 */
export const dedupeFoodCandidates = (candidates: readonly FoodCandidate[], context: CandidateRankContext = {}) => {
  const ranked = rankFoodCandidates(candidates, context)
  const result: FoodCandidate[] = []
  const sourceKeys = new Set<string>()
  const barcodes = new Set<string>()
  for (const candidate of ranked) {
    const sourceKey = foodSourceKey(candidate)
    const barcode = normalizedBarcode(candidate.barcode)
    if (sourceKeys.has(sourceKey)) continue
    if (barcode && barcodes.has(barcode)) continue
    if (result.some((existing) => isNearDuplicate(existing, candidate))) continue
    result.push(candidate)
    sourceKeys.add(sourceKey)
    if (barcode) barcodes.add(barcode)
  }
  return result
}
