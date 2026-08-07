import type { FoodMetadata } from '../planner/types'
import { dedupeFoodCandidates, normalizeFoodText, rankFoodCandidates } from './ranking'
import { foodSourceKey, type CandidateRankContext, type FoodCandidate } from './types'

export interface ConfirmedFoodCacheEntry {
  candidate: FoodCandidate
  queryAliases: string[]
  confirmedAt: string
  lastUsedAt: string
  useCount: number
}

const uniqueAliases = (aliases: readonly string[]) => [...new Set(aliases.map(normalizeFoodText).filter(Boolean))].slice(0, 12)

export const confirmedKeysFromMetadata = (metadata: readonly FoodMetadata[]) =>
  new Set(metadata.map((item) => `${item.source}:${item.sourceId}`))

export const makeFoodMetadata = (
  candidate: FoodCandidate,
  options: { mealLineKey?: string; now?: string; id?: string } = {}
): FoodMetadata => {
  const confirmedAt = options.now ?? new Date().toISOString()
  const prefix = options.mealLineKey ? encodeURIComponent(options.mealLineKey) : 'confirmed'
  return {
    id: options.id ?? `${prefix}:${candidate.source}:${encodeURIComponent(candidate.sourceId)}`,
    mealLineKey: options.mealLineKey,
    source: candidate.source,
    sourceId: candidate.sourceId,
    fetchedAt: candidate.fetchedAt,
    confirmedAt,
    name: candidate.name,
    brand: candidate.brand,
    barcode: candidate.barcode,
    preparation: candidate.preparation,
    weightState: candidate.weightState,
    basis: candidate.basis,
    kcal: candidate.kcal,
    proteinG: candidate.proteinG,
    carbsG: candidate.carbsG,
    fatG: candidate.fatG,
    fiberG: candidate.fiberG,
    sodiumMg: candidate.sodiumMg,
    completeness: candidate.completeness
  }
}

/** Rehydrates only complete confirmed snapshots; legacy provenance-only metadata remains valid. */
export const metadataToCandidate = (metadata: FoodMetadata): FoodCandidate | null => {
  if (!metadata.name || !metadata.basis || metadata.kcal == null || !metadata.completeness) return null
  return {
    source: metadata.source,
    sourceId: metadata.sourceId,
    name: metadata.name,
    brand: metadata.brand,
    barcode: metadata.barcode,
    preparation: metadata.preparation,
    weightState: metadata.weightState,
    basis: metadata.basis,
    kcal: metadata.kcal,
    proteinG: metadata.proteinG,
    carbsG: metadata.carbsG,
    fatG: metadata.fatG,
    fiberG: metadata.fiberG,
    sodiumMg: metadata.sodiumMg,
    completeness: metadata.completeness,
    fetchedAt: metadata.fetchedAt
  }
}

export const candidatesFromMetadata = (metadata: readonly FoodMetadata[]) =>
  dedupeFoodCandidates(metadata.map(metadataToCandidate).filter((candidate): candidate is FoodCandidate => candidate != null), {
    confirmedSourceKeys: confirmedKeysFromMetadata(metadata)
  })

export const upsertFoodMetadata = (existing: readonly FoodMetadata[], next: FoodMetadata) => [
  ...existing.filter((item) => item.id !== next.id),
  next
].sort((left, right) => left.id.localeCompare(right.id))

export const recordConfirmedCandidate = (
  entries: readonly ConfirmedFoodCacheEntry[],
  candidate: FoodCandidate,
  options: { query?: string; now?: string } = {}
) => {
  const now = options.now ?? new Date().toISOString()
  const key = foodSourceKey(candidate)
  const previous = entries.find((entry) => foodSourceKey(entry.candidate) === key)
  const next: ConfirmedFoodCacheEntry = {
    candidate,
    queryAliases: uniqueAliases([...(previous?.queryAliases ?? []), candidate.name, candidate.brand ?? '', options.query ?? '']),
    confirmedAt: previous?.confirmedAt ?? now,
    lastUsedAt: now,
    useCount: (previous?.useCount ?? 0) + 1
  }
  return [...entries.filter((entry) => foodSourceKey(entry.candidate) !== key), next]
    .sort((left, right) => left.lastUsedAt === right.lastUsedAt
      ? foodSourceKey(left.candidate).localeCompare(foodSourceKey(right.candidate))
      : right.lastUsedAt.localeCompare(left.lastUsedAt))
}

export const searchConfirmedCache = (
  entries: readonly ConfirmedFoodCacheEntry[],
  query: string,
  context: CandidateRankContext = {},
  limit = 10
) => {
  const normalizedQuery = normalizeFoodText(query)
  const matches = entries.filter((entry) => {
    if (!normalizedQuery) return true
    return entry.queryAliases.some((alias) => alias.includes(normalizedQuery) || normalizedQuery.includes(alias))
  })
  const recentKeys = new Set(matches.slice(0, 10).map((entry) => foodSourceKey(entry.candidate)))
  const frequentKeys = new Set(matches.filter((entry) => entry.useCount >= 3).map((entry) => foodSourceKey(entry.candidate)))
  const rankContext: CandidateRankContext = {
    ...context,
    text: query,
    confirmedSourceKeys: context.confirmedSourceKeys ?? new Set(matches.map((entry) => foodSourceKey(entry.candidate))),
    recentSourceKeys: context.recentSourceKeys ?? recentKeys,
    frequentSourceKeys: context.frequentSourceKeys ?? frequentKeys
  }
  return dedupeFoodCandidates(rankFoodCandidates(matches.map((entry) => entry.candidate), rankContext), rankContext).slice(0, Math.max(0, limit))
}
