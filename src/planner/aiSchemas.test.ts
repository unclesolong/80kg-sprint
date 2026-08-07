import { describe, expect, it } from 'vitest'
import { applyPlanAIOutput, isFoodParseOutput, isPlanAIOutput, isWeeklyReviewAIOutput, validateWeeklyAIOutput, type PlanAIOutput, type WeeklyReviewAIOutput } from './aiSchemas'
import { createLocalPlanDraft } from './planCalculations'
import { evaluateSafety } from './safetyEngine'
import { plannerProfile } from './testFixtures'
import type { PlanVersion, SafetyScreen, WeeklyAggregate } from './types'

const screen: SafetyScreen = { id: 'current', under18: false, pregnantOrBreastfeeding: false, eatingDisorderHistory: false, diabetesOrGlucoseMedication: false, kidneyDisease: false, seriousCardiovascularDisease: false, weightLossMedication: false, currentInjuryOrPain: false, faintingChestPainOrSevereDizziness: false, purgingLaxativesDiureticsOrForcedExercise: false, answeredAt: '2026-08-07' }
const decision = evaluateSafety(plannerProfile(), screen, [], '2026-08-07')
const local = createLocalPlanDraft(decision.bounds!, 'standard')
const planOutput: PlanAIOutput = { schemaVersion: 1, status: 'ok', selectedTargets: { calorieTargetKcal: local.calorieTargetKcal, proteinMinG: local.proteinMinG, proteinMaxG: local.proteinMaxG, waterTargetMl: local.waterTargetMl, expectedWeeklyLossKg: local.expectedWeeklyLossKg, aerobicMinutesPerWeek: local.aerobicMinutesPerWeek, strengthDaysPerWeek: local.strengthDaysPerWeek, eveningReserveKcal: 200 }, focusTasks: ['穩定記錄'], comment: { title: '穩定執行', summary: '保持目前安全節奏。', bullets: ['一週後再檢討'], tone: 'supportive' }, assumptions: [], warnings: [] }

describe('frontend AI schemas and domain validation', () => {
  it('accepts a complete strict plan response and applies it only inside SafetyBounds', () => {
    expect(isPlanAIOutput(planOutput)).toBe(true)
    expect(applyPlanAIOutput(local, planOutput, decision)).toMatchObject({ valid: true, draft: { eveningReserveKcal: 200 } })
  })

  it('rejects missing keys, wrong enums, long comments, and 900 kcal output', () => {
    const { warnings: _warnings, ...missing } = planOutput
    expect(isPlanAIOutput(missing)).toBe(false)
    expect(isPlanAIOutput({ ...planOutput, status: 'invented' })).toBe(false)
    expect(isPlanAIOutput({ ...planOutput, comment: { ...planOutput.comment, summary: 'x'.repeat(221) } })).toBe(false)
    const unsafe = applyPlanAIOutput(local, { ...planOutput, selectedTargets: { ...planOutput.selectedTargets, calorieTargetKcal: 900 } }, decision)
    expect(unsafe.valid).toBe(false)
    expect(unsafe.draft).toEqual(local)
    expect(unsafe.violations).toContain('calorie_target')
  })

  it('rejects prohibited instructions instead of showing raw model output', () => {
    const result = applyPlanAIOutput(local, { ...planOutput, focusTasks: ['忍痛跑完今天里程'] }, decision)
    expect(result.valid).toBe(false)
    expect(result.violations).toContain('unsafe_instruction')
    expect(result.draft.comment).toEqual(local.comment)
  })

  it('weekly schema allows only whitelist adjustments and blocks changes when data is incomplete', () => {
    const output: WeeklyReviewAIOutput = { schemaVersion: 1, decision: 'maintain', calorieAdjustmentKcal: 0, activityAdjustment: { aerobicMinutesDelta: 0, strengthDaysDelta: 0 }, focusTasks: ['補足紀錄'], comment: planOutput.comment, warnings: [] }
    const current = { calorieTargetKcal: 1900, calorieRangeMinKcal: 1700, calorieRangeMaxKcal: 2050, aerobicMinutesPerWeek: 120, strengthDaysPerWeek: 2 } as PlanVersion
    const summary = { morningWeightCount: 2, intakeDayCount: 2, finalizedDayCount: 1 } as WeeklyAggregate
    expect(isWeeklyReviewAIOutput(output)).toBe(true)
    expect(isWeeklyReviewAIOutput({ ...output, calorieAdjustmentKcal: -500 })).toBe(false)
    expect(validateWeeklyAIOutput({ ...output, calorieAdjustmentKcal: -100 }, current, summary, 25).violations).toContain('insufficient_data_adjustment')
  })

  it('blocks activity increases when average pain is at least 2', () => {
    const output: WeeklyReviewAIOutput = { schemaVersion: 1, decision: 'maintain', calorieAdjustmentKcal: 0, activityAdjustment: { aerobicMinutesDelta: 20, strengthDaysDelta: 0 }, focusTasks: [], comment: planOutput.comment, warnings: [] }
    const current = { calorieTargetKcal: 1900, calorieRangeMinKcal: 1700, calorieRangeMaxKcal: 2050, aerobicMinutesPerWeek: 120, strengthDaysPerWeek: 2 } as PlanVersion
    const summary = { morningWeightCount: 7, intakeDayCount: 7, finalizedDayCount: 7, averagePain: 3 } as WeeklyAggregate
    expect(validateWeeklyAIOutput(output, current, summary, 90).violations).toContain('pain_activity_increase')
  })

  it('food parse never accepts nutrition fields from the model', () => {
    const item = { rawText: '雞胸200g', normalizedName: '雞胸肉', amount: 200, unit: 'g', preparation: null, weightState: 'unknown', brand: null, searchTerms: ['雞胸肉'], needsConfirmation: true, confirmationQuestion: '生重或熟重？' }
    expect(isFoodParseOutput({ schemaVersion: 1, items: [item], unparsedText: [] })).toBe(true)
    expect(isFoodParseOutput({ schemaVersion: 1, items: [{ ...item, kcal: 240 }], unparsedText: [] })).toBe(false)
  })
})
