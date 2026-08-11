import { emptyPlannerSnapshot } from './planSelectors'
import type { PlannerSnapshot } from './types'

export interface PlannerBackupPayload {
  schemaVersion: 1
  exportedAt: string
  planner: PlannerSnapshot
}

export const makePlannerBackup = (planner: PlannerSnapshot): PlannerBackupPayload => ({
  schemaVersion: 1,
  exportedAt: new Date().toISOString(),
  planner: JSON.parse(JSON.stringify(planner)) as PlannerSnapshot
})

type UnknownRecord = Record<string, unknown>
const record = (value: unknown): value is UnknownRecord => value != null && typeof value === 'object' && !Array.isArray(value)
const exact = (value: UnknownRecord, required: readonly string[], optional: readonly string[] = []) => {
  const allowed = new Set([...required, ...optional])
  return required.every((key) => key in value) && Object.keys(value).every((key) => allowed.has(key))
}
const text = (value: unknown) => typeof value === 'string' && value.length <= 1_000
const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
const boolean = (value: unknown) => typeof value === 'boolean'
const strings = (value: unknown, max = 100) => Array.isArray(value) && value.length <= max && value.every(text)
const enumeration = (value: unknown, values: readonly string[]) => typeof value === 'string' && values.includes(value)
const optionalNumber = (value: unknown) => value === undefined || finite(value)
const optionalText = (value: unknown) => value === undefined || text(value)

const numericRange = (value: unknown) => record(value) && exact(value, ['min', 'max', 'recommended']) && finite(value.min) && finite(value.max) && finite(value.recommended)
const safetyBounds = (value: unknown) => record(value) && exact(value, ['dailyCalories', 'weeklyLossKg', 'weeklyLossPercent', 'proteinG', 'waterMl', 'aerobicMinutesPerWeek', 'strengthDaysPerWeek', 'earliestGoalDate', 'recommendedGoalDate', 'latestSuggestedGoalDate']) &&
  numericRange(value.dailyCalories) && numericRange(value.weeklyLossKg) && numericRange(value.weeklyLossPercent) && numericRange(value.proteinG) && numericRange(value.waterMl) && numericRange(value.aerobicMinutesPerWeek) && numericRange(value.strengthDaysPerWeek) &&
  text(value.earliestGoalDate) && text(value.recommendedGoalDate) && text(value.latestSuggestedGoalDate)
const safetyDecision = (value: unknown) => record(value) && exact(value, ['status', 'reasonCodes', 'userMessages', 'limitations'], ['bounds']) &&
  enumeration(value.status, ['approved', 'restricted', 'blocked', 'needs_confirmation']) && strings(value.reasonCodes) && strings(value.userMessages) && strings(value.limitations) && (value.bounds === undefined || safetyBounds(value.bounds))
const comment = (value: unknown) => record(value) && exact(value, ['title', 'summary', 'bullets', 'tone']) && text(value.title) && text(value.summary) && strings(value.bullets, 10) && enumeration(value.tone, ['supportive', 'neutral', 'caution'])

const profile = (value: unknown) => record(value) && exact(value,
  ['id', 'age', 'calculationSex', 'heightCm', 'currentWeightKg', 'goalWeightKg', 'workActivity', 'exerciseSessionsPerWeek', 'wearable', 'foodRestrictions', 'goalPace', 'locale', 'timezone', 'createdAt', 'updatedAt'],
  ['averageSteps', 'exerciseMinutesPerWeek', 'averageRestingEnergyKcal', 'averageActiveEnergyKcal', 'wearableObservationDays', 'dietaryPattern']) &&
  value.id === 'current' && finite(value.age) && enumeration(value.calculationSex, ['male', 'female']) && finite(value.heightCm) && finite(value.currentWeightKg) && finite(value.goalWeightKg) &&
  enumeration(value.workActivity, ['sedentary', 'mixed', 'standing', 'physical']) && finite(value.exerciseSessionsPerWeek) && enumeration(value.wearable, ['apple_watch', 'other', 'none']) && strings(value.foodRestrictions, 100) &&
  enumeration(value.goalPace, ['gentle', 'standard', 'aggressive']) && value.locale === 'zh-TW' && text(value.timezone) && text(value.createdAt) && text(value.updatedAt) &&
  optionalNumber(value.averageSteps) && optionalNumber(value.exerciseMinutesPerWeek) && optionalNumber(value.averageRestingEnergyKcal) && optionalNumber(value.averageActiveEnergyKcal) && optionalNumber(value.wearableObservationDays) && (value.dietaryPattern === undefined || enumeration(value.dietaryPattern, ['omnivore', 'vegetarian', 'vegan', 'other']))

const safetyScreen = (value: unknown) => {
  const booleanKeys = ['under18', 'pregnantOrBreastfeeding', 'eatingDisorderHistory', 'diabetesOrGlucoseMedication', 'kidneyDisease', 'seriousCardiovascularDisease', 'weightLossMedication', 'currentInjuryOrPain', 'faintingChestPainOrSevereDizziness', 'purgingLaxativesDiureticsOrForcedExercise'] as const
  return record(value) && exact(value, ['id', ...booleanKeys, 'answeredAt']) && value.id === 'current' && booleanKeys.every((key) => boolean(value[key])) && text(value.answeredAt)
}

const plan = (value: unknown) => record(value) && exact(value, ['id', 'name', 'status', 'startDate', 'goalWeightKg', 'createdAt', 'source', 'safetyDecisionSnapshot']) &&
  text(value.id) && text(value.name) && enumeration(value.status, ['draft', 'active', 'paused', 'completed', 'restricted']) && text(value.startDate) && finite(value.goalWeightKg) && text(value.createdAt) && enumeration(value.source, ['manual', 'ai_assisted', 'legacy']) && safetyDecision(value.safetyDecisionSnapshot)

const versionKeys = ['id', 'planId', 'effectiveFrom', 'goalDate', 'calorieTargetKcal', 'calorieRangeMinKcal', 'calorieRangeMaxKcal', 'proteinMinG', 'proteinMaxG', 'waterTargetMl', 'sleepTargetMinHours', 'aerobicMinutesPerWeek', 'strengthDaysPerWeek', 'expectedWeeklyLossKg', 'eveningReserveKcal', 'reservedTemplateIds', 'focusTasks', 'comment', 'createdAt', 'createdBy'] as const
const energyPlan = (value: unknown) => record(value) && exact(value, ['restingEnergyKcal', 'activeEnergyKcal', 'estimatedTdeeKcal', 'source', 'confidence', 'sampleCount']) &&
  finite(value.restingEnergyKcal) && finite(value.activeEnergyKcal) && finite(value.estimatedTdeeKcal) && finite(value.sampleCount) &&
  enumeration(value.source, ['wearable_logs', 'profile_wearable_average', 'mifflin']) && enumeration(value.confidence, ['low', 'medium', 'high'])
const planVersion = (value: unknown) => record(value) && exact(value, versionKeys, ['energyPlan']) &&
  ['id', 'planId', 'effectiveFrom', 'goalDate', 'createdAt'].every((key) => text(value[key])) &&
  ['calorieTargetKcal', 'calorieRangeMinKcal', 'calorieRangeMaxKcal', 'proteinMinG', 'proteinMaxG', 'waterTargetMl', 'sleepTargetMinHours', 'aerobicMinutesPerWeek', 'strengthDaysPerWeek', 'expectedWeeklyLossKg', 'eveningReserveKcal'].every((key) => finite(value[key])) &&
  strings(value.reservedTemplateIds) && strings(value.focusTasks) && comment(value.comment) && enumeration(value.createdBy, ['manual', 'ai_assisted']) && (value.energyPlan === undefined || energyPlan(value.energyPlan))
const partialPlanVersion = (value: unknown) => record(value) && Object.keys(value).every((key) => key === 'energyPlan' || versionKeys.includes(key as typeof versionKeys[number])) &&
  (value.id === undefined || planVersion({ ...Object.fromEntries(versionKeys.map((key) => [key, ({ id: '', planId: '', effectiveFrom: '', goalDate: '', calorieTargetKcal: 0, calorieRangeMinKcal: 0, calorieRangeMaxKcal: 0, proteinMinG: 0, proteinMaxG: 0, waterTargetMl: 0, sleepTargetMinHours: 0, aerobicMinutesPerWeek: 0, strengthDaysPerWeek: 0, expectedWeeklyLossKg: 0, eveningReserveKcal: 0, reservedTemplateIds: [], focusTasks: [], comment: { title: '', summary: '', bullets: [], tone: 'neutral' }, createdAt: '', createdBy: 'manual' } as UnknownRecord)[key]])), ...value }))

const aggregate = (value: unknown) => {
  const required = ['morningWeightCount', 'intakeDayCount', 'finalizedDayCount', 'highSaltMealCount', 'bowelMovementDays', 'cumulativeFinalizedDeficitKcal']
  const optional = ['averageMorningWeightKg', 'previousAverageMorningWeightKg', 'weightTrendKg', 'averageIntakeKcal', 'averageProteinG', 'averageWaterMl', 'averageActiveKcal', 'averageSteps', 'averageSleepHours', 'averageFatigue', 'averageHunger', 'averagePain']
  return record(value) && exact(value, required, optional) && required.every((key) => finite(value[key])) && optional.every((key) => optionalNumber(value[key]))
}
const weeklyReview = (value: unknown) => record(value) && exact(value, ['id', 'planId', 'weekStart', 'weekEnd', 'dataCompleteness', 'summary', 'currentVersionId', 'comment', 'warnings', 'status', 'createdAt'], ['suggestedVersionDraft']) &&
  ['id', 'planId', 'weekStart', 'weekEnd', 'currentVersionId', 'createdAt'].every((key) => text(value[key])) && finite(value.dataCompleteness) && aggregate(value.summary) &&
  (value.suggestedVersionDraft === undefined || partialPlanVersion(value.suggestedVersionDraft)) && comment(value.comment) && strings(value.warnings) && enumeration(value.status, ['draft', 'reviewed', 'applied', 'dismissed'])
const consent = (value: unknown) => record(value) && exact(value, ['id', 'aiEnabled'], ['acceptedAt', 'withdrawnAt']) && text(value.id) && boolean(value.aiEnabled) && optionalText(value.acceptedAt) && optionalText(value.withdrawnAt)
const foodMetadata = (value: unknown) => {
  const required = ['id', 'source', 'sourceId', 'fetchedAt']
  const optional = ['mealLineKey', 'confirmedAt', 'name', 'brand', 'barcode', 'preparation', 'weightState', 'basis', 'kcal', 'proteinG', 'carbsG', 'fatG', 'fiberG', 'sodiumMg', 'completeness']
  if (!record(value) || !exact(value, required, optional) || !required.filter((key) => key !== 'source').every((key) => text(value[key])) || !enumeration(value.source, ['local', 'bls', 'usda', 'open_food_facts', 'manual', 'ai_estimate'])) return false
  if (!['mealLineKey', 'confirmedAt', 'name', 'brand', 'barcode', 'preparation'].every((key) => optionalText(value[key])) || !['kcal', 'proteinG', 'carbsG', 'fatG', 'fiberG', 'sodiumMg'].every((key) => optionalNumber(value[key]))) return false
  return (value.weightState === undefined || enumeration(value.weightState, ['raw', 'cooked', 'unknown'])) && (value.basis === undefined || enumeration(value.basis, ['100g', '100ml', 'serving'])) && (value.completeness === undefined || enumeration(value.completeness, ['complete', 'partial', 'calorie_protein_only', 'estimated']))
}

export const validatePlannerBackup = (value: unknown): value is PlannerBackupPayload => {
  if (!record(value) || !exact(value, ['schemaVersion', 'exportedAt', 'planner']) || value.schemaVersion !== 1 || !text(value.exportedAt) || !record(value.planner)) return false
  const planner = value.planner
  return exact(planner, ['plans', 'planVersions', 'weeklyReviews', 'consents', 'foodMetadata'], ['profile', 'safety']) &&
    (planner.profile === undefined || profile(planner.profile)) && (planner.safety === undefined || safetyScreen(planner.safety)) &&
    Array.isArray(planner.plans) && planner.plans.every(plan) && Array.isArray(planner.planVersions) && planner.planVersions.every(planVersion) &&
    Array.isArray(planner.weeklyReviews) && planner.weeklyReviews.every(weeklyReview) && Array.isArray(planner.consents) && planner.consents.every(consent) &&
    Array.isArray(planner.foodMetadata) && planner.foodMetadata.every(foodMetadata)
}

export const normalizePlannerBackup = (payload: PlannerBackupPayload): PlannerSnapshot => ({ ...emptyPlannerSnapshot(), ...payload.planner })
