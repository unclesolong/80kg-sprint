import { describe, expect, it } from 'vitest'
import {
  validatePlanAIOutputSafety,
  validatePlanRequestSafety,
  validateWeeklyAIOutputSafety,
  validateWeeklyRequestSafety,
} from './safetyValidation'
import { buildWeeklyFallback } from './fallbacks'
import { planOutput, planRequest, weeklyOutput, weeklyRequest } from './testFixtures'
import { validateWeeklyReviewAIOutput } from './validators'

describe('AI plan domain safety', () => {
  it('accepts the 80.2 kg to 75 kg safe plan', () => {
    expect(validatePlanRequestSafety(planRequest)).toEqual([])
    expect(validatePlanAIOutputSafety(planOutput, planRequest)).toEqual([])
  })

  it('rejects 900 kcal and weekly loss over 1 percent', () => {
    expect(
      validatePlanAIOutputSafety(
        { ...planOutput, selectedTargets: { ...planOutput.selectedTargets, calorieTargetKcal: 900 } },
        planRequest,
      ),
    ).toContain('calorie_target_out_of_bounds')
    const issues = validatePlanAIOutputSafety(
      { ...planOutput, selectedTargets: { ...planOutput.selectedTargets, expectedWeeklyLossKg: 0.9 } },
      planRequest,
    )
    expect(issues).toContain('weekly_loss_percent_out_of_bounds')
  })

  it('independently rejects client bounds below the self-serve calorie floor', () => {
    const request = {
      ...planRequest,
      safety: {
        ...planRequest.safety,
        bounds: {
          ...planRequest.safety.bounds!,
          dailyCalories: { min: 900, max: 2_100, recommended: 1_800 },
        },
      },
    }
    expect(validatePlanRequestSafety(request)).toContain('daily_calorie_bounds_untrusted')
  })

  it('rejects client-tampered absolute safety bounds', () => {
    const request = { ...planRequest, safety: { ...planRequest.safety, bounds: { ...planRequest.safety.bounds!, proteinG: { min: 100, max: 900, recommended: 150 } } } }
    expect(validatePlanRequestSafety(request)).toContain('protein_bounds_untrusted')
  })

  it('independently caps initial activity even when client bounds are widened', () => {
    const request = {
      ...planRequest,
      safety: {
        ...planRequest.safety,
        bounds: {
          ...planRequest.safety.bounds!,
          aerobicMinutesPerWeek: { min: 0, max: 600, recommended: 600 },
        },
      },
      localRecommendation: {
        ...planRequest.localRecommendation,
        selectedTargets: {
          ...planRequest.localRecommendation.selectedTargets,
          aerobicMinutesPerWeek: 600,
        },
      },
    }
    expect(validatePlanRequestSafety(request)).toContain('local_initial_aerobic_increase_too_large')
  })

  it('rejects an unsafe goal date and BMI below 18.5', () => {
    expect(validatePlanRequestSafety({ ...planRequest, goalDate: '2026-08-14' })).toContain(
      'goal_date_before_earliest_safe_date',
    )
    expect(
      validatePlanRequestSafety({
        ...planRequest,
        profile: { ...planRequest.profile, goalWeightKg: 54 },
      }),
    ).toContain('goal_bmi_below_18_5')
  })

  it('rejects activity increases at pain level 3', () => {
    const painfulRequest = {
      ...planRequest,
      safety: { ...planRequest.safety, currentInjuryOrPain: true, painLevel: 3 },
    }
    const result = validatePlanAIOutputSafety(
      {
        ...planOutput,
        selectedTargets: { ...planOutput.selectedTargets, aerobicMinutesPerWeek: 120 },
      },
      painfulRequest,
    )
    expect(result).toContain('activity_increase_during_pain')
  })

  it('uses exercise sessions as the activity baseline when minutes are unavailable', () => {
    const request = {
      ...planRequest,
      profile: { ...planRequest.profile, exerciseMinutesPerWeek: null },
      safety: { ...planRequest.safety, currentInjuryOrPain: true, painLevel: 2 },
    }
    expect(validatePlanRequestSafety(request)).not.toContain('local_activity_increase_during_pain')
  })

  it('does not let AI mark a needs-confirmation safety state as fully ready', () => {
    const request = {
      ...planRequest,
      safety: { ...planRequest.safety, status: 'needs_confirmation' as const },
    }
    expect(validatePlanAIOutputSafety(planOutput, request)).toContain('safety_confirmation_required')
  })
})

describe('weekly review safety', () => {
  it('rejects -500 kcal at schema validation', () => {
    expect(validateWeeklyReviewAIOutput({ ...weeklyOutput, calorieAdjustmentKcal: -500 }).ok).toBe(false)
  })

  it('requires data first when completeness is low', () => {
    const request = { ...weeklyRequest, dataCompleteness: 0.4 }
    expect(validateWeeklyAIOutputSafety(weeklyOutput, request)).toContain(
      'incomplete_data_requires_improve_data_first',
    )
  })

  it('rejects increasing activity while pain is 3/5', () => {
    const request = {
      ...weeklyRequest,
      summary: { ...weeklyRequest.summary, painMax: 3 },
      safety: { ...weeklyRequest.safety, painLevel: 3 },
    }
    const output = {
      ...weeklyOutput,
      decision: 'maintain' as const,
      activityAdjustment: { aerobicMinutesDelta: 10, strengthDaysDelta: 0 },
    }
    const issues = validateWeeklyAIOutputSafety(output, request)
    expect(issues).toContain('pain_disallows_activity_increase')
    expect(issues).toContain('pain_requires_recovery_priority')
  })

  it('rejects strength increases for current injury and untrusted weekly bounds', () => {
    const request = { ...weeklyRequest, safety: { ...weeklyRequest.safety, currentInjuryOrPain: true, bounds: { ...weeklyRequest.safety.bounds!, strengthDaysPerWeek: { min: 0, max: 12, recommended: 2 } } } }
    expect(validateWeeklyRequestSafety(request)).toContain('strength_bounds_untrusted')
    const safeBoundsRequest = { ...request, safety: { ...request.safety, bounds: weeklyRequest.safety.bounds } }
    const output = { ...weeklyOutput, decision: 'recovery_priority' as const, activityAdjustment: { aerobicMinutesDelta: 0, strengthDaysDelta: 1 } }
    expect(validateWeeklyAIOutputSafety(output, safeBoundsRequest)).toContain('pain_disallows_strength_increase')
  })

  it('still validates weekly loss kg and the absolute 0.9 kg maximum', () => {
    const request = {
      ...weeklyRequest,
      currentVersion: { ...weeklyRequest.currentVersion, expectedWeeklyLossKg: 1.2 },
    }
    const issues = validateWeeklyRequestSafety(request)
    expect(issues).toContain('weekly_loss_kg_out_of_bounds')
    expect(issues).toContain('weekly_loss_absolute_max')
  })

  it('keeps pain 2/5 from increasing activity without forcing a recovery decision', () => {
    const request = {
      ...weeklyRequest,
      summary: { ...weeklyRequest.summary, painMax: 2 },
      safety: { ...weeklyRequest.safety, currentInjuryOrPain: true, painLevel: 2 },
    }
    const issues = validateWeeklyAIOutputSafety(weeklyOutput, request)
    expect(issues).not.toContain('pain_requires_recovery_priority')
    expect(issues).not.toContain('pain_disallows_calorie_decrease')
  })

  it('rejects semantically inconsistent or compounded weekly adjustments', () => {
    const dataFirstWithIncrease = {
      ...weeklyOutput,
      decision: 'improve_data_first' as const,
      activityAdjustment: { aerobicMinutesDelta: 10, strengthDaysDelta: 0 },
    }
    expect(validateWeeklyAIOutputSafety(dataFirstWithIncrease, weeklyRequest)).toContain(
      'improve_data_first_disallows_activity_adjustment',
    )

    const stackedDeficit = {
      ...weeklyOutput,
      decision: 'decrease_calories' as const,
      calorieAdjustmentKcal: -100 as const,
      activityAdjustment: { aerobicMinutesDelta: 10, strengthDaysDelta: 0 },
    }
    expect(validateWeeklyAIOutputSafety(stackedDeficit, weeklyRequest)).toContain(
      'combined_deficit_increase_disallowed',
    )
  })

  it('allows a bounded activity-only adjustment when calories are maintained and there is no pain', () => {
    const output = {
      ...weeklyOutput,
      activityAdjustment: { aerobicMinutesDelta: 10, strengthDaysDelta: 0 },
    }
    expect(validateWeeklyAIOutputSafety(output, weeklyRequest)).toEqual([])
  })

  it('allows no weekly adjustment until a needs-confirmation state is resolved', () => {
    const request = {
      ...weeklyRequest,
      safety: { ...weeklyRequest.safety, status: 'needs_confirmation' as const },
    }
    expect(validateWeeklyAIOutputSafety(weeklyOutput, request)).toContain('safety_confirmation_required')
    expect(buildWeeklyFallback(request)).toMatchObject({
      decision: 'improve_data_first',
      calorieAdjustmentKcal: 0,
      activityAdjustment: { aerobicMinutesDelta: 0, strengthDaysDelta: 0 },
    })
  })
})
