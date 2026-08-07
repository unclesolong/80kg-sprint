export type CalculationSex = 'male' | 'female'
export type WorkActivity = 'sedentary' | 'mixed' | 'standing' | 'physical'
export type GoalPace = 'gentle' | 'standard' | 'aggressive'
export type PlannerStatus = 'draft' | 'active' | 'paused' | 'completed' | 'restricted'
export type SafetyStatus = 'approved' | 'restricted' | 'blocked' | 'needs_confirmation'
export type ConfidenceLevel = 'low' | 'medium' | 'high'

export interface UserProfile {
  id: 'current'
  age: number
  calculationSex: CalculationSex
  heightCm: number
  currentWeightKg: number
  goalWeightKg: number
  averageSteps?: number
  workActivity: WorkActivity
  exerciseSessionsPerWeek: number
  exerciseMinutesPerWeek?: number
  wearable: 'apple_watch' | 'other' | 'none'
  averageRestingEnergyKcal?: number
  averageActiveEnergyKcal?: number
  dietaryPattern?: 'omnivore' | 'vegetarian' | 'vegan' | 'other'
  foodRestrictions: string[]
  goalPace: GoalPace
  locale: 'zh-TW'
  timezone: string
  createdAt: string
  updatedAt: string
}

export interface SafetyScreen {
  id: 'current'
  under18: boolean
  pregnantOrBreastfeeding: boolean
  eatingDisorderHistory: boolean
  diabetesOrGlucoseMedication: boolean
  kidneyDisease: boolean
  seriousCardiovascularDisease: boolean
  weightLossMedication: boolean
  currentInjuryOrPain: boolean
  faintingChestPainOrSevereDizziness: boolean
  purgingLaxativesDiureticsOrForcedExercise: boolean
  answeredAt: string
}

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

export interface SafetyDecision {
  status: SafetyStatus
  reasonCodes: string[]
  userMessages: string[]
  bounds?: SafetyBounds
  limitations: string[]
}

export interface AIComment {
  title: string
  summary: string
  bullets: string[]
  tone: 'supportive' | 'neutral' | 'caution'
}

export interface FatLossPlan {
  id: string
  name: string
  status: PlannerStatus
  startDate: string
  goalWeightKg: number
  createdAt: string
  source: 'manual' | 'ai_assisted' | 'legacy'
  safetyDecisionSnapshot: SafetyDecision
}

export interface PlanVersion {
  id: string
  planId: string
  effectiveFrom: string
  goalDate: string
  calorieTargetKcal: number
  calorieRangeMinKcal: number
  calorieRangeMaxKcal: number
  proteinMinG: number
  proteinMaxG: number
  waterTargetMl: number
  sleepTargetMinHours: number
  aerobicMinutesPerWeek: number
  strengthDaysPerWeek: number
  expectedWeeklyLossKg: number
  eveningReserveKcal: number
  reservedTemplateIds: string[]
  focusTasks: string[]
  comment: AIComment
  createdAt: string
  createdBy: 'manual' | 'ai_assisted'
}

export interface WeeklyAggregate {
  morningWeightCount: number
  intakeDayCount: number
  finalizedDayCount: number
  averageMorningWeightKg?: number
  previousAverageMorningWeightKg?: number
  weightTrendKg?: number
  averageIntakeKcal?: number
  averageProteinG?: number
  averageWaterMl?: number
  averageActiveKcal?: number
  averageSteps?: number
  averageSleepHours?: number
  averageFatigue?: number
  averageHunger?: number
  averagePain?: number
  highSaltMealCount: number
  bowelMovementDays: number
  cumulativeFinalizedDeficitKcal: number
}

export interface WeeklyReview {
  id: string
  planId: string
  weekStart: string
  weekEnd: string
  dataCompleteness: number
  summary: WeeklyAggregate
  currentVersionId: string
  suggestedVersionDraft?: Partial<PlanVersion>
  comment: AIComment
  warnings: string[]
  status: 'draft' | 'reviewed' | 'applied' | 'dismissed'
  createdAt: string
}

export interface PlannerDraft {
  goalDate: string
  calorieTargetKcal: number
  proteinMinG: number
  proteinMaxG: number
  waterTargetMl: number
  aerobicMinutesPerWeek: number
  strengthDaysPerWeek: number
  expectedWeeklyLossKg: number
  eveningReserveKcal: number
  reservedTemplateIds: string[]
  focusTasks: string[]
  comment: AIComment
}

export interface PlannerConsent {
  id: string
  aiEnabled: boolean
  acceptedAt?: string
  withdrawnAt?: string
}

export interface FoodMetadata {
  id: string
  mealLineKey?: string
  source: 'local' | 'bls' | 'usda' | 'open_food_facts' | 'manual' | 'ai_estimate'
  sourceId: string
  fetchedAt: string
}

export interface PlannerSnapshot {
  profile?: UserProfile
  safety?: SafetyScreen
  plans: FatLossPlan[]
  planVersions: PlanVersion[]
  weeklyReviews: WeeklyReview[]
  consents: PlannerConsent[]
  foodMetadata: FoodMetadata[]
}

export interface TdeeEstimate {
  value: number
  confidence: ConfidenceLevel
  source: 'wearable_logs' | 'profile_wearable_average' | 'mifflin'
  sampleCount: number
}
