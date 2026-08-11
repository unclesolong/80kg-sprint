import { describe, expect, it } from 'vitest'
import {
  foodParseOutputZodSchema,
  planAIOutputZodSchema,
  weeklyReviewAIOutputZodSchema,
} from './schemas'
import { foodParseOutput, planOutput, planRequest, weeklyOutput, weeklyRequest } from './testFixtures'
import {
  validateFoodParseOutput,
  validateFoodParseRequest,
  validatePlanAIOutput,
  validatePlanGenerateRequest,
  validateWeeklyReviewAIOutput,
  validateWeeklyReviewRequest,
} from './validators'

describe('strict structured output validators', () => {
  it('uses strict Zod runtime schemas for every AI response type', () => {
    expect(planAIOutputZodSchema.safeParse(planOutput).success).toBe(true)
    expect(weeklyReviewAIOutputZodSchema.safeParse(weeklyOutput).success).toBe(true)
    expect(foodParseOutputZodSchema.safeParse(foodParseOutput).success).toBe(true)
    expect(planAIOutputZodSchema.safeParse({ ...planOutput, unexpected: true }).success).toBe(false)
  })

  it('accepts all three valid response contracts', () => {
    expect(validatePlanAIOutput(planOutput).ok).toBe(true)
    expect(validateWeeklyReviewAIOutput(weeklyOutput).ok).toBe(true)
    expect(validateFoodParseOutput(foodParseOutput).ok).toBe(true)
  })

  it('rejects missing required keys, wrong enums, and long comments', () => {
    const missing = structuredClone(planOutput) as unknown as Record<string, unknown>
    delete missing.comment
    expect(validatePlanAIOutput(missing).ok).toBe(false)
    expect(validatePlanAIOutput({ ...planOutput, status: 'unsafe' }).ok).toBe(false)
    expect(
      validatePlanAIOutput({
        ...planOutput,
        comment: { ...planOutput.comment, summary: 'x'.repeat(221) },
      }).ok,
    ).toBe(false)
  })

  it('rejects nutrition fields in food parse output', () => {
    const withInventedNutrition = structuredClone(foodParseOutput) as unknown as {
      items: Array<Record<string, unknown>>
    }
    withInventedNutrition.items[0].kcal = 350
    withInventedNutrition.items[0].proteinG = 45
    const result = validateFoodParseOutput(withInventedNutrition)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues).toContain('output.items[0].unknown_key')
  })
})

describe('privacy-minimizing request validators', () => {
  it('accepts valid plan and weekly aggregates', () => {
    expect(validatePlanGenerateRequest(planRequest).ok).toBe(true)
    expect(validateWeeklyReviewRequest(weeklyRequest).ok).toBe(true)
  })

  it('requires a strict local energy analysis in plan requests', () => {
    const request = structuredClone(planRequest) as unknown as { localRecommendation: Record<string, unknown> }
    delete request.localRecommendation.energyPlan
    expect(validatePlanGenerateRequest(request).ok).toBe(false)
    expect(validatePlanGenerateRequest({ ...planRequest, localRecommendation: { ...planRequest.localRecommendation, energyPlan: { ...planRequest.localRecommendation.energyPlan, rawDeviceRows: [] } } }).ok).toBe(false)
  })

  it('rejects unexpected PII/raw note keys', () => {
    expect(validatePlanGenerateRequest({ ...planRequest, email: 'person@example.test' }).ok).toBe(false)
    expect(validateWeeklyReviewRequest({ ...weeklyRequest, rawNotes: ['private'] }).ok).toBe(false)
  })

  it('limits food parse text and accepts no nutrition input', () => {
    expect(validateFoodParseRequest({ text: '雞胸200g', locale: 'zh-TW' }).ok).toBe(true)
    expect(validateFoodParseRequest({ text: 'x'.repeat(501), locale: 'zh-TW' }).ok).toBe(false)
    expect(validateFoodParseRequest({ text: '雞胸', locale: 'zh-TW', kcal: 300 }).ok).toBe(false)
  })
})
