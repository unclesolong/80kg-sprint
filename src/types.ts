import type { GrowthSnapshot } from './growth/types'

export type WeightCondition = 'morning_fasted' | 'other'
export type BowelMovement = 'unrecorded' | 'none' | 'yes'
export type SaltLevel = 'normal' | 'high'
export type ThemeMode = 'dark' | 'light'
export type GuidanceMode = 'tracking_only' | 'legacy_targets' | 'planner'
export type WorkoutType = 'walk' | 'slow_jog' | 'run' | 'strength' | 'cycling' | 'other'
export type WorkoutSource = 'apple_watch' | 'manual'
export type WorkoutActivityKcalMode = 'included_in_daily_total' | 'add_to_daily_total'
export type RecordStage = 'morning' | 'food' | 'evening'

export interface MealLine {
  key: string
  label: string
  amount: number
  unit: 'g' | 'ml' | '份' | '顆'
  kcalPerUnit: number
  proteinPerUnit: number
  carbsPerUnit?: number
  fatPerUnit?: number
  fiberPerUnit?: number
  sodiumPerUnit?: number
  /** Optional display name for one serving, for example "便當". */
  portionLabel?: string
  /** Identifies a complete quick template so duplicate taps can be detected. */
  templateId?: string
}

export interface WorkoutEntry {
  id: string
  type: WorkoutType
  title: string
  startTime?: string
  durationMinutes: number
  activeKcal?: number
  totalKcal?: number
  distanceKm?: number
  averageHeartRate?: number
  maxHeartRate?: number
  perceivedExertion?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
  muscleGroup?: string
  sets?: number
  reps?: number
  weightKg?: number
  rir?: number
  source: WorkoutSource
  /** Missing on legacy records means the workout is already included. */
  activityKcalMode?: WorkoutActivityKcalMode
  notes?: string
}

export interface RamenMeal {
  enabled: boolean
  packageKcal: number
  packageProteinG?: number
  packageCarbsG?: number
  packageFatG?: number
  packageSodiumMg?: number
  noodleRatio: number
  seasoningRatio: number
  oilRatio: number
  drankSoup: boolean
  chickenG: number
  vegetablesG: number
}

export interface MealDetails {
  breakfast: MealLine[]
  lunch: MealLine[]
  dinner: MealLine[]
  evening: MealLine[]
  ramen: RamenMeal
}

export interface DailyLog {
  id: string
  date: string
  weightKg?: number
  weightCondition?: WeightCondition
  waistCm?: number
  /** The latest wearable-device or manually entered daily activity snapshot. */
  activeKcal?: number
  activityUpdatedAt?: string
  foodUpdatedAt?: string
  restingKcal?: number
  exerciseMinutes?: number
  slowJogMinutes?: number
  slowJogActiveKcal?: number
  averageExerciseHeartRate?: number
  steps?: number
  distanceKm?: number
  standingHours?: number
  restingHeartRate?: number
  heartRateVariabilityMs?: number
  workouts?: WorkoutEntry[]
  intakeKcal?: number
  proteinG?: number
  carbsG?: number
  fatG?: number
  fiberG?: number
  sodiumMg?: number
  waterMl?: number
  sleepHours?: number
  sleepStartedAt?: string
  sleepEndedAt?: string
  sleepQuality?: 1 | 2 | 3 | 4 | 5
  hungerLevel?: 1 | 2 | 3 | 4 | 5
  fatigueLevel?: 1 | 2 | 3 | 4 | 5
  lowerLegTightness?: 0 | 1 | 2 | 3 | 4 | 5
  painNotes?: string
  bowelMovement?: BowelMovement
  bristolType?: 1 | 2 | 3 | 4 | 5 | 6 | 7
  highSaltMeal?: boolean
  creatineTaken?: boolean
  breakfastPlanCompleted?: boolean
  lunchPlateCompleted?: boolean
  dinnerPlateCompleted?: boolean
  soyChiaCompleted?: boolean
  dinnerFinishedAt?: string
  notes?: string
  mealMode?: 'quick' | 'detailed'
  mealDetails?: MealDetails
  dayFinalized?: boolean
  finalizedAt?: string
  needsRefinalization?: boolean
  createdAt: string
  updatedAt: string
}

export interface ChallengeSettings {
  startDate: string
  finalWeighInDate: string
  baselineWeightKg: number
  targetWeightKg: number
  heightCm: number
  activeKcalTarget: number
  activeKcalMinimum: number
  activeKcalMaximum: number
  intakeKcalMinimum: number
  intakeKcalMaximum: number
  proteinMinimumG: number
  proteinMaximumG: number
  waterMinimumMl: number
  waterMaximumMl: number
  sleepMinimumHours: number
  stepsMinimum: number
  stepsMaximum: number
  exerciseMinutesMinimum: number
  exerciseMinutesMaximum: number
  foodTemplates?: FoodTemplate[]
  /**
   * Optional for backwards-compatible v1 backups. Missing values are resolved
   * by migrateSettings: completed legacy setups keep their historical targets,
   * while a fresh setup starts in tracking-only mode until a plan is confirmed.
   */
  guidanceMode?: GuidanceMode
  theme: ThemeMode
  onboarded: boolean
}

export interface FoodTemplate {
  id: string
  name: string
  description: string
  meal: 'breakfast' | 'lunch' | 'dinner' | 'evening'
  quick?: boolean
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
  fiberG: number
  sodiumMg: number
}

export interface CustomFood {
  id: string
  name: string
  basis: '100g' | 'serving'
  kcal: number
  proteinG: number
  carbsG?: number
  fatG?: number
  fiberG?: number
  sodiumMg?: number
  defaultAmount: number
}

export interface BackupPayload {
  schemaVersion: 1
  exportedAt: string
  settings: ChallengeSettings
  logs: DailyLog[]
  foods: CustomFood[]
  growth?: GrowthSnapshot
}
