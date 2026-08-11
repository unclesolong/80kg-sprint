export type Tone = 'supportive' | 'neutral' | 'caution'

export type SafetyStatus = 'approved' | 'needs_confirmation' | 'restricted' | 'blocked'

export interface NumericRange {
  min: number
  max: number
  recommended: number
}

export interface SafetyBounds {
  dailyCalories: NumericRange
  weeklyLossKg: NumericRange
  weeklyLossPercent: NumericRange
  proteinG: NumericRange
  waterMl: NumericRange
  aerobicMinutesPerWeek: NumericRange
  strengthDaysPerWeek: NumericRange
  earliestGoalDate: string
  recommendedGoalDate: string
  latestSuggestedGoalDate: string
}

export interface SelectedTargets {
  calorieTargetKcal: number
  proteinMinG: number
  proteinMaxG: number
  waterTargetMl: number
  expectedWeeklyLossKg: number
  aerobicMinutesPerWeek: number
  strengthDaysPerWeek: number
  eveningReserveKcal: number
}

export interface DailyEnergyPlan {
  restingEnergyKcal: number
  activeEnergyKcal: number
  estimatedTdeeKcal: number
  source: 'wearable_logs' | 'profile_wearable_average' | 'mifflin'
  confidence: 'low' | 'medium' | 'high'
  sampleCount: number
}

export interface AIComment {
  title: string
  summary: string
  bullets: string[]
  tone: Tone
}

export interface PlanAIOutput {
  schemaVersion: 1
  status: 'ok' | 'needs_more_data' | 'restricted'
  selectedTargets: SelectedTargets
  energyPlan: DailyEnergyPlan
  focusTasks: string[]
  comment: AIComment
  assumptions: Array<{ code: string; text: string }>
  warnings: Array<{ code: string; text: string }>
}

export interface WeeklyReviewAIOutput {
  schemaVersion: 1
  decision:
    | 'maintain'
    | 'increase_calories'
    | 'decrease_calories'
    | 'improve_data_first'
    | 'recovery_priority'
    | 'restricted'
  calorieAdjustmentKcal: -150 | -100 | 0 | 100 | 150
  activityAdjustment: {
    aerobicMinutesDelta: number
    strengthDaysDelta: number
  }
  focusTasks: string[]
  comment: AIComment
  warnings: string[]
}

export interface FoodParseItem {
  rawText: string
  normalizedName: string
  amount: number | null
  unit: 'g' | 'ml' | '份' | '顆' | null
  preparation: string | null
  weightState: 'raw' | 'cooked' | 'unknown'
  brand: string | null
  searchTerms: string[]
  needsConfirmation: boolean
  confirmationQuestion: string | null
}

export interface FoodParseOutput {
  schemaVersion: 1
  items: FoodParseItem[]
  unparsedText: string[]
}

export interface SafetyRequestSnapshot {
  status: SafetyStatus
  bounds: SafetyBounds | null
  limitations: string[]
  kidneyDisease: boolean
  currentInjuryOrPain: boolean
  painLevel: number | null
}

export interface PlanGenerateRequest {
  profile: {
    age: number
    calculationSex: 'male' | 'female'
    heightCm: number
    currentWeightKg: number
    goalWeightKg: number
    averageSteps: number | null
    workActivity: 'sedentary' | 'mixed' | 'standing' | 'physical'
    exerciseSessionsPerWeek: number
    exerciseMinutesPerWeek: number | null
    dietaryPattern: 'omnivore' | 'vegetarian' | 'vegan' | 'other'
    locale: 'zh-TW'
  }
  goalDate: string | null
  safety: SafetyRequestSnapshot
  localRecommendation: {
    selectedTargets: SelectedTargets
    energyPlan: DailyEnergyPlan
    focusTasks: string[]
  }
}

export interface WeeklyReviewRequest {
  weekStart: string
  weekEnd: string
  dataCompleteness: number
  summary: {
    averageWeightKg: number | null
    weightChangeKg: number | null
    averageIntakeKcal: number | null
    averageProteinG: number | null
    averageWaterMl: number | null
    averageActiveEnergyKcal: number | null
    painMax: number | null
    completedDays: number
  }
  currentVersion: SelectedTargets
  safety: SafetyRequestSnapshot
}

export interface FoodParseRequest {
  text: string
  locale: 'zh-TW'
}

export interface FoodSearchRequest {
  query: string
  barcode: string | null
  limit: number
  locale: 'zh-TW'
}

export type FoodSource =
  | 'local'
  | 'bls'
  | 'usda'
  | 'open_food_facts'
  | 'manual'
  | 'ai_estimate'

export interface FoodSearchQuery {
  text: string
  barcode?: string
  limit: number
  locale: 'zh-TW'
}

export interface FoodCandidate {
  source: FoodSource
  sourceId: string
  name: string
  brand?: string
  barcode?: string
  preparation?: string
  weightState?: 'raw' | 'cooked' | 'unknown'
  basis: '100g' | '100ml' | 'serving'
  kcal: number
  proteinG?: number
  carbsG?: number
  fatG?: number
  fiberG?: number
  sodiumMg?: number
  completeness: 'complete' | 'partial' | 'calorie_protein_only' | 'estimated'
  fetchedAt: string
}

export interface Env {
  OPENAI_API_KEY?: string
  OPENAI_MODEL_PLANNER?: string
  OPENAI_MODEL_PARSER?: string
  OPENAI_TIMEOUT_MS?: string
  USDA_API_KEY?: string
  BLS_API_BASE_URL?: string
  FOOD_PROVIDER_USER_AGENT?: string
  ALLOWED_ORIGINS?: string
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: string[] }

export interface WorkerDependencies {
  fetch: typeof fetch
  now: () => number
  randomUUID: () => string
}
