import type { DailyLog } from './types'

const finalizationSensitiveFields = new Set<keyof DailyLog>([
  'activeKcal', 'restingKcal', 'exerciseMinutes', 'steps', 'distanceKm', 'standingHours',
  'averageExerciseHeartRate', 'workouts', 'activityUpdatedAt', 'intakeKcal', 'proteinG',
  'carbsG', 'fatG', 'fiberG', 'sodiumMg', 'mealDetails', 'mealMode', 'foodUpdatedAt',
  'waterMl', 'highSaltMeal', 'dinnerFinishedAt', 'hungerLevel', 'fatigueLevel', 'lowerLegTightness', 'painNotes'
])

export const applyLogPatch = (original: DailyLog, patch: Partial<DailyLog>, now = new Date().toISOString()): DailyLog => {
  const invalidatesFinalization = original.dayFinalized === true && patch.dayFinalized !== true &&
    (Object.keys(patch) as Array<keyof DailyLog>).some((key) => finalizationSensitiveFields.has(key))
  return {
    ...original,
    ...patch,
    ...(invalidatesFinalization ? { dayFinalized: false, finalizedAt: undefined, needsRefinalization: true } : {}),
    id: original.id,
    date: original.date,
    updatedAt: now
  }
}
