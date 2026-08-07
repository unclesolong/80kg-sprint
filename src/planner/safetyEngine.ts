import type { DailyLog } from '../types'
import { calculateSafetyBounds } from './planCalculations'
import { SELF_SERVE_BLOCKED_MESSAGE, safetyReasonMessages } from './safetyMessages'
import type { PlanVersion, SafetyDecision, SafetyScreen, UserProfile } from './types'

export const bmi = (weightKg: number, heightCm: number) => weightKg / ((heightCm / 100) ** 2)

export const evaluateSafety = (profile: UserProfile, screen: SafetyScreen, logs: DailyLog[], startDate: string): SafetyDecision => {
  const blocked: string[] = []
  const restricted: string[] = []
  const limitations: string[] = []
  if (profile.age < 18 || screen.under18) blocked.push('under_18')
  if (screen.pregnantOrBreastfeeding) blocked.push('pregnant_or_breastfeeding')
  if (screen.faintingChestPainOrSevereDizziness) blocked.push('acute_symptoms')
  if (screen.purgingLaxativesDiureticsOrForcedExercise) blocked.push('compensatory_behaviour')
  if (bmi(profile.goalWeightKg, profile.heightCm) < 18.5) blocked.push('goal_bmi_low')
  if (bmi(profile.currentWeightKg, profile.heightCm) < 18.5 && profile.goalWeightKg < profile.currentWeightKg) blocked.push('currently_underweight')
  if (screen.eatingDisorderHistory) restricted.push('eating_disorder_history')
  if (screen.diabetesOrGlucoseMedication || screen.kidneyDisease || screen.seriousCardiovascularDisease || screen.weightLossMedication) restricted.push('high_risk_condition')
  const latestPain = [...logs].filter((log) => log.lowerLegTightness != null).sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.lowerLegTightness ?? 0
  if (screen.currentInjuryOrPain || latestPain >= 2) limitations.push('current_injury')
  const reasonCodes = [...new Set([...blocked, ...restricted, ...limitations])]
  if (blocked.length) return { status: 'blocked', reasonCodes, userMessages: [SELF_SERVE_BLOCKED_MESSAGE, ...reasonCodes.map((code) => safetyReasonMessages[code])], limitations }
  if (restricted.length) return { status: 'restricted', reasonCodes, userMessages: [SELF_SERVE_BLOCKED_MESSAGE, ...reasonCodes.map((code) => safetyReasonMessages[code])], limitations }
  const bounds = calculateSafetyBounds(profile, logs, startDate)
  if (screen.currentInjuryOrPain || latestPain >= 2) {
    bounds.aerobicMinutesPerWeek.max = Math.min(bounds.aerobicMinutesPerWeek.max, Math.max(bounds.aerobicMinutesPerWeek.min, profile.exerciseMinutesPerWeek ?? 90))
    bounds.aerobicMinutesPerWeek.recommended = Math.min(bounds.aerobicMinutesPerWeek.recommended, bounds.aerobicMinutesPerWeek.max)
  }
  return {
    status: screen.currentInjuryOrPain || latestPain >= 2 ? 'needs_confirmation' : 'approved',
    reasonCodes,
    userMessages: screen.currentInjuryOrPain || latestPain >= 2 ? [safetyReasonMessages.current_injury] : ['安全篩檢完成；計畫數字仍是一般估算，不是醫療建議。'],
    bounds,
    limitations
  }
}

export const validatePlanVersionAgainstDecision = (version: Pick<PlanVersion, 'calorieTargetKcal' | 'proteinMinG' | 'proteinMaxG' | 'waterTargetMl' | 'aerobicMinutesPerWeek' | 'strengthDaysPerWeek' | 'expectedWeeklyLossKg'>, decision: SafetyDecision) => {
  const violations: string[] = []
  const bounds = decision.bounds
  if (!bounds || decision.status === 'blocked' || decision.status === 'restricted') return { valid: false, violations: ['safety_status'] }
  const within = (value: number, min: number, max: number) => value >= min && value <= max
  if (!within(version.calorieTargetKcal, bounds.dailyCalories.min, bounds.dailyCalories.max)) violations.push('calorie_target')
  if (!within(version.proteinMinG, bounds.proteinG.min, bounds.proteinG.max) || !within(version.proteinMaxG, version.proteinMinG, bounds.proteinG.max)) violations.push('protein_target')
  if (!within(version.waterTargetMl, bounds.waterMl.min, bounds.waterMl.max)) violations.push('water_target')
  if (!within(version.aerobicMinutesPerWeek, bounds.aerobicMinutesPerWeek.min, bounds.aerobicMinutesPerWeek.max)) violations.push('aerobic_minutes')
  if (!within(version.strengthDaysPerWeek, bounds.strengthDaysPerWeek.min, bounds.strengthDaysPerWeek.max)) violations.push('strength_days')
  if (!within(version.expectedWeeklyLossKg, bounds.weeklyLossKg.min, bounds.weeklyLossKg.max)) violations.push('weekly_loss')
  return { valid: violations.length === 0, violations }
}
