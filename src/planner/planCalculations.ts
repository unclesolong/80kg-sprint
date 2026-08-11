import { effectiveActiveKcal } from '../calculations'
import type { DailyLog } from '../types'
import type { DailyEnergyPlan, GoalPace, NumericRange, PlannerDraft, SafetyBounds, TdeeEstimate, UserProfile } from './types'

export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)
export const roundTo50 = (value: number) => Math.round(value / 50) * 50
export const roundTo100 = (value: number) => Math.round(value / 100) * 100
export const roundTo5 = (value: number) => Math.round(value / 5) * 5

export const calculateBmr = (profile: Pick<UserProfile, 'calculationSex' | 'currentWeightKg' | 'heightCm' | 'age'>) =>
  Math.round(10 * profile.currentWeightKg + 6.25 * profile.heightCm - 5 * profile.age + (profile.calculationSex === 'male' ? 5 : -161))

const activityFactor = (profile: Pick<UserProfile, 'workActivity' | 'exerciseSessionsPerWeek'>) => {
  const base = { sedentary: 1.25, mixed: 1.35, standing: 1.45, physical: 1.55 }[profile.workActivity]
  return clamp(base + Math.min(profile.exerciseSessionsPerWeek, 5) * 0.015, 1.2, 1.65)
}

const trimmedMean = (values: number[]) => {
  const ordered = [...values].sort((a, b) => a - b)
  const trim = ordered.length >= 10 ? Math.floor(ordered.length * 0.1) : 0
  const sample = trim ? ordered.slice(trim, -trim) : ordered
  return sample.reduce((sum, value) => sum + value, 0) / sample.length
}

/**
 * Wearable averages are optional, but a partial or out-of-range set must not
 * reach the energy calculation. HTML min/max attributes alone do not protect
 * button-driven onboarding or imported/programmatically supplied values.
 */
export const hasValidWearableEnergyInput = (profile: Pick<UserProfile,
  'wearable' | 'averageRestingEnergyKcal' | 'averageActiveEnergyKcal' | 'wearableObservationDays'
>): boolean => {
  if (profile.wearable === 'none') return true
  const resting = profile.averageRestingEnergyKcal
  const active = profile.averageActiveEnergyKcal
  const days = profile.wearableObservationDays
  if (resting == null && active == null && days == null) return true
  return resting != null
    && Number.isFinite(resting)
    && resting >= 500
    && resting <= 5_000
    && active != null
    && Number.isFinite(active)
    && active >= 0
    && active <= 3_000
    && days != null
    && Number.isInteger(days)
    && days >= 1
    && days <= 30
}

export const deriveDailyEnergyPlan = (profile: UserProfile, logs: DailyLog[]): DailyEnergyPlan => {
  const wearableDays = logs
    .filter((log) => log.restingKcal != null && effectiveActiveKcal(log) != null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 14)
    .map((log) => ({ resting: log.restingKcal!, active: effectiveActiveKcal(log)! }))
  if (wearableDays.length >= 7) {
    const restingEnergyKcal = roundTo50(trimmedMean(wearableDays.map((day) => day.resting)))
    const activeEnergyKcal = roundTo50(trimmedMean(wearableDays.map((day) => day.active)))
    return { restingEnergyKcal, activeEnergyKcal, estimatedTdeeKcal: restingEnergyKcal + activeEnergyKcal, confidence: wearableDays.length >= 14 ? 'high' : 'medium', source: 'wearable_logs', sampleCount: wearableDays.length }
  }
  if (profile.wearable !== 'none' && hasValidWearableEnergyInput(profile) && profile.averageRestingEnergyKcal != null && profile.averageActiveEnergyKcal != null) {
    const restingEnergyKcal = roundTo50(profile.averageRestingEnergyKcal)
    const activeEnergyKcal = roundTo50(profile.averageActiveEnergyKcal)
    const sampleCount = Math.max(0, Math.round(profile.wearableObservationDays ?? 0))
    return { restingEnergyKcal, activeEnergyKcal, estimatedTdeeKcal: restingEnergyKcal + activeEnergyKcal, confidence: 'medium', source: 'profile_wearable_average', sampleCount }
  }
  const restingEnergyKcal = roundTo50(calculateBmr(profile))
  const estimatedTdeeKcal = roundTo50(calculateBmr(profile) * activityFactor(profile))
  return { restingEnergyKcal, activeEnergyKcal: Math.max(0, estimatedTdeeKcal - restingEnergyKcal), estimatedTdeeKcal, confidence: 'low', source: 'mifflin', sampleCount: 0 }
}

export const deriveTdeeEstimate = (profile: UserProfile, logs: DailyLog[]): TdeeEstimate => {
  const energy = deriveDailyEnergyPlan(profile, logs)
  return { value: energy.estimatedTdeeKcal, confidence: energy.confidence, source: energy.source, sampleCount: energy.sampleCount }
}

export const minimumSelfServeCalories = (profile: UserProfile) =>
  roundTo50(Math.max(profile.calculationSex === 'male' ? 1500 : 1200, calculateBmr(profile) * 0.8))

const addDays = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

const range = (min: number, max: number, recommended: number): NumericRange => ({ min, max, recommended: clamp(recommended, min, max) })

export const calculateSafetyBounds = (profile: UserProfile, logs: DailyLog[], startDate: string): SafetyBounds => {
  const tdee = deriveTdeeEstimate(profile, logs).value
  const calorieMinimum = minimumSelfServeCalories(profile)
  const deficitRate = profile.goalPace === 'gentle' ? 0.12 : profile.goalPace === 'aggressive' ? 0.2 : 0.16
  const calorieRecommended = roundTo50(Math.max(calorieMinimum, tdee - Math.min(750, tdee * deficitRate)))
  const calorieRangeMin = roundTo50(Math.max(calorieMinimum, tdee * 0.75))
  const calorieRangeMax = roundTo50(Math.max(calorieRangeMin, tdee * 0.9))
  const minLossKg = Math.max(0.1, Math.round(profile.currentWeightKg * 0.0025 * 10) / 10)
  const maxLossKg = Math.round(Math.min(profile.currentWeightKg * 0.01, 0.9) * 10) / 10
  const pacePercent = profile.goalPace === 'gentle' ? 0.0035 : profile.goalPace === 'aggressive' ? 0.0075 : 0.005
  const recommendedLossKg = Math.round(clamp(profile.currentWeightKg * pacePercent, minLossKg, maxLossKg) * 10) / 10
  const difference = Math.max(0, profile.currentWeightKg - profile.goalWeightKg)
  const earliestWeeks = Math.max(1, Math.ceil(difference / Math.max(maxLossKg, 0.1)))
  const recommendedWeeks = Math.max(earliestWeeks, Math.ceil(difference / Math.max(recommendedLossKg, 0.1)))
  const latestWeeks = Math.max(earliestWeeks, Math.ceil(difference / Math.max(minLossKg, 0.1)))
  const referenceWeight = Math.min(profile.currentWeightKg, Math.max(profile.goalWeightKg, profile.currentWeightKg * 0.8))
  const proteinMin = clamp(roundTo5(referenceWeight * 1.6), 60, 220)
  const proteinMax = clamp(roundTo5(referenceWeight * 2), proteinMin, 240)
  const currentMinutes = profile.exerciseMinutesPerWeek ?? profile.exerciseSessionsPerWeek * 40
  const aerobicRecommended = roundTo5(clamp(currentMinutes * 1.1 || 75, 60, 180))
  const strengthRecommended = clamp(Math.max(profile.exerciseSessionsPerWeek > 0 ? 1 : 0, 2), 0, 4)
  return {
    dailyCalories: range(calorieRangeMin, calorieRangeMax, calorieRecommended),
    weeklyLossKg: range(minLossKg, maxLossKg, recommendedLossKg),
    weeklyLossPercent: range(0.25, 1, pacePercent * 100),
    proteinG: range(proteinMin, proteinMax, roundTo5((proteinMin + proteinMax) / 2)),
    waterMl: range(1800, 3500, roundTo100(clamp(profile.currentWeightKg * 30, 1800, 3500))),
    aerobicMinutesPerWeek: range(Math.max(0, roundTo5(currentMinutes * 0.9)), Math.max(90, roundTo5(currentMinutes * 1.15 + 30)), aerobicRecommended),
    strengthDaysPerWeek: range(0, Math.min(4, Math.max(2, profile.exerciseSessionsPerWeek + 1)), strengthRecommended),
    earliestGoalDate: addDays(startDate, earliestWeeks * 7),
    recommendedGoalDate: addDays(startDate, recommendedWeeks * 7),
    latestSuggestedGoalDate: addDays(startDate, latestWeeks * 7)
  }
}

const fallbackEnergyPlanFromBounds = (bounds: SafetyBounds): DailyEnergyPlan => {
  const estimatedTdeeKcal = roundTo50(Math.max(bounds.dailyCalories.max, bounds.dailyCalories.recommended) / 0.9)
  const restingEnergyKcal = roundTo50(estimatedTdeeKcal * 0.75)
  return { restingEnergyKcal, activeEnergyKcal: estimatedTdeeKcal - restingEnergyKcal, estimatedTdeeKcal, source: 'mifflin', confidence: 'low', sampleCount: 0 }
}

export const createLocalPlanDraft = (bounds: SafetyBounds, pace: GoalPace, energyPlan: DailyEnergyPlan = fallbackEnergyPlanFromBounds(bounds)): PlannerDraft => ({
  goalDate: pace === 'aggressive' ? bounds.earliestGoalDate : pace === 'gentle' ? bounds.latestSuggestedGoalDate : bounds.recommendedGoalDate,
  calorieTargetKcal: bounds.dailyCalories.recommended,
  energyPlan: { ...energyPlan },
  proteinMinG: bounds.proteinG.min,
  proteinMaxG: bounds.proteinG.max,
  waterTargetMl: bounds.waterMl.recommended,
  aerobicMinutesPerWeek: bounds.aerobicMinutesPerWeek.recommended,
  strengthDaysPerWeek: bounds.strengthDaysPerWeek.recommended,
  expectedWeeklyLossKg: bounds.weeklyLossKg.recommended,
  eveningReserveKcal: 0,
  reservedTemplateIds: [],
  focusTasks: ['穩定記錄飲食與活動', '依每週趨勢再調整目標'],
  comment: {
    title: '先建立可持續的安全節奏',
    summary: '這份本地計畫依你的基本資料、活動量與安全邊界計算；所有數字都可以在允許範圍內調整。',
    bullets: ['熱量不低於自助模式保護值', '活動量採逐步增加', '每週依完整紀錄再檢討'],
    tone: 'supportive'
  }
})

export const dinnerMainBudget = (targetKcal: number, loggedIntakeKcal: number | undefined, reserveKcal: number, reserveAlreadyLogged: boolean) => {
  const remainingCalories = targetKcal - (loggedIntakeKcal ?? 0)
  const unconsumedReserve = reserveAlreadyLogged ? 0 : reserveKcal
  return Math.max(0, Math.round(remainingCalories - unconsumedReserve))
}

export const validateGoalDate = (requestedDate: string, bounds: SafetyBounds) => ({
  valid: requestedDate >= bounds.earliestGoalDate,
  requestedDate,
  suggestedDate: requestedDate < bounds.earliestGoalDate ? bounds.earliestGoalDate : requestedDate
})
