import { activityTotals, daysBetween, mealSubtotal, movingAverage, weightTrendStatus } from '../calculations'
import { ensureMealDetails } from '../mealOperations'
import type { FatLossPlan, PlanVersion, UserProfile } from '../planner/types'
import type { ChallengeSettings, DailyLog, RecordStage } from '../types'
import { buildDailyTargetContext, type DailyTargetContext } from './dailyTargetContext'

export const inclusiveDateCount = (start: string, end: string): number =>
  Math.max(1, daysBetween(start, end) + 1)

export const challengeDayNumber = (start: string, end: string, current: string): number => {
  const total = inclusiveDateCount(start, end)
  return Math.min(Math.max(daysBetween(start, current) + 1, 1), total)
}

export interface TodayStageModel {
  id: RecordStage
  label: string
  note: string
  status: 'done' | 'current' | 'pending'
}

export interface TodayDashboardModel {
  challenge: {
    id: string
    title: string
    startDate: string
    endDate: string
    dayNumber: number
    totalDays: number
    progressPercent: number
    targetWeightKg?: number
  }
  weight: {
    currentKg?: number
    trend3Kg?: number
    trend7Kg?: number
    morningCount: number
    trendStatus: 'collecting' | 'on_track' | 'possible' | 'behind'
  }
  calories: {
    consumedKcal: number
    minimumKcal: number
    centerKcal: number
    maximumKcal: number
    remainingToMaximumKcal: number
    overMaximumKcal: number
  }
  dinner: {
    budgetKcal: number
    eatenKcal: number
    remainingKcal: number
    overKcal: number
    breakfastKcal: number
    lunchKcal: number
    eveningKcal: number
    reservedEveningKcal: number
  }
  activity: {
    effectiveKcal?: number
    minimumKcal: number
    remainingToMinimumKcal: number
    basicGoalReached: boolean
  }
  water: {
    currentMl: number
    targetMl: number
    remainingMl: number
  }
  finalization: {
    finalized: boolean
    needsRefinalization: boolean
  }
  primaryAction: {
    title: string
    detail: string
    stage: RecordStage
    tone: 'good' | 'near' | 'warn'
  }
  stages: TodayStageModel[]
  targets: DailyTargetContext
}

export interface BuildTodayDashboardInput {
  today: string
  log: DailyLog
  logs: readonly DailyLog[]
  settings: ChallengeSettings
  plan?: FatLossPlan
  planVersion?: PlanVersion
  plannerProfile?: UserProfile
}

const rounded = (value: number) => Math.round(value).toLocaleString('zh-TW')

const mergeCurrentLog = (logs: readonly DailyLog[], current: DailyLog) => [
  ...logs.filter((item) => item.id !== current.id && item.date !== current.date),
  current
]

const buildPrimaryAction = (
  log: DailyLog,
  allLogs: readonly DailyLog[],
  targets: DailyTargetContext,
  activityRemaining: number
): TodayDashboardModel['primaryAction'] => {
  const priorLogs = allLogs
    .filter((item) => item.date < log.date)
    .sort((left, right) => left.date.localeCompare(right.date))
  const previous = priorLogs.at(-1)
  const beforePrevious = priorLogs.at(-2)
  const legIncreasing = previous?.lowerLegTightness != null && log.lowerLegTightness != null && log.lowerLegTightness > previous.lowerLegTightness
  const legWorseningTwoDays = legIncreasing && beforePrevious?.lowerLegTightness != null && previous!.lowerLegTightness! > beforePrevious.lowerLegTightness
  const concerningPainNote = /腫脹|發紅|尖銳|無法.*走|不能.*走/u.test(log.painNotes ?? '')

  if (concerningPainNote || legWorseningTwoDays) return {
    title: '下肢／足底狀況惡化，今天恢復',
    detail: '停止補跑，改成休息或不痛的輕鬆走路；若持續惡化請尋求專業評估。',
    stage: 'morning',
    tone: 'warn'
  }
  if ((log.lowerLegTightness ?? 0) >= 3) return {
    title: '今天是恢復日，不補跑',
    detail: '優先休息或不痛的低衝擊活動，不需要硬湊活動數字。',
    stage: 'morning',
    tone: 'warn'
  }
  if (log.lowerLegTightness === 2 || legIncreasing) return {
    title: '今天先保護下肢',
    detail: '不要補跑；自然走路沒有加劇時，輕鬆走 10–20 分鐘即可。',
    stage: 'morning',
    tone: 'near'
  }
  if (log.weightKg == null || log.weightCondition !== 'morning_fasted') return {
    title: '先記錄晨間體重',
    detail: '起床、上完廁所後量一次即可。',
    stage: 'morning',
    tone: 'near'
  }
  if (log.sleepHours == null) return {
    title: '補上前一晚睡眠',
    detail: '填寫睡眠時數與下肢緊繃程度。',
    stage: 'morning',
    tone: 'near'
  }
  if (log.intakeKcal == null) return {
    title: '更新今天已吃的食物',
    detail: '用批次新增，最後一次儲存。',
    stage: 'food',
    tone: 'near'
  }
  if ((log.proteinG ?? 0) < targets.protein.min) return {
    title: '下一餐優先安排蛋白質',
    detail: `目前 ${rounded(log.proteinG ?? 0)} g，目標至少 ${rounded(targets.protein.min)} g。`,
    stage: 'food',
    tone: 'near'
  }
  if ((log.waterMl ?? 0) < targets.waterTargetMl) {
    const waterStep = targets.waterTargetMl - (log.waterMl ?? 0) <= 250 ? 250 : 500
    return {
      title: `先補 ${waterStep} ml 白開水`,
      detail: `目前 ${rounded(log.waterMl ?? 0)} ml，分次補充白開水即可。`,
      stage: 'food',
      tone: 'near'
    }
  }
  const activity = activityTotals(log)
  if (activity.effectiveActiveKcal == null || log.restingKcal == null || log.exerciseMinutes == null || log.steps == null) return {
    title: '晚上抄入 Watch 四個數字',
    detail: '活動、靜態能量、運動分鐘與步數。',
    stage: 'evening',
    tone: 'near'
  }
  if (log.hungerLevel == null || log.fatigueLevel == null || log.highSaltMeal == null) return {
    title: '補上今晚的身體感受',
    detail: '記錄飢餓、疲勞與高鹽餐，再完成結算。',
    stage: 'evening',
    tone: 'near'
  }
  if (!log.dayFinalized) return log.needsRefinalization
    ? {
        title: '資料已更新，請重新結算',
        detail: '確認最新飲食、活動與身體感受後，再完成今天。',
        stage: 'evening',
        tone: 'near'
      }
    : {
        title: '今天可以完成結算',
        detail: activityRemaining === 0
          ? '活動已達基本目標，不需要硬湊。'
          : `活動還差 ${rounded(activityRemaining)} kcal；身體感覺良好時輕鬆走即可。`,
        stage: 'evening',
        tone: 'good'
      }
  return {
    title: '今天完成了，可以休息',
    detail: '若再吃東西或更新 Watch，系統會自動要求重新結算。',
    stage: 'evening',
    tone: 'good'
  }
}

const buildStages = (log: DailyLog): TodayStageModel[] => {
  const activity = activityTotals(log)
  const done = {
    morning: log.weightKg != null && log.weightCondition === 'morning_fasted' && log.sleepHours != null && log.bowelMovement !== 'unrecorded' && log.lowerLegTightness != null,
    food: log.intakeKcal != null && log.proteinG != null && log.waterMl != null,
    evening: log.dayFinalized === true
  }
  const current = !done.morning ? 'morning' : !done.food ? 'food' : 'evening'
  const definitions: Array<Omit<TodayStageModel, 'status'>> = [
    { id: 'morning', label: '早上', note: '體重 · 睡眠' },
    { id: 'food', label: '飲食', note: '餐點 · 白水' },
    { id: 'evening', label: '晚上', note: activity.effectiveActiveKcal != null ? 'Watch · 結算' : 'Watch · 感受' }
  ]
  return definitions.map((item) => ({
    ...item,
    status: done[item.id] ? 'done' : item.id === current ? 'current' : 'pending'
  }))
}

export const buildTodayDashboardModel = ({
  today,
  log,
  logs,
  settings,
  plan,
  planVersion,
  plannerProfile
}: BuildTodayDashboardInput): TodayDashboardModel => {
  const targets = buildDailyTargetContext(today, settings, planVersion)
  const startDate = plan?.startDate ?? settings.startDate
  const endDate = planVersion?.goalDate ?? settings.finalWeighInDate
  const totalDays = inclusiveDateCount(startDate, endDate)
  const dayNumber = challengeDayNumber(startDate, endDate, today)
  const progressPercent = totalDays <= 1 ? 100 : Math.round((dayNumber - 1) / (totalDays - 1) * 100)
  const allLogs = mergeCurrentLog(logs, log)
  const morning = allLogs
    .filter((item) => item.date <= today && item.weightCondition === 'morning_fasted' && item.weightKg != null)
    .sort((left, right) => left.date.localeCompare(right.date))
  const morningWeights = morning.map((item) => item.weightKg)
  const trend3Kg = movingAverage(morningWeights, 3).at(-1)
  const trend7Kg = movingAverage(morningWeights, 7).at(-1)
  const currentKg = morning.at(-1)?.weightKg
  const trendSettings: ChallengeSettings = plan && planVersion
    ? {
        ...settings,
        startDate: plan.startDate,
        finalWeighInDate: planVersion.goalDate,
        baselineWeightKg: plannerProfile?.currentWeightKg ?? morning.at(0)?.weightKg ?? settings.baselineWeightKg,
        targetWeightKg: plan.goalWeightKg
      }
    : settings
  const trendStatus = weightTrendStatus(allLogs, today, trendSettings).status

  const details = ensureMealDetails(log)
  const breakfastKcal = mealSubtotal(details, 'breakfast').kcal
  const lunchKcal = mealSubtotal(details, 'lunch').kcal
  const eatenKcal = mealSubtotal(details, 'dinner').kcal
  const eveningKcal = mealSubtotal(details, 'evening').kcal
  const reserveAlreadyLogged = Boolean(planVersion && [...details.breakfast, ...details.lunch, ...details.dinner, ...details.evening]
    .some((line) => line.templateId && planVersion.reservedTemplateIds.includes(line.templateId)))
  const reservedEveningKcal = planVersion && !reserveAlreadyLogged ? Math.max(0, planVersion.eveningReserveKcal) : 0
  const dinnerBudgetKcal = Math.max(0, targets.calories.max - breakfastKcal - lunchKcal - eveningKcal - reservedEveningKcal)
  const effectiveKcal = activityTotals(log).effectiveActiveKcal
  const activityRemaining = Math.max(0, targets.activity.minimum - (effectiveKcal ?? 0))
  const consumedKcal = log.intakeKcal ?? 0

  return {
    challenge: {
      id: plan?.id ?? `sprint-${settings.startDate}`,
      title: plan?.name ?? '80KG Sprint',
      startDate,
      endDate,
      dayNumber,
      totalDays,
      progressPercent,
      targetWeightKg: plan?.goalWeightKg ?? settings.targetWeightKg
    },
    weight: {
      currentKg,
      trend3Kg,
      trend7Kg,
      morningCount: morning.length,
      trendStatus
    },
    calories: {
      consumedKcal,
      minimumKcal: targets.calories.min,
      centerKcal: targets.calories.center,
      maximumKcal: targets.calories.max,
      remainingToMaximumKcal: Math.max(0, targets.calories.max - consumedKcal),
      overMaximumKcal: Math.max(0, consumedKcal - targets.calories.max)
    },
    dinner: {
      budgetKcal: dinnerBudgetKcal,
      eatenKcal,
      remainingKcal: Math.max(0, dinnerBudgetKcal - eatenKcal),
      overKcal: Math.max(0, eatenKcal - dinnerBudgetKcal),
      breakfastKcal,
      lunchKcal,
      eveningKcal,
      reservedEveningKcal
    },
    activity: {
      effectiveKcal,
      minimumKcal: targets.activity.minimum,
      remainingToMinimumKcal: activityRemaining,
      basicGoalReached: effectiveKcal != null && effectiveKcal >= targets.activity.minimum
    },
    water: {
      currentMl: log.waterMl ?? 0,
      targetMl: targets.waterTargetMl,
      remainingMl: Math.max(0, targets.waterTargetMl - (log.waterMl ?? 0))
    },
    finalization: {
      finalized: log.dayFinalized === true,
      needsRefinalization: log.needsRefinalization === true && log.dayFinalized !== true
    },
    primaryAction: buildPrimaryAction(log, allLogs, targets, activityRemaining),
    stages: buildStages(log),
    targets
  }
}
