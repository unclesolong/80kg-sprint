import type { PlanVersion } from '../planner/types'
import type { ChallengeSettings, GuidanceMode } from '../types'

export interface DailyTargetContext {
  date: string
  mode: GuidanceMode
  guidance: {
    calories: boolean
    protein: boolean
    water: boolean
    sleep: boolean
    activity: boolean
  }
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
 * older stored targets remain available solely through compatibility mode.
 */
export const buildDailyTargetContext = (
  date: string,
  settings: ChallengeSettings,
  planVersion?: PlanVersion
): DailyTargetContext => {
  const settingsMode: GuidanceMode = settings.guidanceMode ?? (settings.onboarded ? 'legacy_targets' : 'tracking_only')
  const mode: GuidanceMode = planVersion ? 'planner' : settingsMode
  const legacyGuidance = mode === 'legacy_targets'
  const planGuidance = mode === 'planner'
  const energyPlan = planVersion?.energyPlan

  return {
  date,
  mode,
  guidance: {
    calories: legacyGuidance || planGuidance,
    protein: legacyGuidance || planGuidance,
    water: legacyGuidance || planGuidance,
    sleep: legacyGuidance || planGuidance,
    // Old PlanVersion rows did not contain a device-energy plan. Do not turn
    // unrelated compatibility numbers into an activity prescription.
    activity: legacyGuidance || Boolean(energyPlan)
  },
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
  activity: energyPlan
    ? {
        minimum: energyPlan.activeEnergyKcal,
        target: energyPlan.activeEnergyKcal,
        maximum: energyPlan.activeEnergyKcal
      }
    : {
        minimum: settings.activeKcalMinimum,
        target: settings.activeKcalTarget,
        maximum: settings.activeKcalMaximum
      }
  }
}

/** Central compatibility adapter for legacy selectors that still accept settings. */
export const settingsWithDailyTargets = (
  settings: ChallengeSettings,
  targets: DailyTargetContext,
  challenge?: { startDate: string; endDate: string; baselineWeightKg?: number; targetWeightKg?: number }
): ChallengeSettings => ({
  ...settings,
  guidanceMode: targets.mode,
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
  activeKcalMinimum: targets.guidance.activity ? targets.activity.minimum : 0,
  activeKcalTarget: targets.guidance.activity ? targets.activity.target : 0,
  activeKcalMaximum: targets.guidance.activity ? targets.activity.maximum : 0
})
