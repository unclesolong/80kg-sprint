import { describe, expect, it } from 'vitest'
import type { DailyLog } from '../types'
import { createLocalPlanDraft } from './planCalculations'
import { buildInitialPlanBundle } from './plannerRepository'
import { evaluateSafety, validatePlanVersionAgainstDecision } from './safetyEngine'
import { plannerProfile } from './testFixtures'
import type { SafetyScreen } from './types'

const screen = (patch: Partial<SafetyScreen> = {}): SafetyScreen => ({
  id: 'current', under18: false, pregnantOrBreastfeeding: false, eatingDisorderHistory: false,
  diabetesOrGlucoseMedication: false, kidneyDisease: false, seriousCardiovascularDisease: false,
  weightLossMedication: false, currentInjuryOrPain: false, faintingChestPainOrSevereDizziness: false,
  purgingLaxativesDiureticsOrForcedExercise: false, answeredAt: '2026-08-07T00:00:00.000Z', ...patch
})

describe('planner safety engine', () => {
  it('approves a conservative adult goal', () => {
    const decision = evaluateSafety(plannerProfile(), screen(), [], '2026-08-07')
    expect(decision.status).toBe('approved')
    expect(decision.bounds).toBeDefined()
  })

  it.each([
    ['age', plannerProfile({ age: 16 }), screen()],
    ['pregnancy', plannerProfile(), screen({ pregnantOrBreastfeeding: true })],
    ['acute symptoms', plannerProfile(), screen({ faintingChestPainOrSevereDizziness: true })],
    ['compensatory behavior', plannerProfile(), screen({ purgingLaxativesDiureticsOrForcedExercise: true })],
    ['low target BMI', plannerProfile({ goalWeightKg: 55, heightCm: 180 }), screen()]
  ])('blocks %s', (_, profile, answers) => {
    expect(evaluateSafety(profile, answers, [], '2026-08-07').status).toBe('blocked')
  })

  it.each([
    ['eating disorder history', { eatingDisorderHistory: true }],
    ['kidney disease', { kidneyDisease: true }],
    ['diabetes medication', { diabetesOrGlucoseMedication: true }],
    ['cardiovascular disease', { seriousCardiovascularDisease: true }],
    ['weight-loss medication', { weightLossMedication: true }]
  ] as const)('restricts %s', (_, patch) => {
    expect(evaluateSafety(plannerProfile(), screen(patch), [], '2026-08-07').status).toBe('restricted')
  })

  it('limits activity when recent foot pain is 3/5', () => {
    const log: DailyLog = { id: '2026-08-07', date: '2026-08-07', lowerLegTightness: 3, createdAt: '', updatedAt: '' }
    const decision = evaluateSafety(plannerProfile({ exerciseMinutesPerWeek: 120 }), screen(), [log], '2026-08-07')
    expect(decision.status).toBe('needs_confirmation')
    expect(decision.limitations).toContain('current_injury')
    expect(decision.bounds!.aerobicMinutesPerWeek.max).toBeLessThanOrEqual(120)
  })

  it('rejects unsafe plan numbers instead of silently clamping them', () => {
    const decision = evaluateSafety(plannerProfile(), screen(), [], '2026-08-07')
    const draft = createLocalPlanDraft(decision.bounds!, 'standard')
    const { version } = buildInitialPlanBundle(plannerProfile(), decision, draft, '2026-08-07')
    expect(validatePlanVersionAgainstDecision({ ...version, calorieTargetKcal: 900 }, decision)).toEqual({ valid: false, violations: ['calorie_target'] })
    expect(validatePlanVersionAgainstDecision({ ...version, expectedWeeklyLossKg: 1.2 }, decision).violations).toContain('weekly_loss')
    expect(validatePlanVersionAgainstDecision(version, decision).valid).toBe(true)
  })
})
