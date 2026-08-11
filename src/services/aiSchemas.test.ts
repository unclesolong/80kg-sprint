import { describe, expect, it } from 'vitest'
import type { SafetyBounds } from '../planner/types'
import { parseFoodParseOutput, parsePlanAIOutput, parseWeeklyReviewAIOutput, validatePlanAIOutputAgainstBounds, validateWeeklyReviewAIOutputAgainstBounds } from './aiSchemas'

const comment = { title: '穩定執行', summary: '先維持可以持續的節奏。', bullets: ['完整紀錄'], tone: 'supportive' as const }
const validPlan = {
  schemaVersion: 1,
  status: 'ok',
  selectedTargets: { calorieTargetKcal: 1800, proteinMinG: 120, proteinMaxG: 150, waterTargetMl: 2400, expectedWeeklyLossKg: 0.4, aerobicMinutesPerWeek: 120, strengthDaysPerWeek: 2, eveningReserveKcal: 170 },
  energyPlan: { restingEnergyKcal: 1750, activeEnergyKcal: 450, estimatedTdeeKcal: 2200, source: 'profile_wearable_average', confidence: 'medium', sampleCount: 14 },
  focusTasks: ['記錄三餐'], comment, assumptions: [], warnings: []
}
const bounds: SafetyBounds = {
  dailyCalories: { min: 1500, max: 2100, recommended: 1800 },
  weeklyLossKg: { min: 0.2, max: 0.8, recommended: 0.4 },
  weeklyLossPercent: { min: 0.25, max: 1, recommended: 0.5 },
  proteinG: { min: 110, max: 170, recommended: 140 },
  waterMl: { min: 1800, max: 3500, recommended: 2400 },
  aerobicMinutesPerWeek: { min: 60, max: 180, recommended: 120 },
  strengthDaysPerWeek: { min: 0, max: 4, recommended: 2 },
  earliestGoalDate: '2026-10-01', recommendedGoalDate: '2026-11-01', latestSuggestedGoalDate: '2027-01-01'
}
const validWeekly = {
  schemaVersion: 1,
  decision: 'maintain',
  calorieAdjustmentKcal: 0,
  activityAdjustment: { aerobicMinutesDelta: 0, strengthDaysDelta: 0 },
  focusTasks: ['維持紀錄'], comment, warnings: []
}

describe('strict AI response schemas', () => {
  it('accepts an exact valid plan response', () => {
    expect(parsePlanAIOutput(validPlan).valid).toBe(true)
  })

  it('rejects missing keys, wrong enums, extra keys and long UI copy', () => {
    const { warnings: _warnings, ...missing } = validPlan
    expect(parsePlanAIOutput(missing).valid).toBe(false)
    expect(parsePlanAIOutput({ ...validPlan, status: 'invented' }).valid).toBe(false)
    expect(parsePlanAIOutput({ ...validPlan, rawProviderText: 'do not display' }).valid).toBe(false)
    expect(parsePlanAIOutput({ ...validPlan, comment: { ...comment, summary: '字'.repeat(221) } }).valid).toBe(false)
  })

  it('rejects a schema-valid 900 kcal plan at the domain boundary', () => {
    const parsed = parsePlanAIOutput({ ...validPlan, selectedTargets: { ...validPlan.selectedTargets, calorieTargetKcal: 900 } })
    expect(parsed.valid).toBe(true)
    if (parsed.valid) expect(validatePlanAIOutputAgainstBounds(parsed.value, bounds)).toMatchObject({ valid: false })
  })

  it('requires numeric weekly adjustment enums and rejects -500', () => {
    expect(parseWeeklyReviewAIOutput(validWeekly).valid).toBe(true)
    expect(parseWeeklyReviewAIOutput({ ...validWeekly, calorieAdjustmentKcal: '0' }).valid).toBe(false)
    expect(parseWeeklyReviewAIOutput({ ...validWeekly, calorieAdjustmentKcal: -500 }).valid).toBe(false)
  })

  it('blocks both aerobic and strength increases when current injury is present', () => {
    const aerobic = parseWeeklyReviewAIOutput({ ...validWeekly, activityAdjustment: { aerobicMinutesDelta: 10, strengthDaysDelta: 0 } })
    const strength = parseWeeklyReviewAIOutput({ ...validWeekly, activityAdjustment: { aerobicMinutesDelta: 0, strengthDaysDelta: 1 } })
    expect(aerobic.valid && validateWeeklyReviewAIOutputAgainstBounds(aerobic.value, { calorieTargetKcal: 1800, aerobicMinutesPerWeek: 120, strengthDaysPerWeek: 2 }, bounds, ['current_injury']).valid).toBe(false)
    expect(strength.valid && validateWeeklyReviewAIOutputAgainstBounds(strength.value, { calorieTargetKcal: 1800, aerobicMinutesPerWeek: 120, strengthDaysPerWeek: 2 }, bounds, ['current_injury']).valid).toBe(false)
  })

  it('accepts semantic food parsing without nutrition numbers', () => {
    const parsed = parseFoodParseOutput({
      schemaVersion: 1,
      items: [{ rawText: '雞胸200g', normalizedName: '雞胸肉', amount: 200, unit: 'g', preparation: null, weightState: 'unknown', brand: null, searchTerms: ['雞胸肉'], needsConfirmation: true, confirmationQuestion: '這是生重還是熟重？' }],
      unparsedText: []
    })
    expect(parsed.valid).toBe(true)
  })

  it.each(['kcal', 'proteinG', 'carbsG', 'fatG'])('rejects invented %s in food parse output', (field) => {
    const item = { rawText: '雞胸200g', normalizedName: '雞胸肉', amount: 200, unit: 'g', preparation: null, weightState: 'unknown', brand: null, searchTerms: ['雞胸肉'], needsConfirmation: true, confirmationQuestion: '生重或熟重？', [field]: 123 }
    expect(parseFoodParseOutput({ schemaVersion: 1, items: [item], unparsedText: [] }).valid).toBe(false)
  })
})
