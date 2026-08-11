import type {
  PlanAIOutput,
  PlanGenerateRequest,
  SafetyBounds,
  SelectedTargets,
  WeeklyReviewAIOutput,
  WeeklyReviewRequest,
} from './contracts'

const inRange = (value: number, range: { min: number; max: number }) =>
  Number.isFinite(value) && value >= range.min && value <= range.max

const addIssue = (issues: string[], condition: boolean, code: string) => {
  if (!condition) issues.push(code)
}

const sameEnergyPlan = (left: PlanAIOutput['energyPlan'], right: PlanGenerateRequest['localRecommendation']['energyPlan']) => left.restingEnergyKcal === right.restingEnergyKcal && left.activeEnergyKcal === right.activeEnergyKcal && left.estimatedTdeeKcal === right.estimatedTdeeKcal && left.source === right.source && left.confidence === right.confidence && left.sampleCount === right.sampleCount

const roundTo50 = (value: number) => Math.round(value / 50) * 50
const roundTo5 = (value: number) => Math.round(value / 5) * 5

const validateAbsoluteBounds = (bounds: SafetyBounds, calorieFloor: number): string[] => {
  const issues: string[] = []
  const calorieCeiling = Math.max(5_000, calorieFloor * 1.5)
  if (bounds.dailyCalories.min < calorieFloor || bounds.dailyCalories.max > calorieCeiling) issues.push('daily_calorie_bounds_untrusted')
  if (bounds.weeklyLossKg.min < 0 || bounds.weeklyLossKg.max > 0.9) issues.push('weekly_loss_kg_bounds_untrusted')
  if (bounds.weeklyLossPercent.min < 0 || bounds.weeklyLossPercent.max > 1) issues.push('weekly_loss_percent_bounds_untrusted')
  if (bounds.proteinG.min < 40 || bounds.proteinG.max > 240) issues.push('protein_bounds_untrusted')
  if (bounds.waterMl.min < 1_000 || bounds.waterMl.max > 5_000) issues.push('water_bounds_untrusted')
  if (bounds.aerobicMinutesPerWeek.min < 0 || bounds.aerobicMinutesPerWeek.max > 600) issues.push('aerobic_bounds_untrusted')
  if (bounds.strengthDaysPerWeek.min < 0 || bounds.strengthDaysPerWeek.max > 4) issues.push('strength_bounds_untrusted')
  return issues
}

export const minimumSelfServeCalories = (
  profile: Pick<PlanGenerateRequest['profile'], 'age' | 'calculationSex' | 'heightCm' | 'currentWeightKg'>,
) => {
  const bmr =
    10 * profile.currentWeightKg +
    6.25 * profile.heightCm -
    5 * profile.age +
    (profile.calculationSex === 'male' ? 5 : -161)
  return roundTo50(Math.max(profile.calculationSex === 'male' ? 1_500 : 1_200, bmr * 0.8))
}

const baselineAerobicMinutes = (profile: PlanGenerateRequest['profile']) =>
  profile.exerciseMinutesPerWeek ?? profile.exerciseSessionsPerWeek * 40

const validateInitialActivityIncrease = (
  targets: SelectedTargets,
  profile: PlanGenerateRequest['profile'],
): string[] => {
  const issues: string[] = []
  const currentMinutes = baselineAerobicMinutes(profile)
  // Mirrors the local planner's conservative ramp: roughly 15%, with a small
  // onboarding allowance for people who currently report little activity.
  const maximumAerobic = Math.max(90, roundTo5(currentMinutes * 1.15 + 30))
  const maximumStrength = Math.min(4, Math.max(2, profile.exerciseSessionsPerWeek + 1))
  if (targets.aerobicMinutesPerWeek > maximumAerobic) issues.push('initial_aerobic_increase_too_large')
  if (targets.strengthDaysPerWeek > maximumStrength) issues.push('initial_strength_increase_too_large')
  return issues
}

export const validateTargetsAgainstBounds = (
  targets: SelectedTargets,
  bounds: SafetyBounds,
  currentWeightKg: number,
): string[] => {
  const issues: string[] = []
  addIssue(issues, inRange(targets.calorieTargetKcal, bounds.dailyCalories), 'calorie_target_out_of_bounds')
  addIssue(issues, inRange(targets.proteinMinG, bounds.proteinG), 'protein_min_out_of_bounds')
  addIssue(issues, inRange(targets.proteinMaxG, bounds.proteinG), 'protein_max_out_of_bounds')
  addIssue(issues, targets.proteinMinG <= targets.proteinMaxG, 'protein_range_order')
  addIssue(issues, inRange(targets.waterTargetMl, bounds.waterMl), 'water_target_out_of_bounds')
  addIssue(
    issues,
    inRange(targets.expectedWeeklyLossKg, bounds.weeklyLossKg),
    'weekly_loss_kg_out_of_bounds',
  )
  const weeklyLossPercent = (targets.expectedWeeklyLossKg / currentWeightKg) * 100
  addIssue(
    issues,
    inRange(weeklyLossPercent, bounds.weeklyLossPercent) && weeklyLossPercent <= 1,
    'weekly_loss_percent_out_of_bounds',
  )
  addIssue(issues, targets.expectedWeeklyLossKg <= 0.9, 'weekly_loss_absolute_max')
  addIssue(
    issues,
    inRange(targets.aerobicMinutesPerWeek, bounds.aerobicMinutesPerWeek),
    'aerobic_minutes_out_of_bounds',
  )
  addIssue(
    issues,
    inRange(targets.strengthDaysPerWeek, bounds.strengthDaysPerWeek),
    'strength_days_out_of_bounds',
  )
  addIssue(
    issues,
    Number.isInteger(targets.strengthDaysPerWeek),
    'strength_days_must_be_integer',
  )
  addIssue(
    issues,
    targets.eveningReserveKcal >= 0 &&
      targets.eveningReserveKcal <= Math.min(500, targets.calorieTargetKcal * 0.35),
    'evening_reserve_out_of_bounds',
  )
  return issues
}

export const validatePlanRequestSafety = (request: PlanGenerateRequest): string[] => {
  const issues: string[] = []
  if (request.profile.age < 18) issues.push('under_18_blocked')
  const goalBmi = request.profile.goalWeightKg / (request.profile.heightCm / 100) ** 2
  const currentBmi = request.profile.currentWeightKg / (request.profile.heightCm / 100) ** 2
  if (goalBmi < 18.5) issues.push('goal_bmi_below_18_5')
  if (currentBmi < 18.5 && request.profile.goalWeightKg < request.profile.currentWeightKg) {
    issues.push('underweight_weight_loss_blocked')
  }
  if (request.safety.status === 'blocked' || request.safety.status === 'restricted') {
    issues.push('safety_status_restricted')
  }
  if (request.safety.kidneyDisease) issues.push('kidney_risk_requires_professional_review')
  if (!request.safety.bounds) return [...issues, 'safety_bounds_missing']

  const energy = request.localRecommendation.energyPlan
  if (Math.abs(energy.restingEnergyKcal + energy.activeEnergyKcal - energy.estimatedTdeeKcal) > 100) issues.push('local_energy_total_inconsistent')
  if (request.localRecommendation.selectedTargets.calorieTargetKcal >= energy.estimatedTdeeKcal) issues.push('local_intake_not_below_tdee')

  const minimumCalories = minimumSelfServeCalories(request.profile)
  issues.push(...validateAbsoluteBounds(request.safety.bounds, minimumCalories))

  if (request.goalDate && request.goalDate < request.safety.bounds.earliestGoalDate) {
    issues.push('goal_date_before_earliest_safe_date')
  }

  issues.push(
    ...validateTargetsAgainstBounds(
      request.localRecommendation.selectedTargets,
      request.safety.bounds,
      request.profile.currentWeightKg,
    ).map((issue) => `local_${issue}`),
  )
  issues.push(
    ...validateInitialActivityIncrease(request.localRecommendation.selectedTargets, request.profile).map(
      (issue) => `local_${issue}`,
    ),
  )

  const painLimited = request.safety.currentInjuryOrPain || (request.safety.painLevel ?? 0) >= 2
  const currentAerobic = baselineAerobicMinutes(request.profile)
  if (painLimited && request.localRecommendation.selectedTargets.aerobicMinutesPerWeek > currentAerobic) {
    issues.push('local_activity_increase_during_pain')
  }
  if (painLimited && request.localRecommendation.selectedTargets.strengthDaysPerWeek > request.profile.exerciseSessionsPerWeek) issues.push('local_strength_increase_during_pain')
  return [...new Set(issues)]
}

export const validatePlanAIOutputSafety = (
  output: PlanAIOutput,
  request: PlanGenerateRequest,
): string[] => {
  if (!request.safety.bounds) return ['safety_bounds_missing']
  const issues = validateTargetsAgainstBounds(
    output.selectedTargets,
    request.safety.bounds,
    request.profile.currentWeightKg,
  )
  if (!sameEnergyPlan(output.energyPlan, request.localRecommendation.energyPlan)) issues.push('energy_plan_provenance_mismatch')
  issues.push(...validateInitialActivityIncrease(output.selectedTargets, request.profile))
  if (output.selectedTargets.calorieTargetKcal < minimumSelfServeCalories(request.profile)) {
    issues.push('calorie_target_below_self_serve_minimum')
  }
  if (output.status === 'restricted') issues.push('ai_must_not_override_local_safety_status')
  if (request.safety.status === 'needs_confirmation' && output.status !== 'needs_more_data') {
    issues.push('safety_confirmation_required')
  }
  const painLimited = request.safety.currentInjuryOrPain || (request.safety.painLevel ?? 0) >= 2
  if (
    painLimited &&
    output.selectedTargets.aerobicMinutesPerWeek > request.localRecommendation.selectedTargets.aerobicMinutesPerWeek
  ) {
    issues.push('activity_increase_during_pain')
  }
  if (painLimited && output.selectedTargets.strengthDaysPerWeek > request.localRecommendation.selectedTargets.strengthDaysPerWeek) issues.push('strength_increase_during_pain')
  if (request.safety.kidneyDisease) issues.push('protein_target_disallowed_for_kidney_risk')
  return [...new Set(issues)]
}

export const validateWeeklyRequestSafety = (request: WeeklyReviewRequest): string[] => {
  const issues: string[] = []
  if (request.weekEnd < request.weekStart) issues.push('week_date_order')
  const spanDays = Math.round(
    (Date.parse(`${request.weekEnd}T00:00:00Z`) - Date.parse(`${request.weekStart}T00:00:00Z`)) /
      86_400_000,
  )
  if (spanDays !== 6) issues.push('week_must_cover_seven_days')
  if (request.safety.status === 'blocked' || request.safety.status === 'restricted') {
    issues.push('safety_status_restricted')
  }
  if (request.safety.kidneyDisease) issues.push('kidney_risk_requires_professional_review')
  if (!request.safety.bounds) return [...issues, 'safety_bounds_missing']
  issues.push(...validateAbsoluteBounds(request.safety.bounds, 1_200))
  issues.push(
    ...validateTargetsAgainstBounds(request.currentVersion, request.safety.bounds, 100).filter(
      // The percentage requires current body weight, which the privacy-minimal
      // weekly aggregate intentionally omits. Kg bounds and the 0.9 kg absolute
      // maximum remain independently enforceable.
      (issue) => issue !== 'weekly_loss_percent_out_of_bounds',
    ),
  )
  return [...new Set(issues)]
}

export const validateWeeklyAIOutputSafety = (
  output: WeeklyReviewAIOutput,
  request: WeeklyReviewRequest,
): string[] => {
  const issues: string[] = []
  const bounds = request.safety.bounds
  if (!bounds) return ['safety_bounds_missing']

  const nextCalories = request.currentVersion.calorieTargetKcal + output.calorieAdjustmentKcal
  const nextAerobic =
    request.currentVersion.aerobicMinutesPerWeek + output.activityAdjustment.aerobicMinutesDelta
  const nextStrength = request.currentVersion.strengthDaysPerWeek + output.activityAdjustment.strengthDaysDelta
  addIssue(issues, inRange(nextCalories, bounds.dailyCalories), 'resulting_calories_out_of_bounds')
  addIssue(issues, inRange(nextAerobic, bounds.aerobicMinutesPerWeek), 'resulting_aerobic_out_of_bounds')
  addIssue(issues, inRange(nextStrength, bounds.strengthDaysPerWeek), 'resulting_strength_out_of_bounds')
  addIssue(issues, Number.isInteger(nextStrength), 'resulting_strength_must_be_integer')

  if (output.decision === 'decrease_calories' && output.calorieAdjustmentKcal >= 0) {
    issues.push('decision_adjustment_mismatch')
  }
  if (output.decision === 'increase_calories' && output.calorieAdjustmentKcal <= 0) {
    issues.push('decision_adjustment_mismatch')
  }
  if (
    ['maintain', 'improve_data_first', 'recovery_priority', 'restricted'].includes(output.decision) &&
    output.calorieAdjustmentKcal !== 0
  ) {
    issues.push('decision_adjustment_mismatch')
  }
  if (
    output.decision === 'improve_data_first' &&
    (output.activityAdjustment.aerobicMinutesDelta !== 0 || output.activityAdjustment.strengthDaysDelta !== 0)
  ) {
    issues.push('improve_data_first_disallows_activity_adjustment')
  }
  if (
    output.decision === 'recovery_priority' &&
    (output.activityAdjustment.aerobicMinutesDelta > 0 || output.activityAdjustment.strengthDaysDelta > 0)
  ) {
    issues.push('recovery_priority_disallows_activity_increase')
  }
  if (
    output.calorieAdjustmentKcal < 0 &&
    (output.activityAdjustment.aerobicMinutesDelta > 0 || output.activityAdjustment.strengthDaysDelta > 0)
  ) {
    issues.push('combined_deficit_increase_disallowed')
  }

  if (request.safety.status === 'needs_confirmation') {
    if (
      output.calorieAdjustmentKcal !== 0 ||
      output.activityAdjustment.aerobicMinutesDelta !== 0 ||
      output.activityAdjustment.strengthDaysDelta !== 0
    ) {
      issues.push('safety_confirmation_disallows_adjustment')
    }
    if (!['improve_data_first', 'recovery_priority'].includes(output.decision)) {
      issues.push('safety_confirmation_required')
    }
  }

  if (request.dataCompleteness < 0.6) {
    if (output.decision !== 'improve_data_first') issues.push('incomplete_data_requires_improve_data_first')
    if (
      output.calorieAdjustmentKcal !== 0 ||
      output.activityAdjustment.aerobicMinutesDelta !== 0 ||
      output.activityAdjustment.strengthDaysDelta !== 0
    ) {
      issues.push('incomplete_data_disallows_adjustment')
    }
  }

  const painLevel = Math.max(request.safety.painLevel ?? 0, request.summary.painMax ?? 0)
  if (request.safety.currentInjuryOrPain || painLevel >= 2) {
    if (output.activityAdjustment.aerobicMinutesDelta > 0) issues.push('pain_disallows_activity_increase')
    if (output.activityAdjustment.strengthDaysDelta > 0) issues.push('pain_disallows_strength_increase')
  }
  if (painLevel >= 3) {
    if (output.calorieAdjustmentKcal < 0) issues.push('pain_disallows_calorie_decrease')
    if (!['recovery_priority', 'improve_data_first'].includes(output.decision)) {
      issues.push('pain_requires_recovery_priority')
    }
  }
  if (output.decision === 'restricted') issues.push('ai_must_not_set_safety_status')
  return [...new Set(issues)]
}
