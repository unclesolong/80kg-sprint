import type { DailyEnergyPlan, PlanVersion, SafetyBounds } from '../planner/types'
import { array, boolean, enumeration, exactKeys, literal, nullable, number, numericEnumeration, record, text, validate, type ValidationResult } from './strictValidation'

export interface AICommentOutput {
  title: string
  summary: string
  bullets: string[]
  tone: 'supportive' | 'neutral' | 'caution'
}

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
  comment: AICommentOutput
  assumptions: Array<{ code: string; text: string }>
  warnings: Array<{ code: string; text: string }>
}

export interface WeeklyReviewAIOutput {
  schemaVersion: 1
  decision: 'maintain' | 'increase_calories' | 'decrease_calories' | 'improve_data_first' | 'recovery_priority' | 'restricted'
  calorieAdjustmentKcal: -150 | -100 | 0 | 100 | 150
  activityAdjustment: { aerobicMinutesDelta: number; strengthDaysDelta: number }
  focusTasks: string[]
  comment: AICommentOutput
  warnings: string[]
}

export interface ParsedFoodItem {
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

export interface FoodParseOutput {
  schemaVersion: 1
  items: ParsedFoodItem[]
  unparsedText: string[]
}

const parseComment = (value: unknown, path: string): AICommentOutput => {
  const data = record(value, path)
  exactKeys(data, ['title', 'summary', 'bullets', 'tone'], [], path)
  return {
    title: text(data.title, `${path}.title`, 40),
    summary: text(data.summary, `${path}.summary`, 220),
    bullets: array(data.bullets, `${path}.bullets`, 4, (item, itemPath) => text(item, itemPath, 80)),
    tone: enumeration(data.tone, ['supportive', 'neutral', 'caution'] as const, `${path}.tone`)
  }
}

const parseCodedText = (value: unknown, path: string, max: number) => {
  const data = record(value, path)
  exactKeys(data, ['code', 'text'], [], path)
  return { code: text(data.code, `${path}.code`, 64), text: text(data.text, `${path}.text`, max) }
}

export const parsePlanAIOutput = (value: unknown): ValidationResult<PlanAIOutput> => validate(() => {
  const data = record(value, 'response')
  exactKeys(data, ['schemaVersion', 'status', 'selectedTargets', 'energyPlan', 'focusTasks', 'comment', 'assumptions', 'warnings'])
  const targets = record(data.selectedTargets, 'response.selectedTargets')
  const energy = record(data.energyPlan, 'response.energyPlan')
  exactKeys(targets, ['calorieTargetKcal', 'proteinMinG', 'proteinMaxG', 'waterTargetMl', 'expectedWeeklyLossKg', 'aerobicMinutesPerWeek', 'strengthDaysPerWeek', 'eveningReserveKcal'], [], 'response.selectedTargets')
  exactKeys(energy, ['restingEnergyKcal', 'activeEnergyKcal', 'estimatedTdeeKcal', 'source', 'confidence', 'sampleCount'], [], 'response.energyPlan')
  return {
    schemaVersion: literal(data.schemaVersion, 1, 'response.schemaVersion'),
    status: enumeration(data.status, ['ok', 'needs_more_data', 'restricted'] as const, 'response.status'),
    selectedTargets: {
      calorieTargetKcal: number(targets.calorieTargetKcal, 'response.selectedTargets.calorieTargetKcal'),
      proteinMinG: number(targets.proteinMinG, 'response.selectedTargets.proteinMinG'),
      proteinMaxG: number(targets.proteinMaxG, 'response.selectedTargets.proteinMaxG'),
      waterTargetMl: number(targets.waterTargetMl, 'response.selectedTargets.waterTargetMl'),
      expectedWeeklyLossKg: number(targets.expectedWeeklyLossKg, 'response.selectedTargets.expectedWeeklyLossKg'),
      aerobicMinutesPerWeek: number(targets.aerobicMinutesPerWeek, 'response.selectedTargets.aerobicMinutesPerWeek'),
      strengthDaysPerWeek: number(targets.strengthDaysPerWeek, 'response.selectedTargets.strengthDaysPerWeek'),
      eveningReserveKcal: number(targets.eveningReserveKcal, 'response.selectedTargets.eveningReserveKcal')
    },
    energyPlan: {
      restingEnergyKcal: number(energy.restingEnergyKcal, 'response.energyPlan.restingEnergyKcal', { min: 500, max: 5000 }),
      activeEnergyKcal: number(energy.activeEnergyKcal, 'response.energyPlan.activeEnergyKcal', { min: 0, max: 3000 }),
      estimatedTdeeKcal: number(energy.estimatedTdeeKcal, 'response.energyPlan.estimatedTdeeKcal', { min: 800, max: 7000 }),
      source: enumeration(energy.source, ['wearable_logs', 'profile_wearable_average', 'mifflin'] as const, 'response.energyPlan.source'),
      confidence: enumeration(energy.confidence, ['low', 'medium', 'high'] as const, 'response.energyPlan.confidence'),
      sampleCount: number(energy.sampleCount, 'response.energyPlan.sampleCount', { min: 0, max: 30 })
    },
    focusTasks: array(data.focusTasks, 'response.focusTasks', 4, (item, path) => text(item, path, 60)),
    comment: parseComment(data.comment, 'response.comment'),
    assumptions: array(data.assumptions, 'response.assumptions', 8, (item, path) => parseCodedText(item, path, 100)),
    warnings: array(data.warnings, 'response.warnings', 8, (item, path) => parseCodedText(item, path, 120))
  }
})

export const parseWeeklyReviewAIOutput = (value: unknown): ValidationResult<WeeklyReviewAIOutput> => validate(() => {
  const data = record(value, 'response')
  exactKeys(data, ['schemaVersion', 'decision', 'calorieAdjustmentKcal', 'activityAdjustment', 'focusTasks', 'comment', 'warnings'])
  const activity = record(data.activityAdjustment, 'response.activityAdjustment')
  exactKeys(activity, ['aerobicMinutesDelta', 'strengthDaysDelta'], [], 'response.activityAdjustment')
  return {
    schemaVersion: literal(data.schemaVersion, 1, 'response.schemaVersion'),
    decision: enumeration(data.decision, ['maintain', 'increase_calories', 'decrease_calories', 'improve_data_first', 'recovery_priority', 'restricted'] as const, 'response.decision'),
    calorieAdjustmentKcal: numericEnumeration(data.calorieAdjustmentKcal, [-150, -100, 0, 100, 150] as const, 'response.calorieAdjustmentKcal'),
    activityAdjustment: {
      aerobicMinutesDelta: number(activity.aerobicMinutesDelta, 'response.activityAdjustment.aerobicMinutesDelta', { min: -30, max: 30 }),
      strengthDaysDelta: number(activity.strengthDaysDelta, 'response.activityAdjustment.strengthDaysDelta', { min: -1, max: 1 })
    },
    focusTasks: array(data.focusTasks, 'response.focusTasks', 4, (item, path) => text(item, path, 60)),
    comment: parseComment(data.comment, 'response.comment'),
    warnings: array(data.warnings, 'response.warnings', 6, (item, path) => text(item, path, 120))
  }
})

export const parseFoodParseOutput = (value: unknown): ValidationResult<FoodParseOutput> => validate(() => {
  const data = record(value, 'response')
  exactKeys(data, ['schemaVersion', 'items', 'unparsedText'])
  return {
    schemaVersion: literal(data.schemaVersion, 1, 'response.schemaVersion'),
    items: array(data.items, 'response.items', 20, (item, path) => {
      const parsed = record(item, path)
      // Exact keys deliberately reject kcal, protein, macro and all other nutrition fields.
      exactKeys(parsed, ['rawText', 'normalizedName', 'amount', 'unit', 'preparation', 'weightState', 'brand', 'searchTerms', 'needsConfirmation', 'confirmationQuestion'], [], path)
      return {
        rawText: text(parsed.rawText, `${path}.rawText`, 200),
        normalizedName: text(parsed.normalizedName, `${path}.normalizedName`, 100),
        amount: nullable(parsed.amount, (amount) => number(amount, `${path}.amount`, { positive: true })),
        unit: nullable(parsed.unit, (unit) => enumeration(unit, ['g', 'ml', '份', '顆'] as const, `${path}.unit`)),
        preparation: nullable(parsed.preparation, (preparation) => text(preparation, `${path}.preparation`, 100)),
        weightState: enumeration(parsed.weightState, ['raw', 'cooked', 'unknown'] as const, `${path}.weightState`),
        brand: nullable(parsed.brand, (brand) => text(brand, `${path}.brand`, 100)),
        searchTerms: array(parsed.searchTerms, `${path}.searchTerms`, 5, (term, termPath) => text(term, termPath, 100)),
        needsConfirmation: boolean(parsed.needsConfirmation, `${path}.needsConfirmation`),
        confirmationQuestion: nullable(parsed.confirmationQuestion, (question) => text(question, `${path}.confirmationQuestion`, 240))
      }
    }),
    unparsedText: array(data.unparsedText, 'response.unparsedText', 10, (item, path) => text(item, path, 200))
  }
})

const inRange = (value: number, range: { min: number; max: number }) => value >= range.min && value <= range.max
const sameEnergyPlan = (left: DailyEnergyPlan, right: DailyEnergyPlan) => left.restingEnergyKcal === right.restingEnergyKcal && left.activeEnergyKcal === right.activeEnergyKcal && left.estimatedTdeeKcal === right.estimatedTdeeKcal && left.source === right.source && left.confidence === right.confidence && left.sampleCount === right.sampleCount

export const validatePlanAIOutputAgainstBounds = (output: PlanAIOutput, bounds: SafetyBounds, expectedEnergy?: DailyEnergyPlan): ValidationResult<PlanAIOutput> => {
  const target = output.selectedTargets
  const violations = [
    !inRange(target.calorieTargetKcal, bounds.dailyCalories) && 'selectedTargets.calorieTargetKcal',
    !inRange(target.proteinMinG, bounds.proteinG) && 'selectedTargets.proteinMinG',
    (!inRange(target.proteinMaxG, bounds.proteinG) || target.proteinMaxG < target.proteinMinG) && 'selectedTargets.proteinMaxG',
    !inRange(target.waterTargetMl, bounds.waterMl) && 'selectedTargets.waterTargetMl',
    !inRange(target.expectedWeeklyLossKg, bounds.weeklyLossKg) && 'selectedTargets.expectedWeeklyLossKg',
    !inRange(target.aerobicMinutesPerWeek, bounds.aerobicMinutesPerWeek) && 'selectedTargets.aerobicMinutesPerWeek',
    !inRange(target.strengthDaysPerWeek, bounds.strengthDaysPerWeek) && 'selectedTargets.strengthDaysPerWeek',
    (target.eveningReserveKcal < 0 || target.eveningReserveKcal >= target.calorieTargetKcal) && 'selectedTargets.eveningReserveKcal',
    Math.abs(output.energyPlan.restingEnergyKcal + output.energyPlan.activeEnergyKcal - output.energyPlan.estimatedTdeeKcal) > 100 && 'energyPlan.estimatedTdeeKcal',
    expectedEnergy && !sameEnergyPlan(output.energyPlan, expectedEnergy) && 'energyPlan.provenance'
  ].filter(Boolean) as string[]
  return violations.length ? { valid: false, issues: violations.map((field) => `${field}: outside safety bounds`) } : { valid: true, value: output }
}

export const validateWeeklyReviewAIOutputAgainstBounds = (
  output: WeeklyReviewAIOutput,
  current: Pick<PlanVersion, 'calorieTargetKcal' | 'aerobicMinutesPerWeek' | 'strengthDaysPerWeek'>,
  bounds: SafetyBounds,
  limitations: readonly string[] = []
): ValidationResult<WeeklyReviewAIOutput> => {
  const nextCalories = current.calorieTargetKcal + output.calorieAdjustmentKcal
  const nextAerobic = current.aerobicMinutesPerWeek + output.activityAdjustment.aerobicMinutesDelta
  const nextStrength = current.strengthDaysPerWeek + output.activityAdjustment.strengthDaysDelta
  const issues: string[] = []
  if (!inRange(nextCalories, bounds.dailyCalories)) issues.push('calorieAdjustmentKcal: outside safety bounds')
  if (!inRange(nextAerobic, bounds.aerobicMinutesPerWeek)) issues.push('activityAdjustment.aerobicMinutesDelta: outside safety bounds')
  if (!inRange(nextStrength, bounds.strengthDaysPerWeek)) issues.push('activityAdjustment.strengthDaysDelta: outside safety bounds')
  if (limitations.includes('current_injury') && output.activityAdjustment.aerobicMinutesDelta > 0) issues.push('activityAdjustment.aerobicMinutesDelta: current injury')
  if (limitations.includes('current_injury') && output.activityAdjustment.strengthDaysDelta > 0) issues.push('activityAdjustment.strengthDaysDelta: current injury')
  return issues.length ? { valid: false, issues } : { valid: true, value: output }
}
