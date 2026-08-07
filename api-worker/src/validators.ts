import type {
  FoodParseOutput,
  FoodParseRequest,
  FoodSearchRequest,
  NumericRange,
  PlanAIOutput,
  PlanGenerateRequest,
  SafetyBounds,
  SafetyRequestSnapshot,
  SelectedTargets,
  ValidationResult,
  WeeklyReviewAIOutput,
  WeeklyReviewRequest,
} from './contracts'
import type { ZodIssue, ZodType } from 'zod'
import {
  foodParseOutputZodSchema,
  planAIOutputZodSchema,
  weeklyReviewAIOutputZodSchema,
} from './schemas'

type UnknownRecord = Record<string, unknown>

const MAX_ISSUES = 24

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const exactKeys = (value: UnknownRecord, keys: readonly string[], path: string, issues: string[]) => {
  const allowed = new Set(keys)
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) issues.push(`${path}.unknown_key`)
  }
  for (const key of keys) {
    if (!(key in value)) issues.push(`${path}.${key}.required`)
  }
}

const stringValue = (
  value: unknown,
  path: string,
  issues: string[],
  options: { min?: number; max: number } = { max: 200 },
) => {
  if (typeof value !== 'string') {
    issues.push(`${path}.type`)
    return false
  }
  const min = options.min ?? 0
  if (value.length < min || value.length > options.max) issues.push(`${path}.length`)
  return true
}

const numberValue = (
  value: unknown,
  path: string,
  issues: string[],
  options: { min?: number; max?: number; integer?: boolean } = {},
) => {
  if (!isFiniteNumber(value)) {
    issues.push(`${path}.type`)
    return false
  }
  if (options.integer && !Number.isInteger(value)) issues.push(`${path}.integer`)
  if (options.min !== undefined && value < options.min) issues.push(`${path}.min`)
  if (options.max !== undefined && value > options.max) issues.push(`${path}.max`)
  return true
}

const enumValue = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
  issues: string[],
): value is T => {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    issues.push(`${path}.enum`)
    return false
  }
  return true
}

const stringArray = (
  value: unknown,
  path: string,
  issues: string[],
  options: { maxItems: number; maxLength: number },
) => {
  if (!Array.isArray(value)) {
    issues.push(`${path}.type`)
    return false
  }
  if (value.length > options.maxItems) issues.push(`${path}.max_items`)
  value.forEach((item, index) => stringValue(item, `${path}[${index}]`, issues, { max: options.maxLength }))
  return true
}

const finish = <T>(value: unknown, issues: string[]): ValidationResult<T> =>
  issues.length > 0
    ? { ok: false, issues: [...new Set(issues)].slice(0, MAX_ISSUES) }
    : { ok: true, value: value as T }

const TARGET_KEYS = [
  'calorieTargetKcal',
  'proteinMinG',
  'proteinMaxG',
  'waterTargetMl',
  'expectedWeeklyLossKg',
  'aerobicMinutesPerWeek',
  'strengthDaysPerWeek',
  'eveningReserveKcal',
] as const

const validateTargetsInto = (value: unknown, path: string, issues: string[]): value is SelectedTargets => {
  if (!isRecord(value)) {
    issues.push(`${path}.type`)
    return false
  }
  exactKeys(value, TARGET_KEYS, path, issues)
  for (const key of TARGET_KEYS) numberValue(value[key], `${path}.${key}`, issues)
  return true
}

const validateRangeInto = (value: unknown, path: string, issues: string[]): value is NumericRange => {
  if (!isRecord(value)) {
    issues.push(`${path}.type`)
    return false
  }
  exactKeys(value, ['min', 'max', 'recommended'], path, issues)
  const min = value.min
  const max = value.max
  const recommended = value.recommended
  const validMin = numberValue(min, `${path}.min`, issues, { min: 0 })
  const validMax = numberValue(max, `${path}.max`, issues, { min: 0 })
  const validRecommended = numberValue(recommended, `${path}.recommended`, issues, { min: 0 })
  if (validMin && validMax && isFiniteNumber(min) && isFiniteNumber(max) && min > max) issues.push(`${path}.order`)
  if (
    validMin &&
    validMax &&
    validRecommended &&
    isFiniteNumber(min) &&
    isFiniteNumber(max) &&
    isFiniteNumber(recommended) &&
    (recommended < min || recommended > max)
  ) {
    issues.push(`${path}.recommended_out_of_range`)
  }
  return true
}

const BOUNDS_KEYS = [
  'dailyCalories',
  'weeklyLossKg',
  'weeklyLossPercent',
  'proteinG',
  'waterMl',
  'aerobicMinutesPerWeek',
  'strengthDaysPerWeek',
  'earliestGoalDate',
  'recommendedGoalDate',
  'latestSuggestedGoalDate',
] as const

const validateBoundsInto = (value: unknown, path: string, issues: string[]): value is SafetyBounds => {
  if (!isRecord(value)) {
    issues.push(`${path}.type`)
    return false
  }
  exactKeys(value, BOUNDS_KEYS, path, issues)
  for (const key of BOUNDS_KEYS.slice(0, 7)) validateRangeInto(value[key], `${path}.${key}`, issues)
  isoDate(value.earliestGoalDate, `${path}.earliestGoalDate`, issues)
  isoDate(value.recommendedGoalDate, `${path}.recommendedGoalDate`, issues)
  isoDate(value.latestSuggestedGoalDate, `${path}.latestSuggestedGoalDate`, issues)
  if (
    typeof value.earliestGoalDate === 'string' &&
    typeof value.recommendedGoalDate === 'string' &&
    value.recommendedGoalDate < value.earliestGoalDate
  ) issues.push(`${path}.recommendedGoalDate.order`)
  if (
    typeof value.recommendedGoalDate === 'string' &&
    typeof value.latestSuggestedGoalDate === 'string' &&
    value.latestSuggestedGoalDate < value.recommendedGoalDate
  ) issues.push(`${path}.latestSuggestedGoalDate.order`)
  return true
}

const validateSafetyInto = (
  value: unknown,
  path: string,
  issues: string[],
): value is SafetyRequestSnapshot => {
  if (!isRecord(value)) {
    issues.push(`${path}.type`)
    return false
  }
  exactKeys(
    value,
    ['status', 'bounds', 'limitations', 'kidneyDisease', 'currentInjuryOrPain', 'painLevel'],
    path,
    issues,
  )
  const statusValid = enumValue(
    value.status,
    ['approved', 'needs_confirmation', 'restricted', 'blocked'],
    `${path}.status`,
    issues,
  )
  if (value.bounds !== null) validateBoundsInto(value.bounds, `${path}.bounds`, issues)
  if (value.bounds === undefined || (value.bounds !== null && !isRecord(value.bounds))) {
    issues.push(`${path}.bounds.type`)
  }
  if (statusValid && (value.status === 'approved' || value.status === 'needs_confirmation') && value.bounds === null) {
    issues.push(`${path}.bounds.required_for_status`)
  }
  stringArray(value.limitations, `${path}.limitations`, issues, { maxItems: 12, maxLength: 120 })
  if (typeof value.kidneyDisease !== 'boolean') issues.push(`${path}.kidneyDisease.type`)
  if (typeof value.currentInjuryOrPain !== 'boolean') issues.push(`${path}.currentInjuryOrPain.type`)
  if (value.painLevel !== null) numberValue(value.painLevel, `${path}.painLevel`, issues, { min: 0, max: 5 })
  if (value.painLevel === undefined) issues.push(`${path}.painLevel.required`)
  return true
}

const isoDate = (value: unknown, path: string, issues: string[]) => {
  if (!stringValue(value, path, issues, { min: 10, max: 10 })) return
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value as string)) {
    issues.push(`${path}.format`)
    return
  }
  const [year, month, day] = (value as string).split('-').map(Number)
  const roundTrip = new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10)
  if (roundTrip !== value) issues.push(`${path}.format`)
}

const zodPath = (issue: ZodIssue) => {
  let path = 'output'
  for (const segment of issue.path) {
    path += typeof segment === 'number' ? `[${segment}]` : `.${String(segment)}`
  }
  return path
}

const zodIssueCode = (issue: ZodIssue) => {
  const path = zodPath(issue)
  if (issue.code === 'unrecognized_keys') return `${path}.unknown_key`
  if (issue.code === 'too_big') return `${path}.max`
  if (issue.code === 'too_small') return `${path}.min`
  if (issue.code === 'invalid_type') return `${path}.type`
  if (issue.code === 'invalid_value') return `${path}.enum`
  return `${path}.invalid`
}

const validateAIOutputWithZod = <T>(schema: ZodType<T>, value: unknown): ValidationResult<T> => {
  const parsed = schema.safeParse(value)
  if (!parsed.success) {
    return {
      ok: false,
      issues: [...new Set(parsed.error.issues.map(zodIssueCode))].slice(0, MAX_ISSUES),
    }
  }
  return { ok: true, value: parsed.data }
}

export const validatePlanAIOutput = (value: unknown): ValidationResult<PlanAIOutput> =>
  validateAIOutputWithZod(planAIOutputZodSchema, value)

export const validateWeeklyReviewAIOutput = (value: unknown): ValidationResult<WeeklyReviewAIOutput> =>
  validateAIOutputWithZod(weeklyReviewAIOutputZodSchema, value)

export const validateFoodParseOutput = (value: unknown): ValidationResult<FoodParseOutput> =>
  validateAIOutputWithZod(foodParseOutputZodSchema, value)

export const validatePlanGenerateRequest = (value: unknown): ValidationResult<PlanGenerateRequest> => {
  const issues: string[] = []
  if (!isRecord(value)) return { ok: false, issues: ['request.type'] }
  exactKeys(value, ['profile', 'goalDate', 'safety', 'localRecommendation'], 'request', issues)

  if (!isRecord(value.profile)) {
    issues.push('request.profile.type')
  } else {
    const profile = value.profile
    exactKeys(
      profile,
      [
        'age',
        'calculationSex',
        'heightCm',
        'currentWeightKg',
        'goalWeightKg',
        'averageSteps',
        'workActivity',
        'exerciseSessionsPerWeek',
        'exerciseMinutesPerWeek',
        'dietaryPattern',
        'locale',
      ],
      'request.profile',
      issues,
    )
    numberValue(profile.age, 'request.profile.age', issues, { min: 13, max: 120, integer: true })
    enumValue(profile.calculationSex, ['male', 'female'], 'request.profile.calculationSex', issues)
    numberValue(profile.heightCm, 'request.profile.heightCm', issues, { min: 100, max: 250 })
    numberValue(profile.currentWeightKg, 'request.profile.currentWeightKg', issues, { min: 25, max: 400 })
    numberValue(profile.goalWeightKg, 'request.profile.goalWeightKg', issues, { min: 25, max: 400 })
    if (profile.averageSteps !== null) {
      numberValue(profile.averageSteps, 'request.profile.averageSteps', issues, { min: 0, max: 100_000 })
    }
    enumValue(
      profile.workActivity,
      ['sedentary', 'mixed', 'standing', 'physical'],
      'request.profile.workActivity',
      issues,
    )
    numberValue(profile.exerciseSessionsPerWeek, 'request.profile.exerciseSessionsPerWeek', issues, {
      min: 0,
      max: 21,
    })
    if (profile.exerciseMinutesPerWeek !== null) {
      numberValue(profile.exerciseMinutesPerWeek, 'request.profile.exerciseMinutesPerWeek', issues, {
        min: 0,
        max: 3_000,
      })
    }
    enumValue(
      profile.dietaryPattern,
      ['omnivore', 'vegetarian', 'vegan', 'other'],
      'request.profile.dietaryPattern',
      issues,
    )
    if (profile.locale !== 'zh-TW') issues.push('request.profile.locale.literal')
  }
  if (value.goalDate !== null) isoDate(value.goalDate, 'request.goalDate', issues)
  if (value.goalDate === undefined) issues.push('request.goalDate.required')
  validateSafetyInto(value.safety, 'request.safety', issues)

  if (!isRecord(value.localRecommendation)) {
    issues.push('request.localRecommendation.type')
  } else {
    exactKeys(value.localRecommendation, ['selectedTargets', 'focusTasks'], 'request.localRecommendation', issues)
    validateTargetsInto(value.localRecommendation.selectedTargets, 'request.localRecommendation.selectedTargets', issues)
    stringArray(value.localRecommendation.focusTasks, 'request.localRecommendation.focusTasks', issues, {
      maxItems: 4,
      maxLength: 60,
    })
  }
  return finish(value, issues)
}

export const validateWeeklyReviewRequest = (value: unknown): ValidationResult<WeeklyReviewRequest> => {
  const issues: string[] = []
  if (!isRecord(value)) return { ok: false, issues: ['request.type'] }
  exactKeys(
    value,
    ['weekStart', 'weekEnd', 'dataCompleteness', 'summary', 'currentVersion', 'safety'],
    'request',
    issues,
  )
  isoDate(value.weekStart, 'request.weekStart', issues)
  isoDate(value.weekEnd, 'request.weekEnd', issues)
  numberValue(value.dataCompleteness, 'request.dataCompleteness', issues, { min: 0, max: 1 })
  if (!isRecord(value.summary)) {
    issues.push('request.summary.type')
  } else {
    const summaryKeys = [
      'averageWeightKg',
      'weightChangeKg',
      'averageIntakeKcal',
      'averageProteinG',
      'averageWaterMl',
      'averageActiveEnergyKcal',
      'painMax',
      'completedDays',
    ] as const
    exactKeys(value.summary, summaryKeys, 'request.summary', issues)
    for (const key of summaryKeys) {
      const item = value.summary[key]
      if (key === 'completedDays') {
        numberValue(item, `request.summary.${key}`, issues, { min: 0, max: 7, integer: true })
      } else if (item !== null) {
        numberValue(item, `request.summary.${key}`, issues, {
          min: key === 'weightChangeKg' ? -20 : 0,
          max: key === 'weightChangeKg' ? 20 : key === 'painMax' ? 5 : 100_000,
        })
      }
    }
  }
  validateTargetsInto(value.currentVersion, 'request.currentVersion', issues)
  validateSafetyInto(value.safety, 'request.safety', issues)
  return finish(value, issues)
}

export const validateFoodParseRequest = (value: unknown): ValidationResult<FoodParseRequest> => {
  const issues: string[] = []
  if (!isRecord(value)) return { ok: false, issues: ['request.type'] }
  exactKeys(value, ['text', 'locale'], 'request', issues)
  stringValue(value.text, 'request.text', issues, { min: 1, max: 500 })
  if (typeof value.text === 'string' && value.text.trim().length === 0) issues.push('request.text.empty')
  if (value.locale !== 'zh-TW') issues.push('request.locale.literal')
  return finish(value, issues)
}

export const validateFoodSearchRequest = (value: unknown): ValidationResult<FoodSearchRequest> => {
  const issues: string[] = []
  if (!isRecord(value)) return { ok: false, issues: ['request.type'] }
  exactKeys(value, ['query', 'barcode', 'limit', 'locale'], 'request', issues)
  stringValue(value.query, 'request.query', issues, { min: 0, max: 120 })
  if (value.barcode !== null) {
    stringValue(value.barcode, 'request.barcode', issues, { min: 6, max: 40 })
    if (typeof value.barcode === 'string' && !/^[0-9A-Za-z-]+$/.test(value.barcode)) {
      issues.push('request.barcode.format')
    }
  }
  if (value.barcode === undefined) issues.push('request.barcode.required')
  numberValue(value.limit, 'request.limit', issues, { min: 1, max: 20, integer: true })
  if (value.locale !== 'zh-TW') issues.push('request.locale.literal')
  if (
    typeof value.query === 'string' &&
    value.query.trim().length === 0 &&
    (typeof value.barcode !== 'string' || value.barcode.length === 0)
  ) {
    issues.push('request.search_term.required')
  }
  return finish(value, issues)
}
