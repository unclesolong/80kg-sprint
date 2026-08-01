export type WeightCondition = 'morning_fasted' | 'other'
export type BowelMovement = 'none' | 'yes'
export type SaltLevel = 'normal' | 'high'
export type ThemeMode = 'dark' | 'light'

export interface MealLine {
  key: string
  label: string
  amount: number
  unit: 'g' | 'ml' | '份' | '顆'
  kcalPerUnit: number
  proteinPerUnit: number
}

export interface RamenMeal {
  enabled: boolean
  packageKcal: number
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
  activeKcal?: number
  restingKcal?: number
  exerciseMinutes?: number
  slowJogMinutes?: number
  slowJogActiveKcal?: number
  averageExerciseHeartRate?: number
  steps?: number
  distanceKm?: number
  standingHours?: number
  intakeKcal?: number
  proteinG?: number
  waterMl?: number
  sleepHours?: number
  sleepQuality?: 1 | 2 | 3 | 4 | 5
  hungerLevel?: 1 | 2 | 3 | 4 | 5
  fatigueLevel?: 1 | 2 | 3 | 4 | 5
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
  theme: ThemeMode
  onboarded: boolean
}

export interface CustomFood {
  id: string
  name: string
  basis: '100g' | 'serving'
  kcal: number
  proteinG: number
  defaultAmount: number
}

export interface BackupPayload {
  schemaVersion: 1
  exportedAt: string
  settings: ChallengeSettings
  logs: DailyLog[]
  foods: CustomFood[]
}
