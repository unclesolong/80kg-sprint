import { dailyDeficit } from '../calculations'
import type { FatLossPlan, PlanVersion } from '../planner/types'
import type { DailyLog } from '../types'
import { deterministicDateTime, growthDaysBetween, growthDayNumber } from './dates'
import type {
  AllowedMissionMetric,
  DailyMissionBuildInput,
  FocusTaskSpec,
  FocusTaskTemplateId,
  GrowthAffinity,
  GrowthMission,
  GrowthMissionOperator,
  GrowthMissionSlot,
  GrowthMode,
  GrowthResource,
  GrowthSafetyState,
  MissionEvaluationContext,
  WeeklyMissionBuildInput
} from './types'

const RESOURCE_BY_CATEGORY: Record<GrowthAffinity, GrowthResource> = {
  awareness: 'dew',
  nourishment: 'fruit',
  activity: 'wind_seed',
  recovery: 'moonlight'
}

const DAILY_FOCUS_IDS = new Set<FocusTaskTemplateId>([
  'balanced_intake', 'protein_range', 'water_target', 'sleep_target', 'meal_action', 'stable_recording'
])
const WEEKLY_FOCUS_IDS = new Set<FocusTaskTemplateId>(['weekly_aerobic', 'weekly_strength'])

const asFocusSpecs = (version?: PlanVersion): FocusTaskSpec[] => {
  const raw = (version as (PlanVersion & { focusTaskSpecs?: unknown }) | undefined)?.focusTaskSpecs
  if (!Array.isArray(raw)) return []
  return raw.flatMap((value) => {
    if (!value || typeof value !== 'object' || !('templateId' in value)) return []
    const templateId = (value as { templateId?: unknown }).templateId
    if (typeof templateId !== 'string' || (!DAILY_FOCUS_IDS.has(templateId as FocusTaskTemplateId) && !WEEKLY_FOCUS_IDS.has(templateId as FocusTaskTemplateId))) return []
    return [{ templateId: templateId as FocusTaskTemplateId }]
  }).slice(0, 4)
}

const hasFoodRecord = (log?: DailyLog): boolean => {
  if (!log) return false
  if (log.foodUpdatedAt != null || log.intakeKcal != null) return true
  if (log.mealDetails?.ramen.enabled) return true
  return ['breakfast', 'lunch', 'dinner', 'evening'].some((meal) =>
    log.mealDetails?.[meal as keyof Pick<NonNullable<DailyLog['mealDetails']>, 'breakfast' | 'lunch' | 'dinner' | 'evening'>]
      .some((line) => line.amount > 0))
}

const hasBodyObservation = (log?: DailyLog): boolean => Boolean(log && [
  log.sleepHours,
  log.fatigueLevel,
  log.hungerLevel,
  log.lowerLegTightness
].some((value) => value != null))

const hasActivitySummary = (log?: DailyLog): boolean => Boolean(log && (
  log.activeKcal != null || log.exerciseMinutes != null || log.steps != null || (log.workouts?.length ?? 0) > 0
))

const hasMealAction = (log?: DailyLog): boolean => Boolean(log && (
  log.breakfastPlanCompleted || log.lunchPlateCompleted || log.dinnerPlateCompleted || log.soyChiaCompleted
))

const concerningPainNote = (note?: string): boolean =>
  /胸痛|昏厥|暈眩|尖銳|無法.*走|不能.*走|chest pain|faint|cannot walk|sharp pain/iu.test(note ?? '')

const orderedThrough = (logs: readonly DailyLog[], date: string): DailyLog[] =>
  [...logs].filter((log) => log.date <= date).sort((left, right) => left.date.localeCompare(right.date))

const lastConsecutivePair = (logs: readonly DailyLog[], date: string): [DailyLog, DailyLog] | undefined => {
  const ordered = orderedThrough(logs, date)
  const current = ordered.at(-1)
  const previous = ordered.at(-2)
  return current?.date === date && previous && growthDaysBetween(previous.date, current.date) === 1
    ? [previous, current]
    : undefined
}

const worseningThree = (values: Array<number | undefined>): boolean =>
  values.length === 3 && values.every((value) => value != null) && values[0]! < values[1]! && values[1]! < values[2]!

export const deriveGrowthSafetyState = (
  date: string,
  logs: readonly DailyLog[],
  plan?: FatLossPlan
): GrowthSafetyState => {
  const ordered = orderedThrough(logs, date)
  const current = ordered.at(-1)?.date === date ? ordered.at(-1) : undefined
  const lastThree = current ? ordered.slice(-3) : []
  const pair = lastConsecutivePair(logs, date)
  const reasons: GrowthSafetyState['reasons'] = []

  const painUnsafe = (current?.lowerLegTightness ?? 0) >= 3 || concerningPainNote(current?.painNotes) ||
    worseningThree(lastThree.map((log) => log.lowerLegTightness))
  const fatigueUnsafe = (current?.fatigueLevel ?? 0) >= 4 || worseningThree(lastThree.map((log) => log.fatigueLevel))
  const injuryUnsafe = Boolean(plan?.safetyDecisionSnapshot.limitations.includes('current_injury'))
  const safetyStatusUnsafe = Boolean(plan && ['blocked', 'restricted', 'needs_confirmation'].includes(plan.safetyDecisionSnapshot.status))
  const largeDeficit = Boolean(pair && pair.every((log) => log.dayFinalized && (dailyDeficit(log) ?? 0) > 1_000))
  const highHunger = Boolean(pair && pair.every((log) => (log.hungerLevel ?? 0) >= 4))

  if (painUnsafe) reasons.push('pain')
  if (fatigueUnsafe) reasons.push('fatigue')
  if (injuryUnsafe) reasons.push('injury')
  if (safetyStatusUnsafe) reasons.push('safety_status')
  if (largeDeficit) reasons.push('large_deficit')
  if (highHunger) reasons.push('high_hunger')

  const activityUnsafe = painUnsafe || fatigueUnsafe || injuryUnsafe || safetyStatusUnsafe
  const nutritionUnsafe = largeDeficit || highHunger
  return { activityUnsafe, nutritionUnsafe, recoveryPriority: activityUnsafe || nutritionUnsafe, reasons }
}

export const resolveGrowthMode = (
  guidanceMode: DailyMissionBuildInput['guidanceMode'],
  plan?: FatLossPlan,
  planVersion?: PlanVersion
): GrowthMode => {
  if (!plan || plan.status !== 'active' || !planVersion || planVersion.planId !== plan.id) return 'tracking'
  if (['blocked', 'restricted'].includes(plan.safetyDecisionSnapshot.status)) return 'tracking'
  // A confirmed active PlanVersion supersedes the compatibility setting, just
  // like DailyTargetContext. Legacy targets without such a version stay pure tracking.
  return 'planner'
}

interface MissionTemplate {
  metric: AllowedMissionMetric
  slot: GrowthMissionSlot
  category: GrowthAffinity
  operator: GrowthMissionOperator
  targetMin?: number
  targetMax?: number
  supersedesMissionId?: string
}

const missionId = (
  cadence: 'daily' | 'weekly',
  periodKey: string,
  contextKey: string,
  slot: GrowthMissionSlot,
  metric: AllowedMissionMetric
): string => `${cadence}:${periodKey}:${contextKey}:${slot}:${metric}`

const createMission = (
  template: MissionTemplate,
  input: {
    cadence: 'daily' | 'weekly'
    periodStart: string
    periodEnd: string
    mode: GrowthMode
    plan?: FatLossPlan
    planVersion?: PlanVersion
  }
): GrowthMission => {
  const contextKey = input.planVersion?.id ?? input.mode
  const id = missionId(input.cadence, input.periodStart, contextKey, template.slot, template.metric)
  return {
    id,
    ruleVersion: 1,
    dateOrWeek: input.periodStart,
    cadence: input.cadence,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    mode: input.mode,
    slot: template.slot,
    category: template.category,
    source: 'local_rule',
    metric: template.metric,
    operator: template.operator,
    ...(template.targetMin != null ? { targetMin: template.targetMin } : {}),
    ...(template.targetMax != null ? { targetMax: template.targetMax } : {}),
    progress: 0,
    status: 'available',
    reward: RESOURCE_BY_CATEGORY[template.category],
    ...(input.plan ? { planId: input.plan.id } : {}),
    ...(input.planVersion ? { planVersionId: input.planVersion.id } : {}),
    ...(template.supersedesMissionId ? { supersedesMissionId: template.supersedesMissionId } : {}),
    createdAt: deterministicDateTime(input.periodStart)
  }
}

const coreTemplate = (version: PlanVersion, date: string, plan?: FatLossPlan): MissionTemplate => {
  const focus = asFocusSpecs(version).find((spec) => DAILY_FOCUS_IDS.has(spec.templateId))?.templateId
  const fallbacks: FocusTaskTemplateId[] = ['balanced_intake', 'protein_range', 'water_target', 'sleep_target']
  const selected = focus ?? fallbacks[Math.abs(Math.floor(growthDayNumber(date))) % fallbacks.length]
  switch (selected) {
    case 'protein_range':
      return { metric: 'protein_range', slot: 'core', category: 'nourishment', operator: 'within_range', targetMin: version.proteinMinG, targetMax: version.proteinMaxG }
    case 'water_target':
      {
        const safetyMaximum = plan?.safetyDecisionSnapshot.bounds?.waterMl.max
      return {
          metric: 'water_target', slot: 'core', category: 'nourishment', operator: safetyMaximum == null ? 'at_least' : 'within_range',
          targetMin: version.waterTargetMl,
          ...(safetyMaximum == null ? {} : { targetMax: safetyMaximum })
      }
      }
    case 'sleep_target':
      return { metric: 'sleep_target', slot: 'core', category: 'recovery', operator: 'at_least', targetMin: version.sleepTargetMinHours }
    case 'meal_action':
      return { metric: 'meal_action', slot: 'core', category: 'nourishment', operator: 'complete', targetMin: 1 }
    case 'stable_recording':
      return { metric: 'food_logged', slot: 'core', category: 'awareness', operator: 'complete', targetMin: 1 }
    case 'balanced_intake':
    default:
      return { metric: 'balanced_intake', slot: 'core', category: 'nourishment', operator: 'within_range', targetMin: version.calorieRangeMinKcal, targetMax: version.calorieRangeMaxKcal }
  }
}

export const buildDailyMissions = (input: DailyMissionBuildInput): GrowthMission[] => {
  const mode = resolveGrowthMode(input.guidanceMode, input.plan, input.planVersion)
  const safety = deriveGrowthSafetyState(input.date, input.logs, input.plan)
  const common = { cadence: 'daily' as const, periodStart: input.date, periodEnd: input.date, mode, plan: mode === 'planner' ? input.plan : undefined, planVersion: mode === 'planner' ? input.planVersion : undefined }

  if (mode === 'tracking') {
    const second: MissionTemplate = safety.recoveryPriority
      ? { metric: 'recovery_checkin', slot: 'care', category: 'recovery', operator: 'complete', targetMin: 1 }
      : { metric: 'daily_reflection', slot: 'care', category: 'awareness', operator: 'complete', targetMin: 1 }
    return [
      createMission({ metric: 'food_logged', slot: 'core', category: 'awareness', operator: 'complete', targetMin: 1 }, common),
      createMission(second, common)
    ]
  }

  const version = input.planVersion!
  const originalActivityId = missionId('daily', input.date, version.id, 'behavior', 'activity_summary')
  const behavior: MissionTemplate = safety.activityUnsafe
    ? { metric: 'recovery_checkin', slot: 'behavior', category: 'recovery', operator: 'complete', targetMin: 1, supersedesMissionId: originalActivityId }
    : { metric: 'activity_summary', slot: 'behavior', category: 'activity', operator: 'complete', targetMin: 1 }
  const care: MissionTemplate = { metric: 'daily_finalized', slot: 'care', category: 'awareness', operator: 'complete', targetMin: 1 }

  if (safety.nutritionUnsafe) return [createMission(behavior, common), createMission(care, common)]
  return [createMission(coreTemplate(version, input.date, input.plan), common), createMission(behavior, common), createMission(care, common)]
}

export const buildWeeklyMissions = (input: WeeklyMissionBuildInput): GrowthMission[] => {
  const mode = resolveGrowthMode(input.guidanceMode, input.plan, input.planVersion)
  const safety = deriveGrowthSafetyState(input.date, input.logs, input.plan)
  const common = { cadence: 'weekly' as const, periodStart: input.weekStart, periodEnd: input.weekEnd, mode, plan: mode === 'planner' ? input.plan : undefined, planVersion: mode === 'planner' ? input.planVersion : undefined }
  const stable = createMission({ metric: 'weekly_stable_recording', slot: 'weekly', category: 'awareness', operator: 'count', targetMin: 4 }, common)
  const review = createMission({ metric: 'weekly_review', slot: 'weekly', category: 'awareness', operator: 'complete', targetMin: 1 }, common)

  if (mode === 'tracking') return [
    stable,
    createMission({ metric: 'weekly_body_observation', slot: 'weekly', category: 'recovery', operator: 'count', targetMin: 4 }, common),
    review
  ]

  if (safety.recoveryPriority) return [
    stable,
    createMission({ metric: 'weekly_recovery', slot: 'weekly', category: 'recovery', operator: 'count', targetMin: 3 }, common),
    review
  ]

  const version = input.planVersion!
  const weeklyFocus = asFocusSpecs(version).find((spec) => WEEKLY_FOCUS_IDS.has(spec.templateId))?.templateId
  const preferStrength = weeklyFocus === 'weekly_strength' || (!weeklyFocus && Math.abs(Math.floor(growthDayNumber(input.weekStart))) % 2 === 1)
  const activity = preferStrength && version.strengthDaysPerWeek > 0
    ? createMission({ metric: 'weekly_strength', slot: 'weekly', category: 'activity', operator: 'count', targetMin: version.strengthDaysPerWeek }, common)
    : version.aerobicMinutesPerWeek > 0
      ? createMission({ metric: 'weekly_aerobic', slot: 'weekly', category: 'activity', operator: 'at_least', targetMin: version.aerobicMinutesPerWeek }, common)
      : version.strengthDaysPerWeek > 0
        ? createMission({ metric: 'weekly_strength', slot: 'weekly', category: 'activity', operator: 'count', targetMin: version.strengthDaysPerWeek }, common)
        : undefined
  return activity ? [stable, activity, review] : [stable, review]
}

const logsInPeriod = (mission: GrowthMission, logs: readonly DailyLog[]): DailyLog[] =>
  [...logs].filter((log) => log.date >= mission.periodStart && log.date <= mission.periodEnd)

const aerobicMinutes = (log: DailyLog): number => {
  const workouts = log.workouts ?? []
  if (workouts.length) return workouts
    .filter((workout) => ['walk', 'slow_jog', 'run', 'cycling'].includes(workout.type))
    .reduce((sum, workout) => sum + Math.max(0, workout.durationMinutes), 0)
  return Math.max(0, log.exerciseMinutes ?? 0)
}

const strengthDay = (log: DailyLog): boolean =>
  Boolean(log.workouts?.some((workout) => workout.type === 'strength' && workout.durationMinutes > 0))

const numericResult = (
  mission: GrowthMission,
  progress: number,
  waiting: boolean,
  requireFinalized: boolean,
  finalized: boolean
): GrowthMission => {
  if (waiting) return { ...mission, progress: 0, status: 'available', evaluationReason: 'waiting_for_data' }
  if (requireFinalized && !finalized) return { ...mission, progress, status: 'in_progress', evaluationReason: 'in_progress' }
  const meetsMinimum = mission.targetMin == null || progress >= mission.targetMin
  const meetsMaximum = mission.targetMax == null || progress <= mission.targetMax
  const complete = meetsMinimum && meetsMaximum
  return {
    ...mission,
    progress,
    status: complete ? 'completed' : 'in_progress',
    evaluationReason: complete ? 'completed' : mission.operator === 'within_range' ? 'outside_target' : 'in_progress'
  }
}

export const evaluateMission = (mission: GrowthMission, context: MissionEvaluationContext): GrowthMission => {
  const evaluatedAt = context.now ?? new Date().toISOString()
  if (mission.status === 'completed' || mission.status === 'superseded') return mission
  if (context.today > mission.periodEnd) return { ...mission, status: 'expired', evaluationReason: 'expired', evaluatedAt }
  const periodLogs = logsInPeriod(mission, context.logs)
  const day = mission.cadence === 'daily' ? periodLogs.find((log) => log.date === mission.periodStart) : undefined
  let evaluated: GrowthMission

  switch (mission.metric) {
    case 'food_logged':
      evaluated = numericResult(mission, hasFoodRecord(day) ? 1 : 0, !day, false, Boolean(day?.dayFinalized))
      break
    case 'daily_reflection':
      evaluated = numericResult(mission, hasBodyObservation(day) || day?.dayFinalized ? 1 : 0, !day, false, Boolean(day?.dayFinalized))
      break
    case 'daily_finalized':
      evaluated = numericResult(mission, day?.dayFinalized ? 1 : 0, !day, false, Boolean(day?.dayFinalized))
      break
    case 'balanced_intake':
      evaluated = numericResult(mission, day?.intakeKcal ?? 0, day?.intakeKcal == null, true, Boolean(day?.dayFinalized))
      break
    case 'protein_range':
      evaluated = numericResult(mission, day?.proteinG ?? 0, day?.proteinG == null, true, Boolean(day?.dayFinalized))
      break
    case 'water_target':
      evaluated = numericResult(mission, day?.waterMl ?? 0, day?.waterMl == null, true, Boolean(day?.dayFinalized))
      break
    case 'sleep_target':
      evaluated = numericResult(mission, day?.sleepHours ?? 0, day?.sleepHours == null, false, Boolean(day?.dayFinalized))
      break
    case 'meal_action':
      evaluated = numericResult(mission, hasMealAction(day) ? 1 : 0, !day, true, Boolean(day?.dayFinalized))
      break
    case 'activity_summary':
      evaluated = numericResult(mission, hasActivitySummary(day) ? 1 : 0, !day, false, Boolean(day?.dayFinalized))
      break
    case 'recovery_checkin':
      evaluated = numericResult(mission, hasBodyObservation(day) && day?.dayFinalized ? 1 : 0, !day, false, Boolean(day?.dayFinalized))
      break
    case 'weekly_stable_recording': {
      const count = periodLogs.filter((log) => hasFoodRecord(log) || log.dayFinalized).length
      evaluated = numericResult(mission, count, periodLogs.length === 0, false, true)
      break
    }
    case 'weekly_body_observation': {
      const count = periodLogs.filter(hasBodyObservation).length
      evaluated = numericResult(mission, count, periodLogs.length === 0, false, true)
      break
    }
    case 'weekly_aerobic': {
      const minutes = periodLogs.reduce((sum, log) => sum + aerobicMinutes(log), 0)
      evaluated = numericResult(mission, minutes, periodLogs.length === 0, false, true)
      break
    }
    case 'weekly_strength': {
      const count = periodLogs.filter(strengthDay).length
      evaluated = numericResult(mission, count, periodLogs.length === 0, false, true)
      break
    }
    case 'weekly_recovery': {
      const count = periodLogs.filter((log) => hasBodyObservation(log) && log.dayFinalized).length
      evaluated = numericResult(mission, count, periodLogs.length === 0, false, true)
      break
    }
    case 'weekly_review': {
      const plannerReview = context.weeklyReviews?.some((review) =>
        review.weekStart === mission.periodStart && review.weekEnd === mission.periodEnd && review.status !== 'draft')
      const localReview = context.reviewedWeekKeys?.includes(mission.periodStart)
      evaluated = numericResult(mission, plannerReview || localReview ? 1 : 0, false, false, true)
      break
    }
    default: {
      const exhaustive: never = mission.metric
      throw new Error(`Unsupported growth mission metric: ${exhaustive}`)
    }
  }
  return { ...evaluated, evaluatedAt }
}
