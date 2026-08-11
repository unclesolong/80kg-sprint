import type { DailyEnergyPlan, PlannerDraft, PlanVersion, SafetyBounds, SafetyDecision, UserProfile, WeeklyAggregate } from '../planner/types'
import { parseFoodParseOutput, parsePlanAIOutput, parseWeeklyReviewAIOutput, validatePlanAIOutputAgainstBounds, validateWeeklyReviewAIOutputAgainstBounds, type FoodParseOutput, type PlanAIOutput, type WeeklyReviewAIOutput } from './aiSchemas'
import { createSafeHttpClient, type HttpClientOptions } from './httpClient'
import { safeServiceError, type ServiceResult } from './serviceTypes'

export interface AIHealthSummaries {
  activity?: { averageActiveKcal?: number; averageSteps?: number; averageExerciseMinutes?: number }
  sleep?: { averageHours?: number }
  nutrition?: { averageIntakeKcal?: number; averageProteinG?: number; averageWaterMl?: number }
  recovery?: { averageFatigue?: number; averageHunger?: number; averagePain?: number }
}

export interface AISafetyDetails {
  kidneyDisease?: boolean
  currentInjuryOrPain?: boolean
  painLevel?: number
}

export interface AISafetyRequestSnapshot {
  status: SafetyDecision['status']
  bounds: SafetyBounds | null
  limitations: string[]
  kidneyDisease: boolean
  currentInjuryOrPain: boolean
  painLevel: number | null
}

export interface AISelectedTargets {
  calorieTargetKcal: number
  proteinMinG: number
  proteinMaxG: number
  waterTargetMl: number
  expectedWeeklyLossKg: number
  aerobicMinutesPerWeek: number
  strengthDaysPerWeek: number
  eveningReserveKcal: number
}

/** Exact privacy-minimized request contract consumed by api-worker. */
export interface PlanAIRequest {
  profile: {
    age: number
    calculationSex: UserProfile['calculationSex']
    heightCm: number
    currentWeightKg: number
    goalWeightKg: number
    averageSteps: number | null
    workActivity: UserProfile['workActivity']
    exerciseSessionsPerWeek: number
    exerciseMinutesPerWeek: number | null
    dietaryPattern: NonNullable<UserProfile['dietaryPattern']>
    locale: 'zh-TW'
  }
  goalDate: string | null
  safety: AISafetyRequestSnapshot
  localRecommendation: { selectedTargets: AISelectedTargets; energyPlan: DailyEnergyPlan; focusTasks: string[] }
}

export interface WeeklyReviewAIRequest {
  weekStart: string
  weekEnd: string
  dataCompleteness: number
  summary: {
    averageWeightKg: number | null
    weightChangeKg: number | null
    averageIntakeKcal: number | null
    averageProteinG: number | null
    averageWaterMl: number | null
    averageActiveEnergyKcal: number | null
    painMax: number | null
    completedDays: number
  }
  currentVersion: AISelectedTargets
  safety: AISafetyRequestSnapshot
}

const finiteOrNull = (value: number | undefined) => value != null && Number.isFinite(value) ? value : null
const shortStrings = (values: readonly string[], maxItems: number, maxLength: number) => values
  .filter((value): value is string => typeof value === 'string')
  .map((value) => value.slice(0, maxLength))
  .slice(0, maxItems)

const copyBounds = (bounds: SafetyBounds | null | undefined): SafetyBounds | null => bounds ? ({
  dailyCalories: { ...bounds.dailyCalories },
  weeklyLossKg: { ...bounds.weeklyLossKg },
  weeklyLossPercent: { ...bounds.weeklyLossPercent },
  proteinG: { ...bounds.proteinG },
  waterMl: { ...bounds.waterMl },
  aerobicMinutesPerWeek: { ...bounds.aerobicMinutesPerWeek },
  strengthDaysPerWeek: { ...bounds.strengthDaysPerWeek },
  earliestGoalDate: bounds.earliestGoalDate,
  recommendedGoalDate: bounds.recommendedGoalDate,
  latestSuggestedGoalDate: bounds.latestSuggestedGoalDate
}) : null

const copySafety = (
  decision: { status: SafetyDecision['status']; limitations: readonly string[]; bounds?: SafetyBounds | null },
  details: AISafetyDetails = {}
): AISafetyRequestSnapshot => ({
  status: decision.status,
  bounds: copyBounds(decision.bounds),
  limitations: shortStrings(decision.limitations, 16, 64),
  kidneyDisease: details.kidneyDisease === true,
  currentInjuryOrPain: details.currentInjuryOrPain === true || decision.limitations.includes('current_injury'),
  painLevel: finiteOrNull(details.painLevel)
})

const targetsFromDraft = (draft: PlannerDraft): AISelectedTargets => ({
  calorieTargetKcal: draft.calorieTargetKcal,
  proteinMinG: draft.proteinMinG,
  proteinMaxG: draft.proteinMaxG,
  waterTargetMl: draft.waterTargetMl,
  expectedWeeklyLossKg: draft.expectedWeeklyLossKg,
  aerobicMinutesPerWeek: draft.aerobicMinutesPerWeek,
  strengthDaysPerWeek: draft.strengthDaysPerWeek,
  eveningReserveKcal: draft.eveningReserveKcal
})

const targetsFromVersion = (version: Pick<PlanVersion, keyof AISelectedTargets>): AISelectedTargets => ({
  calorieTargetKcal: version.calorieTargetKcal,
  proteinMinG: version.proteinMinG,
  proteinMaxG: version.proteinMaxG,
  waterTargetMl: version.waterTargetMl,
  expectedWeeklyLossKg: version.expectedWeeklyLossKg,
  aerobicMinutesPerWeek: version.aerobicMinutesPerWeek,
  strengthDaysPerWeek: version.strengthDaysPerWeek,
  eveningReserveKcal: version.eveningReserveKcal
})

/**
 * Builds an allowlisted payload. Identity, raw logs, raw notes and free-form food
 * restrictions cannot pass through. Only the aggregate pain value is used here.
 */
export const buildPlanAIRequest = (
  profile: UserProfile,
  decision: SafetyDecision,
  draft: PlannerDraft,
  summaries: AIHealthSummaries = {},
  safetyDetails: AISafetyDetails = {}
): PlanAIRequest => ({
  profile: {
    age: profile.age,
    calculationSex: profile.calculationSex,
    heightCm: profile.heightCm,
    currentWeightKg: profile.currentWeightKg,
    goalWeightKg: profile.goalWeightKg,
    averageSteps: finiteOrNull(profile.averageSteps ?? summaries.activity?.averageSteps),
    workActivity: profile.workActivity,
    exerciseSessionsPerWeek: profile.exerciseSessionsPerWeek,
    exerciseMinutesPerWeek: finiteOrNull(profile.exerciseMinutesPerWeek ?? summaries.activity?.averageExerciseMinutes),
    dietaryPattern: profile.dietaryPattern ?? 'omnivore',
    locale: 'zh-TW'
  },
  goalDate: draft.goalDate || null,
  safety: copySafety(decision, { ...safetyDetails, painLevel: safetyDetails.painLevel ?? summaries.recovery?.averagePain }),
  localRecommendation: { selectedTargets: targetsFromDraft(draft), energyPlan: { ...draft.energyPlan }, focusTasks: shortStrings(draft.focusTasks, 4, 60) }
})

const allowlistPlanRequest = (request: PlanAIRequest): PlanAIRequest => ({
  profile: {
    age: request.profile.age,
    calculationSex: request.profile.calculationSex,
    heightCm: request.profile.heightCm,
    currentWeightKg: request.profile.currentWeightKg,
    goalWeightKg: request.profile.goalWeightKg,
    averageSteps: finiteOrNull(request.profile.averageSteps ?? undefined),
    workActivity: request.profile.workActivity,
    exerciseSessionsPerWeek: request.profile.exerciseSessionsPerWeek,
    exerciseMinutesPerWeek: finiteOrNull(request.profile.exerciseMinutesPerWeek ?? undefined),
    dietaryPattern: request.profile.dietaryPattern,
    locale: 'zh-TW'
  },
  goalDate: request.goalDate || null,
  safety: copySafety(request.safety, {
    kidneyDisease: request.safety.kidneyDisease,
    currentInjuryOrPain: request.safety.currentInjuryOrPain,
    painLevel: request.safety.painLevel ?? undefined
  }),
  localRecommendation: {
    selectedTargets: { ...request.localRecommendation.selectedTargets },
    energyPlan: { ...request.localRecommendation.energyPlan },
    focusTasks: shortStrings(request.localRecommendation.focusTasks, 4, 60)
  }
})

/** weekStart/weekEnd are required by the Worker; optional defaults keep local-only callers source-compatible. */
export const buildWeeklyReviewAIRequest = (
  currentVersion: PlanVersion,
  summary: WeeklyAggregate,
  dataCompleteness: number,
  decision: SafetyDecision,
  weekStart = '',
  weekEnd = '',
  safetyDetails: AISafetyDetails = {}
): WeeklyReviewAIRequest => ({
  weekStart,
  weekEnd,
  dataCompleteness: Math.min(1, Math.max(0, dataCompleteness > 1 ? dataCompleteness / 100 : dataCompleteness)),
  summary: {
    averageWeightKg: finiteOrNull(summary.averageMorningWeightKg),
    weightChangeKg: finiteOrNull(summary.weightTrendKg),
    averageIntakeKcal: finiteOrNull(summary.averageIntakeKcal),
    averageProteinG: finiteOrNull(summary.averageProteinG),
    averageWaterMl: finiteOrNull(summary.averageWaterMl),
    averageActiveEnergyKcal: finiteOrNull(summary.averageActiveKcal),
    painMax: finiteOrNull(safetyDetails.painLevel ?? summary.averagePain),
    completedDays: Math.min(7, Math.max(0, Math.round(summary.finalizedDayCount)))
  },
  currentVersion: targetsFromVersion(currentVersion),
  safety: copySafety(decision, { ...safetyDetails, painLevel: safetyDetails.painLevel ?? summary.averagePain })
})

const allowlistWeeklyRequest = (request: WeeklyReviewAIRequest): WeeklyReviewAIRequest => ({
  weekStart: request.weekStart,
  weekEnd: request.weekEnd,
  dataCompleteness: Math.min(1, Math.max(0, request.dataCompleteness)),
  summary: {
    averageWeightKg: finiteOrNull(request.summary.averageWeightKg ?? undefined),
    weightChangeKg: finiteOrNull(request.summary.weightChangeKg ?? undefined),
    averageIntakeKcal: finiteOrNull(request.summary.averageIntakeKcal ?? undefined),
    averageProteinG: finiteOrNull(request.summary.averageProteinG ?? undefined),
    averageWaterMl: finiteOrNull(request.summary.averageWaterMl ?? undefined),
    averageActiveEnergyKcal: finiteOrNull(request.summary.averageActiveEnergyKcal ?? undefined),
    painMax: finiteOrNull(request.summary.painMax ?? undefined),
    completedDays: Math.min(7, Math.max(0, Math.round(request.summary.completedDays)))
  },
  currentVersion: { ...request.currentVersion },
  safety: copySafety(request.safety, {
    kidneyDisease: request.safety.kidneyDisease,
    currentInjuryOrPain: request.safety.currentInjuryOrPain,
    painLevel: request.safety.painLevel ?? undefined
  })
})

export interface AIClient {
  readonly configured: boolean
  generatePlan(request: PlanAIRequest, fallback?: PlanAIOutput): Promise<ServiceResult<PlanAIOutput>>
  reviewWeekly(request: WeeklyReviewAIRequest, fallback?: WeeklyReviewAIOutput): Promise<ServiceResult<WeeklyReviewAIOutput>>
  parseFood(text: string): Promise<ServiceResult<FoodParseOutput>>
}

export interface AIClientOptions extends HttpClientOptions {
  /** Pass the current Planner consent state. Omitted means no remote AI calls are allowed. */
  hasConsent?: () => boolean
}

export const createAIClient = (options: AIClientOptions = {}): AIClient => {
  const http = createSafeHttpClient(options)
  const hasConsent = options.hasConsent ?? (() => false)
  return {
    configured: http.configured,
    async generatePlan(request, fallback) {
      if (!http.configured) return { ok: false, error: safeServiceError('disabled'), fallback }
      if (!hasConsent()) return { ok: false, error: safeServiceError('consent_required'), fallback }
      let safeRequest: PlanAIRequest
      try { safeRequest = allowlistPlanRequest(request) } catch { return { ok: false, error: safeServiceError('invalid_request'), fallback } }
      if (!safeRequest.safety.bounds || safeRequest.safety.status === 'blocked' || safeRequest.safety.status === 'restricted') {
        return { ok: false, error: safeServiceError('invalid_request'), fallback }
      }
      const response = await http.request('/v1/plan/generate', { method: 'POST', body: safeRequest, aiConsent: true })
      if (!response.ok) return { ...response, fallback }
      const schema = parsePlanAIOutput(response.data)
      if (!schema.valid) return { ok: false, error: safeServiceError('invalid_response'), fallback }
      const domain = validatePlanAIOutputAgainstBounds(schema.value, safeRequest.safety.bounds, safeRequest.localRecommendation.energyPlan)
      if (!domain.valid) return { ok: false, error: safeServiceError('invalid_response'), fallback }
      if (response.meta?.source === 'fallback') return { ok: false, error: safeServiceError('unavailable'), fallback: fallback ?? domain.value }
      return { ok: true, data: domain.value, fallback: false, meta: response.meta }
    },
    async reviewWeekly(request, fallback) {
      if (!http.configured) return { ok: false, error: safeServiceError('disabled'), fallback }
      if (!hasConsent()) return { ok: false, error: safeServiceError('consent_required'), fallback }
      let safeRequest: WeeklyReviewAIRequest
      try { safeRequest = allowlistWeeklyRequest(request) } catch { return { ok: false, error: safeServiceError('invalid_request'), fallback } }
      if (!safeRequest.weekStart || !safeRequest.weekEnd || !safeRequest.safety.bounds || safeRequest.safety.status === 'blocked' || safeRequest.safety.status === 'restricted') {
        return { ok: false, error: safeServiceError('invalid_request'), fallback }
      }
      const response = await http.request('/v1/review/weekly', { method: 'POST', body: safeRequest, aiConsent: true })
      if (!response.ok) return { ...response, fallback }
      const schema = parseWeeklyReviewAIOutput(response.data)
      if (!schema.valid) return { ok: false, error: safeServiceError('invalid_response'), fallback }
      const domain = validateWeeklyReviewAIOutputAgainstBounds(schema.value, safeRequest.currentVersion, safeRequest.safety.bounds, safeRequest.safety.limitations)
      if (!domain.valid) return { ok: false, error: safeServiceError('invalid_response'), fallback }
      if (response.meta?.source === 'fallback') return { ok: false, error: safeServiceError('unavailable'), fallback: fallback ?? domain.value }
      return { ok: true, data: domain.value, fallback: false, meta: response.meta }
    },
    async parseFood(input) {
      const normalized = typeof input === 'string' ? input.trim() : ''
      const fallback: FoodParseOutput = { schemaVersion: 1, items: [], unparsedText: normalized ? [normalized.slice(0, 100)] : [] }
      if (!http.configured) return { ok: false, error: safeServiceError('disabled'), fallback }
      if (!hasConsent()) return { ok: false, error: safeServiceError('consent_required'), fallback }
      if (!normalized || normalized.length > 500) return { ok: false, error: safeServiceError('invalid_request'), fallback }
      const response = await http.request('/v1/food/parse', { method: 'POST', body: { text: normalized, locale: 'zh-TW' }, aiConsent: true })
      if (!response.ok) return { ...response, fallback }
      const schema = parseFoodParseOutput(response.data)
      if (!schema.valid) return { ok: false, error: safeServiceError('invalid_response'), fallback }
      if (response.meta?.source === 'fallback') return { ok: false, error: safeServiceError('unavailable'), fallback }
      return { ok: true, data: schema.value, fallback: false, meta: response.meta }
    }
  }
}
