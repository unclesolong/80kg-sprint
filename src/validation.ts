import type { BackupPayload, ChallengeSettings, DailyLog } from './types'

const isNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
const isDate = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)

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
    (item.theme === 'dark' || item.theme === 'light') && typeof item.onboarded === 'boolean'
}

export const isValidLog = (value: unknown): value is DailyLog => {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  if (typeof item.id !== 'string' || !isDate(item.date) || typeof item.createdAt !== 'string' || typeof item.updatedAt !== 'string') return false
  const numericFields = ['weightKg', 'waistCm', 'activeKcal', 'restingKcal', 'exerciseMinutes', 'slowJogMinutes', 'averageExerciseHeartRate', 'steps', 'standingHours', 'intakeKcal', 'proteinG', 'waterMl', 'sleepHours']
  return numericFields.every((field) => item[field] == null || isNumber(item[field]))
}

export const validateBackup = (value: unknown): value is BackupPayload => {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return item.schemaVersion === 1 && typeof item.exportedAt === 'string' &&
    isValidSettings(item.settings) && Array.isArray(item.logs) && item.logs.every(isValidLog) &&
    Array.isArray(item.foods)
}
