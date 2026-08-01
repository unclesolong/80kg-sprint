import type { BackupPayload, ChallengeSettings, CustomFood, DailyLog, FoodTemplate, MealDetails, MealLine, WorkoutEntry } from './types'

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const isNonNegative = (value: unknown): value is number => isNumber(value) && value >= 0
const isDate = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
const optionalNonNegative = (value: unknown) => value == null || isNonNegative(value)
const isTimestamp = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value))
const optionalTimestamp = (value: unknown) => value == null || isTimestamp(value)

const isValidMealLine = (value: unknown): value is MealLine => {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.key === 'string' && typeof item.label === 'string' && item.label.length <= 160 &&
    isNonNegative(item.amount) && ['g', 'ml', '份', '顆'].includes(String(item.unit)) &&
    isNonNegative(item.kcalPerUnit) && isNonNegative(item.proteinPerUnit) &&
    ['carbsPerUnit', 'fatPerUnit', 'fiberPerUnit', 'sodiumPerUnit'].every((field) => optionalNonNegative(item[field]))
}

const isValidMealDetails = (value: unknown): value is MealDetails => {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  if (!['breakfast', 'lunch', 'dinner', 'evening'].every((key) => Array.isArray(item[key]) && (item[key] as unknown[]).every(isValidMealLine))) return false
  if (!item.ramen || typeof item.ramen !== 'object') return false
  const ramen = item.ramen as Record<string, unknown>
  return typeof ramen.enabled === 'boolean' && isNonNegative(ramen.packageKcal) &&
    ['packageProteinG', 'packageCarbsG', 'packageFatG', 'packageSodiumMg'].every((field) => optionalNonNegative(ramen[field])) &&
    ['noodleRatio', 'seasoningRatio', 'oilRatio', 'chickenG', 'vegetablesG'].every((field) => isNonNegative(ramen[field])) &&
    typeof ramen.drankSoup === 'boolean'
}

const isValidWorkout = (value: unknown): value is WorkoutEntry => {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  const types = ['walk', 'slow_jog', 'run', 'strength', 'cycling', 'other']
  const numeric = ['activeKcal', 'totalKcal', 'distanceKm', 'averageHeartRate', 'maxHeartRate', 'muscleGroup', 'sets', 'reps', 'weightKg', 'rir']
  return typeof item.id === 'string' && types.includes(String(item.type)) && typeof item.title === 'string' && item.title.length <= 160 &&
    isNonNegative(item.durationMinutes) && (item.source === 'apple_watch' || item.source === 'manual') &&
    numeric.filter((field) => field !== 'muscleGroup').every((field) => optionalNonNegative(item[field])) &&
    (item.muscleGroup == null || typeof item.muscleGroup === 'string') &&
    (item.activityKcalMode == null || item.activityKcalMode === 'included_in_daily_total' || item.activityKcalMode === 'add_to_daily_total') &&
    (item.perceivedExertion == null || (isNumber(item.perceivedExertion) && item.perceivedExertion >= 1 && item.perceivedExertion <= 10)) &&
    (item.notes == null || (typeof item.notes === 'string' && item.notes.length <= 5000))
}

const isValidFood = (value: unknown): value is CustomFood => {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string' && typeof item.name === 'string' && item.name.length > 0 && item.name.length <= 160 &&
    (item.basis === '100g' || item.basis === 'serving') && isNonNegative(item.kcal) && isNonNegative(item.proteinG) &&
    ['carbsG', 'fatG', 'fiberG', 'sodiumMg'].every((field) => optionalNonNegative(item[field])) && isNonNegative(item.defaultAmount)
}

const isValidFoodTemplate = (value: unknown): value is FoodTemplate => {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string' && typeof item.name === 'string' && item.name.length > 0 && item.name.length <= 160 &&
    typeof item.description === 'string' && item.description.length <= 500 &&
    ['breakfast', 'lunch', 'dinner', 'evening'].includes(String(item.meal)) &&
    (item.quick == null || typeof item.quick === 'boolean') &&
    ['kcal', 'proteinG', 'carbsG', 'fatG', 'fiberG', 'sodiumMg'].every((field) => isNonNegative(item[field]))
}

export const isValidSettings = (value: unknown): value is ChallengeSettings => {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return isDate(item.startDate) && isDate(item.finalWeighInDate) &&
    isNumber(item.baselineWeightKg) && isNumber(item.targetWeightKg) && isNumber(item.heightCm) &&
    isNumber(item.activeKcalTarget) && isNumber(item.activeKcalMinimum) && isNumber(item.activeKcalMaximum) &&
    isNumber(item.intakeKcalMinimum) && isNumber(item.intakeKcalMaximum) &&
    isNumber(item.proteinMinimumG) && isNumber(item.proteinMaximumG) &&
    isNumber(item.waterMinimumMl) && isNumber(item.waterMaximumMl) &&
    isNumber(item.sleepMinimumHours) && isNumber(item.stepsMinimum) && isNumber(item.stepsMaximum) &&
    isNumber(item.exerciseMinutesMinimum) && isNumber(item.exerciseMinutesMaximum) &&
    (item.foodTemplates == null || (Array.isArray(item.foodTemplates) && item.foodTemplates.every(isValidFoodTemplate))) &&
    (item.theme === 'dark' || item.theme === 'light') && typeof item.onboarded === 'boolean'
}

export const isValidLog = (value: unknown): value is DailyLog => {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  if (typeof item.id !== 'string' || !isDate(item.date) || typeof item.createdAt !== 'string' || typeof item.updatedAt !== 'string') return false
  const numericFields = ['weightKg', 'waistCm', 'activeKcal', 'restingKcal', 'exerciseMinutes', 'slowJogMinutes', 'slowJogActiveKcal', 'averageExerciseHeartRate', 'steps', 'distanceKm', 'standingHours', 'restingHeartRate', 'heartRateVariabilityMs', 'intakeKcal', 'proteinG', 'carbsG', 'fatG', 'fiberG', 'sodiumMg', 'waterMl', 'sleepHours']
  return numericFields.every((field) => optionalNonNegative(item[field])) &&
    optionalTimestamp(item.activityUpdatedAt) && optionalTimestamp(item.foodUpdatedAt) && optionalTimestamp(item.finalizedAt) &&
    (item.dayFinalized == null || typeof item.dayFinalized === 'boolean') &&
    (item.needsRefinalization == null || typeof item.needsRefinalization === 'boolean') &&
    (item.lowerLegTightness == null || (isNumber(item.lowerLegTightness) && Number.isInteger(item.lowerLegTightness) && item.lowerLegTightness >= 0 && item.lowerLegTightness <= 5)) &&
    (item.painNotes == null || (typeof item.painNotes === 'string' && item.painNotes.length <= 5000)) &&
    (item.bowelMovement == null || ['unrecorded', 'none', 'yes'].includes(String(item.bowelMovement))) &&
    (item.workouts == null || (Array.isArray(item.workouts) && item.workouts.every(isValidWorkout))) &&
    (item.mealDetails == null || isValidMealDetails(item.mealDetails))
}

export const validateBackup = (value: unknown): value is BackupPayload => {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return item.schemaVersion === 1 && typeof item.exportedAt === 'string' &&
    isValidSettings(item.settings) && Array.isArray(item.logs) && item.logs.every(isValidLog) &&
    Array.isArray(item.foods) && item.foods.every(isValidFood)
}
