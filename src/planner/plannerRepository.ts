import type { PlannerDraft, FatLossPlan, PlanVersion, SafetyDecision, UserProfile } from './types'

const makeId = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`

export const buildInitialPlanBundle = (profile: UserProfile, decision: SafetyDecision, draft: PlannerDraft, startDate: string, now = new Date().toISOString(), source: 'manual' | 'ai_assisted' = 'manual') => {
  if (!decision.bounds || decision.status === 'blocked' || decision.status === 'restricted') throw new Error('Safety decision does not allow a self-serve plan')
  const plan: FatLossPlan = {
    id: makeId('plan'),
    name: '長期減脂計畫',
    status: 'active',
    startDate,
    goalWeightKg: profile.goalWeightKg,
    createdAt: now,
    source,
    safetyDecisionSnapshot: decision
  }
  const version: PlanVersion = {
    id: makeId('version'),
    planId: plan.id,
    effectiveFrom: startDate,
    goalDate: draft.goalDate,
    calorieTargetKcal: draft.calorieTargetKcal,
    calorieRangeMinKcal: decision.bounds.dailyCalories.min,
    calorieRangeMaxKcal: decision.bounds.dailyCalories.max,
    proteinMinG: draft.proteinMinG,
    proteinMaxG: draft.proteinMaxG,
    waterTargetMl: draft.waterTargetMl,
    sleepTargetMinHours: 7,
    aerobicMinutesPerWeek: draft.aerobicMinutesPerWeek,
    strengthDaysPerWeek: draft.strengthDaysPerWeek,
    expectedWeeklyLossKg: draft.expectedWeeklyLossKg,
    eveningReserveKcal: draft.eveningReserveKcal,
    reservedTemplateIds: [...draft.reservedTemplateIds],
    focusTasks: [...draft.focusTasks],
    comment: { ...draft.comment, bullets: [...draft.comment.bullets] },
    createdAt: now,
    createdBy: source
  }
  return { plan, version }
}
