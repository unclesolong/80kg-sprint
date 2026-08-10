import type { PlanVersion } from '../planner/types'
import type { ChallengeSettings } from '../types'

export interface DailyTargetContext {
  date: string
  calories: {
    min: number
    center: number
    max: number
  }
  protein: {
    min: number
    max: number
  }
  waterTargetMl: number
  sleepMinimumHours: number
  activity: {
    minimum: number
    target: number
    maximum: number
  }
}

/**
 * Builds the effective targets for one date without mutating either source.
 * Planner only replaces targets represented by an immutable PlanVersion;
 * the Sprint activity-kcal targets remain the daily activity context.
 */
export const buildDailyTargetContext = (
  date: string,
  settings: ChallengeSettings,
  planVersion?: PlanVersion
): DailyTargetContext => ({
  date,
  calories: planVersion
    ? {
        min: planVersion.calorieRangeMinKcal,
        center: planVersion.calorieTargetKcal,
        max: planVersion.calorieRangeMaxKcal
      }
    : {
        min: settings.intakeKcalMinimum,
        center: (settings.intakeKcalMinimum + settings.intakeKcalMaximum) / 2,
        max: settings.intakeKcalMaximum
      },
  protein: planVersion
    ? { min: planVersion.proteinMinG, max: planVersion.proteinMaxG }
    : { min: settings.proteinMinimumG, max: settings.proteinMaximumG },
  waterTargetMl: planVersion?.waterTargetMl ?? settings.waterMinimumMl,
  sleepMinimumHours: planVersion?.sleepTargetMinHours ?? settings.sleepMinimumHours,
  activity: {
    minimum: settings.activeKcalMinimum,
    target: settings.activeKcalTarget,
    maximum: settings.activeKcalMaximum
  }
})

/** Central compatibility adapter for legacy selectors that still accept settings. */
export const settingsWithDailyTargets = (
  settings: ChallengeSettings,
  targets: DailyTargetContext,
  challenge?: { startDate: string; endDate: string; baselineWeightKg?: number; targetWeightKg?: number }
): ChallengeSettings => ({
  ...settings,
  startDate: challenge?.startDate ?? settings.startDate,
  finalWeighInDate: challenge?.endDate ?? settings.finalWeighInDate,
  baselineWeightKg: challenge?.baselineWeightKg ?? settings.baselineWeightKg,
  targetWeightKg: challenge?.targetWeightKg ?? settings.targetWeightKg,
  intakeKcalMinimum: targets.calories.min,
  intakeKcalMaximum: targets.calories.max,
  proteinMinimumG: targets.protein.min,
  proteinMaximumG: targets.protein.max,
  waterMinimumMl: targets.waterTargetMl,
  sleepMinimumHours: targets.sleepMinimumHours,
  activeKcalMinimum: targets.activity.minimum,
  activeKcalTarget: targets.activity.target,
  activeKcalMaximum: targets.activity.maximum
})
