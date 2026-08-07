export type FoodSource = 'local' | 'bls' | 'usda' | 'open_food_facts' | 'manual' | 'ai_estimate'
export type FoodWeightState = 'raw' | 'cooked' | 'unknown'
export type FoodBasis = '100g' | '100ml' | 'serving'
export type FoodCompleteness = 'complete' | 'partial' | 'calorie_protein_only' | 'estimated'

export interface FoodCandidate {
  source: FoodSource
  sourceId: string
  name: string
  brand?: string
  barcode?: string
  preparation?: string
  weightState?: FoodWeightState
  basis: FoodBasis
  kcal: number
  proteinG?: number
  carbsG?: number
  fatG?: number
  fiberG?: number
  sodiumMg?: number
  completeness: FoodCompleteness
  fetchedAt: string
}

export interface FoodSearchQuery {
  text: string
  barcode?: string
  weightState?: FoodWeightState
  limit?: number
}

export interface FoodDataProvider {
  search(query: FoodSearchQuery): Promise<FoodCandidate[]>
  getById(id: string): Promise<FoodCandidate | null>
  getByBarcode?(barcode: string): Promise<FoodCandidate | null>
}

export interface FoodSearchResponse {
  candidates: FoodCandidate[]
  providers: Array<{ source: FoodSource; status: 'ok' | 'empty' | 'unavailable' }>
  manualEntryAvailable: boolean
}

export interface CandidateRankContext {
  text?: string
  barcode?: string
  weightState?: FoodWeightState
  confirmedSourceKeys?: ReadonlySet<string>
  recentSourceKeys?: ReadonlySet<string>
  frequentSourceKeys?: ReadonlySet<string>
}

export const foodSourceKey = (candidate: Pick<FoodCandidate, 'source' | 'sourceId'>) => `${candidate.source}:${candidate.sourceId}`
