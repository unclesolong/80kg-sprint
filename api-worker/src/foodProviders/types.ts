import type { FoodCandidate, FoodSearchQuery } from '../contracts'

export interface FoodDataProvider {
  readonly source: FoodCandidate['source']
  search(query: FoodSearchQuery): Promise<FoodCandidate[]>
  getById(id: string): Promise<FoodCandidate | null>
  getByBarcode?(barcode: string): Promise<FoodCandidate | null>
}

export interface ProviderContext {
  fetcher: typeof fetch
  now: () => number
  timeoutMs?: number
}

export const withTimeout = async <T>(timeoutMs: number, action: (signal: AbortSignal) => Promise<T>) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await action(controller.signal)
  } finally {
    clearTimeout(timeout)
  }
}

export const optionalNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

export const positiveNumber = (value: unknown): number | undefined => {
  const number = optionalNumber(value)
  return number !== undefined && number >= 0 ? number : undefined
}

export const determineCompleteness = (
  candidate: Pick<FoodCandidate, 'proteinG' | 'carbsG' | 'fatG' | 'fiberG' | 'sodiumMg'>,
): FoodCandidate['completeness'] => {
  const core = [candidate.proteinG, candidate.carbsG, candidate.fatG]
  const allCore = core.every((value) => value !== undefined)
  if (allCore && candidate.fiberG !== undefined && candidate.sodiumMg !== undefined) return 'complete'
  if (candidate.proteinG !== undefined && !allCore && candidate.fiberG === undefined && candidate.sodiumMg === undefined) {
    return 'calorie_protein_only'
  }
  return 'partial'
}

export const safeJson = async (response: Response, maxCharacters = 400_000): Promise<unknown> => {
  if (!response.ok) return null
  const text = await response.text()
  if (text.length > maxCharacters) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
