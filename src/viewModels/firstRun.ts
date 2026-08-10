import type { PlannerSnapshot } from '../planner/types'
import type { ChallengeSettings, CustomFood, DailyLog, MealDetails } from '../types'

const mealKeys: ReadonlyArray<keyof Pick<MealDetails, 'breakfast' | 'lunch' | 'dinner' | 'evening'>> = [
  'breakfast',
  'lunch',
  'dinner',
  'evening'
]

export interface FirstRunCounts {
  dailyLogs: number
  mealLines: number
  foods: number
  plannerPlans: number
  plannerRecords: number
}

export interface FirstRunState {
  isCompletelyEmpty: boolean
  hasCoreHistory: boolean
  hasDailyLogs: boolean
  hasFoods: boolean
  hasPlannerData: boolean
  plannerDataUnavailable: boolean
  shouldShowWelcome: boolean
  shouldBypassLegacyOnboarding: boolean
  counts: FirstRunCounts
}

export interface FirstRunInput {
  settings: Pick<ChallengeSettings, 'onboarded'>
  logs: readonly DailyLog[]
  foods: readonly CustomFood[]
  planner: PlannerSnapshot
  plannerLoadFailed?: boolean
}

const countRecordedMealLines = (logs: readonly DailyLog[]): number => logs.reduce((total, log) => {
  const details = log.mealDetails
  if (!details) return total
  return total + mealKeys.reduce(
    (mealTotal, meal) => mealTotal + (details[meal] ?? []).filter((line) => line.amount > 0).length,
    0
  )
}, 0)

const countPlannerRecords = (planner: PlannerSnapshot): number =>
  Number(Boolean(planner.profile)) +
  Number(Boolean(planner.safety)) +
  planner.plans.length +
  planner.planVersions.length +
  planner.weeklyReviews.length +
  planner.consents.length +
  planner.foodMetadata.length

/**
 * Determines the first-run route without repairing settings or writing storage.
 * Every PlannerSnapshot collection is considered so partial Planner data can
 * never be mistaken for an empty device.
 */
export const buildFirstRunState = ({ settings, logs, foods, planner, plannerLoadFailed = false }: FirstRunInput): FirstRunState => {
  const hasDailyLogs = logs.length > 0
  const hasFoods = foods.length > 0
  const hasCoreHistory = hasDailyLogs || hasFoods
  const plannerRecords = countPlannerRecords(planner)
  const hasPlannerData = plannerRecords > 0
  // A failed Planner read means emptiness cannot be established safely.
  const isCompletelyEmpty = !hasCoreHistory && !hasPlannerData && !plannerLoadFailed
  const legacyOnboardingIncomplete = !settings.onboarded

  return {
    isCompletelyEmpty,
    hasCoreHistory,
    hasDailyLogs,
    hasFoods,
    hasPlannerData,
    plannerDataUnavailable: plannerLoadFailed,
    shouldShowWelcome: legacyOnboardingIncomplete && isCompletelyEmpty,
    shouldBypassLegacyOnboarding: legacyOnboardingIncomplete && !isCompletelyEmpty,
    counts: {
      dailyLogs: logs.length,
      mealLines: countRecordedMealLines(logs),
      foods: foods.length,
      plannerPlans: planner.plans.length,
      plannerRecords
    }
  }
}
