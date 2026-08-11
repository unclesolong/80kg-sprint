import { validatePlanVersionAgainstDecision } from './safetyEngine'
import type { AIComment, DailyEnergyPlan, PlannerDraft, PlanVersion, SafetyDecision, WeeklyAggregate } from './types'

export interface PlanAIOutput {
  schemaVersion: 1
  status: 'ok' | 'needs_more_data' | 'restricted'
  selectedTargets: {
    calorieTargetKcal: number
    proteinMinG: number
    proteinMaxG: number
    waterTargetMl: number
    expectedWeeklyLossKg: number
    aerobicMinutesPerWeek: number
    strengthDaysPerWeek: number
    eveningReserveKcal: number
  }
  energyPlan: DailyEnergyPlan
  focusTasks: string[]
  comment: AIComment
  assumptions: Array<{ code: string; text: string }>
  warnings: Array<{ code: string; text: string }>
}

export interface WeeklyReviewAIOutput {
  schemaVersion: 1
  decision: 'maintain' | 'increase_calories' | 'decrease_calories' | 'improve_data_first' | 'recovery_priority' | 'restricted'
  calorieAdjustmentKcal: -150 | -100 | 0 | 100 | 150
  activityAdjustment: { aerobicMinutesDelta: number; strengthDaysDelta: number }
  focusTasks: string[]
  comment: AIComment
  warnings: string[]
}

export interface FoodParseItem {
  rawText: string
  normalizedName: string
  amount: number | null
  unit: 'g' | 'ml' | '份' | '顆' | null
  preparation: string | null
  weightState: 'raw' | 'cooked' | 'unknown'
  brand: string | null
  searchTerms: string[]
  needsConfirmation: boolean
  confirmationQuestion: string | null
}

export interface FoodParseOutput { schemaVersion: 1; items: FoodParseItem[]; unparsedText: string[] }

const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every((key) => key in value)
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const shortString = (value: unknown, max: number) => typeof value === 'string' && value.length <= max
const stringArray = (value: unknown, maxItems: number, maxLength: number) => Array.isArray(value) && value.length <= maxItems && value.every((item) => shortString(item, maxLength))
const oneOf = <T extends string>(value: unknown, values: readonly T[]): value is T => typeof value === 'string' && values.includes(value as T)

const isComment = (value: unknown): value is AIComment => record(value) && exactKeys(value, ['title', 'summary', 'bullets', 'tone']) &&
  shortString(value.title, 40) && shortString(value.summary, 220) && stringArray(value.bullets, 4, 80) && oneOf(value.tone, ['supportive', 'neutral', 'caution'] as const)

export const isPlanAIOutput = (value: unknown): value is PlanAIOutput => {
  if (!record(value) || !exactKeys(value, ['schemaVersion', 'status', 'selectedTargets', 'energyPlan', 'focusTasks', 'comment', 'assumptions', 'warnings'])) return false
  const targets = value.selectedTargets
  const energy = value.energyPlan
  if (value.schemaVersion !== 1 || !oneOf(value.status, ['ok', 'needs_more_data', 'restricted'] as const) || !record(targets) ||
    !exactKeys(targets, ['calorieTargetKcal', 'proteinMinG', 'proteinMaxG', 'waterTargetMl', 'expectedWeeklyLossKg', 'aerobicMinutesPerWeek', 'strengthDaysPerWeek', 'eveningReserveKcal']) ||
    !Object.values(targets).every(finite) || !record(energy) || !exactKeys(energy, ['restingEnergyKcal', 'activeEnergyKcal', 'estimatedTdeeKcal', 'source', 'confidence', 'sampleCount']) ||
    !finite(energy.restingEnergyKcal) || !finite(energy.activeEnergyKcal) || !finite(energy.estimatedTdeeKcal) || !finite(energy.sampleCount) ||
    !oneOf(energy.source, ['wearable_logs', 'profile_wearable_average', 'mifflin'] as const) || !oneOf(energy.confidence, ['low', 'medium', 'high'] as const) || !stringArray(value.focusTasks, 4, 60) || !isComment(value.comment)) return false
  const coded = (items: unknown, textMax: number) => Array.isArray(items) && items.length <= 8 && items.every((item) => record(item) && exactKeys(item, ['code', 'text']) && shortString(item.code, 60) && shortString(item.text, textMax))
  return coded(value.assumptions, 100) && coded(value.warnings, 120)
}

export const isWeeklyReviewAIOutput = (value: unknown): value is WeeklyReviewAIOutput => {
  if (!record(value) || !exactKeys(value, ['schemaVersion', 'decision', 'calorieAdjustmentKcal', 'activityAdjustment', 'focusTasks', 'comment', 'warnings'])) return false
  const activity = value.activityAdjustment
  return value.schemaVersion === 1 && oneOf(value.decision, ['maintain', 'increase_calories', 'decrease_calories', 'improve_data_first', 'recovery_priority', 'restricted'] as const) &&
    finite(value.calorieAdjustmentKcal) && [-150, -100, 0, 100, 150].includes(value.calorieAdjustmentKcal) && record(activity) && exactKeys(activity, ['aerobicMinutesDelta', 'strengthDaysDelta']) &&
    finite(activity.aerobicMinutesDelta) && activity.aerobicMinutesDelta >= -30 && activity.aerobicMinutesDelta <= 30 && finite(activity.strengthDaysDelta) && activity.strengthDaysDelta >= -1 && activity.strengthDaysDelta <= 1 &&
    stringArray(value.focusTasks, 4, 60) && isComment(value.comment) && stringArray(value.warnings, 6, 120)
}

export const isFoodParseOutput = (value: unknown): value is FoodParseOutput => {
  if (!record(value) || !exactKeys(value, ['schemaVersion', 'items', 'unparsedText']) || value.schemaVersion !== 1 || !Array.isArray(value.items) || value.items.length > 20 || !stringArray(value.unparsedText, 10, 180)) return false
  return value.items.every((item) => record(item) && exactKeys(item, ['rawText', 'normalizedName', 'amount', 'unit', 'preparation', 'weightState', 'brand', 'searchTerms', 'needsConfirmation', 'confirmationQuestion']) &&
    shortString(item.rawText, 160) && shortString(item.normalizedName, 100) && (item.amount === null || (finite(item.amount) && item.amount > 0)) &&
    (item.unit === null || oneOf(item.unit, ['g', 'ml', '份', '顆'] as const)) && (item.preparation === null || shortString(item.preparation, 80)) &&
    oneOf(item.weightState, ['raw', 'cooked', 'unknown'] as const) && (item.brand === null || shortString(item.brand, 80)) && stringArray(item.searchTerms, 5, 80) &&
    typeof item.needsConfirmation === 'boolean' && (item.confirmationQuestion === null || shortString(item.confirmationQuestion, 140)))
}

const unsafeInstruction = (values: string[]) => values.some((value) => /催吐|瀉藥|利尿|脫水|不喝水|強迫運動|忍痛跑|跳過正餐/u.test(value))

export const applyPlanAIOutput = (localDraft: PlannerDraft, output: PlanAIOutput, decision: SafetyDecision): { valid: boolean; draft: PlannerDraft; violations: string[] } => {
  if (output.status !== 'ok') return { valid: false, draft: localDraft, violations: [`ai_status_${output.status}`] }
  const draft: PlannerDraft = {
    ...localDraft,
    ...output.selectedTargets,
    energyPlan: { ...output.energyPlan },
    reservedTemplateIds: [...localDraft.reservedTemplateIds],
    focusTasks: [...output.focusTasks],
    comment: { ...output.comment, bullets: [...output.comment.bullets] }
  }
  const validation = validatePlanVersionAgainstDecision(draft, decision)
  const violations = [...validation.violations]
  const localEnergy = localDraft.energyPlan
  const outputEnergy = output.energyPlan
  if (outputEnergy.restingEnergyKcal !== localEnergy.restingEnergyKcal || outputEnergy.activeEnergyKcal !== localEnergy.activeEnergyKcal || outputEnergy.estimatedTdeeKcal !== localEnergy.estimatedTdeeKcal || outputEnergy.source !== localEnergy.source || outputEnergy.confidence !== localEnergy.confidence || outputEnergy.sampleCount !== localEnergy.sampleCount) violations.push('energy_plan_provenance')
  if (Math.abs(outputEnergy.restingEnergyKcal + outputEnergy.activeEnergyKcal - outputEnergy.estimatedTdeeKcal) > 100) violations.push('energy_plan_total')
  if (draft.eveningReserveKcal < 0 || draft.eveningReserveKcal > 500 || draft.eveningReserveKcal >= draft.calorieTargetKcal) violations.push('evening_reserve')
  if (unsafeInstruction([...draft.focusTasks, draft.comment.title, draft.comment.summary, ...draft.comment.bullets])) violations.push('unsafe_instruction')
  return { valid: violations.length === 0, draft: violations.length ? localDraft : draft, violations }
}

export const validateWeeklyAIOutput = (output: WeeklyReviewAIOutput, current: PlanVersion, summary: WeeklyAggregate, completeness: number) => {
  const violations: string[] = []
  const insufficient = summary.morningWeightCount < 4 || summary.intakeDayCount < 4 || summary.finalizedDayCount < 4 || completeness < 55
  if (insufficient && (output.calorieAdjustmentKcal !== 0 || output.activityAdjustment.aerobicMinutesDelta !== 0 || output.activityAdjustment.strengthDaysDelta !== 0)) violations.push('insufficient_data_adjustment')
  const nextCalories = current.calorieTargetKcal + output.calorieAdjustmentKcal
  if (nextCalories < current.calorieRangeMinKcal || nextCalories > current.calorieRangeMaxKcal) violations.push('calorie_range')
  const nextAerobic = current.aerobicMinutesPerWeek + output.activityAdjustment.aerobicMinutesDelta
  const nextStrength = current.strengthDaysPerWeek + output.activityAdjustment.strengthDaysDelta
  if (nextAerobic < 0 || nextStrength < 0 || nextStrength > 4) violations.push('activity_range')
  if ((summary.averagePain ?? 0) >= 2 && (output.activityAdjustment.aerobicMinutesDelta > 0 || output.activityAdjustment.strengthDaysDelta > 0)) violations.push('pain_activity_increase')
  if (unsafeInstruction([...output.focusTasks, output.comment.title, output.comment.summary, ...output.comment.bullets])) violations.push('unsafe_instruction')
  return { valid: violations.length === 0, violations, nextCalories, nextAerobic, nextStrength, insufficient }
}
