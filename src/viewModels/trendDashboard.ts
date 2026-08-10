import {
  dailyDeficit,
  daysBetween,
  effectiveActiveKcal,
  estimatedTDEE,
  finalizedCumulativeDeficit,
  movingAverage,
  targetWeightForDate,
  targetWeightRangeForDate,
  weightPrediction
} from '../calculations'
import type { PredictionConfidence, TrendStatus } from '../calculations'
import type { ChallengeSettings, DailyLog } from '../types'

export type TrendRange = '7d' | '14d' | 'all'
export type TrendSource = 'none' | 'ma3' | 'ma7'

export interface TrendDatum {
  /** Compact visual label. Use fullDate for identity and chart selection. */
  date: string
  fullDate: string
  morning?: number
  other?: number
  ma3?: number
  ma7?: number
  trend?: number
  morningCountThroughDate: number
  previousWeekDeltaKg?: number
  target: number
  targetRange: [number, number]
  intake?: number
  tdee?: number
  deficit?: number
  active?: number
  exercise?: number
  steps?: number
  sleep?: number
  fatigue?: number
  hunger?: number
  leg?: number
  finalized: boolean
}

export interface TrendDashboardModel {
  fullSeries: TrendDatum[]
  visibleSeries: TrendDatum[]
  selected?: TrendDatum
  trendSource: TrendSource
  morningCount: number
  finalizedCount: number
  visibleFinalizedCount: number
  averages: {
    intake?: number
    intakeSampleCount: number
    activity?: number
    activitySampleCount: number
  }
  latestMorningKg?: number
  latestMorningDate?: string
  latestTrendKg?: number
  previousWeekDeltaKg?: number
  targetGapKg?: number
  status: TrendStatus
  cumulativeFinalizedDeficit: number
  prediction: {
    confidence: PredictionConfidence
    value?: number
    sampleCount: number
  }
}

const finiteValues = (values: Array<number | undefined>): number[] =>
  values.filter((value): value is number => value != null && Number.isFinite(value))

const average = (values: Array<number | undefined>): { value?: number; sampleCount: number } => {
  const samples = finiteValues(values)
  return {
    value: samples.length ? samples.reduce((sum, value) => sum + value, 0) / samples.length : undefined,
    sampleCount: samples.length
  }
}

const rangeLength: Record<Exclude<TrendRange, 'all'>, number> = { '7d': 7, '14d': 14 }

const visibleForRange = (series: TrendDatum[], range: TrendRange): TrendDatum[] =>
  range === 'all' ? series : series.slice(-rangeLength[range])

const previousTrendAtLeastSevenDaysEarlier = (series: TrendDatum[], index: number): number | undefined => {
  const current = series[index]
  if (current.trend == null) return undefined
  for (let previousIndex = index - 1; previousIndex >= 0; previousIndex -= 1) {
    const previous = series[previousIndex]
    if (daysBetween(previous.fullDate, current.fullDate) < 7) continue
    if (previous.trend != null) return previous.trend
  }
  return undefined
}

/**
 * Builds display-only trend data. It never mutates logs and intentionally
 * calculates moving averages on the complete challenge series before applying
 * the 7/14/all display window.
 */
export const buildTrendDashboardModel = (
  logs: readonly DailyLog[],
  settings: ChallengeSettings,
  range: TrendRange = '14d',
  selectedDate?: string
): TrendDashboardModel => {
  const ordered = logs
    .filter((log) => log.date >= settings.startDate && log.date <= settings.finalWeighInDate)
    .slice()
    .sort((left, right) => left.date.localeCompare(right.date))
  const morningLogs = ordered.filter((log) => log.weightCondition === 'morning_fasted' && log.weightKg != null && Number.isFinite(log.weightKg))
  const morningValues = morningLogs.map((log) => log.weightKg as number)
  const ma3 = movingAverage(morningValues, 3)
  const ma7 = movingAverage(morningValues, 7)
  const averagesByDate = new Map(morningLogs.map((log, index) => [log.date, { ma3: ma3[index], ma7: ma7[index] }]))
  const morningCount = morningLogs.length
  const trendSource: TrendSource = morningCount >= 7 ? 'ma7' : morningCount >= 3 ? 'ma3' : 'none'
  let morningCountThroughDate = 0

  const initialSeries: TrendDatum[] = ordered.map((log) => {
    const isMorning = log.weightCondition === 'morning_fasted' && log.weightKg != null && Number.isFinite(log.weightKg)
    if (isMorning) morningCountThroughDate += 1
    const moving = averagesByDate.get(log.date)
    const targetRange = targetWeightRangeForDate(log.date, settings)
    const active = effectiveActiveKcal(log)
    const trend = trendSource === 'ma7' ? moving?.ma7 : trendSource === 'ma3' ? moving?.ma3 : undefined
    return {
      date: log.date.slice(5).replace('-', '/'),
      fullDate: log.date,
      morning: isMorning ? log.weightKg : undefined,
      other: log.weightCondition === 'other' && log.weightKg != null && Number.isFinite(log.weightKg) ? log.weightKg : undefined,
      ma3: moving?.ma3,
      ma7: moving?.ma7,
      trend,
      morningCountThroughDate,
      target: targetWeightForDate(log.date, settings),
      targetRange: [targetRange.lower, targetRange.upper],
      intake: log.intakeKcal != null && Number.isFinite(log.intakeKcal) ? log.intakeKcal : undefined,
      tdee: log.dayFinalized ? estimatedTDEE(log) : undefined,
      deficit: log.dayFinalized ? dailyDeficit(log) : undefined,
      active: active != null && Number.isFinite(active) ? active : undefined,
      exercise: log.exerciseMinutes != null && Number.isFinite(log.exerciseMinutes) ? log.exerciseMinutes : undefined,
      steps: log.steps != null && Number.isFinite(log.steps) ? log.steps : undefined,
      sleep: log.sleepHours != null && Number.isFinite(log.sleepHours) ? log.sleepHours : undefined,
      fatigue: log.fatigueLevel,
      hunger: log.hungerLevel,
      leg: log.lowerLegTightness,
      finalized: log.dayFinalized === true
    }
  })

  const fullSeries = initialSeries.map((datum, index, series) => {
    const previousTrend = previousTrendAtLeastSevenDaysEarlier(series, index)
    return previousTrend == null || datum.trend == null
      ? datum
      : { ...datum, previousWeekDeltaKg: datum.trend - previousTrend }
  })
  const visibleSeries = visibleForRange(fullSeries, range)
  const selected = visibleSeries.find((datum) => datum.fullDate === selectedDate)
    ?? [...visibleSeries].reverse().find((datum) => datum.morning != null)
    ?? visibleSeries.at(-1)
  const latestMorning = [...fullSeries].reverse().find((datum) => datum.morning != null)
  const latestTrend = [...fullSeries].reverse().find((datum) => datum.trend != null)
  const intakeAverage = average(visibleSeries.map((datum) => datum.intake))
  const activityAverage = average(visibleSeries.map((datum) => datum.active))

  let status: TrendStatus = 'collecting'
  let targetGapKg: number | undefined
  if (latestTrend?.trend != null) {
    const gap = latestTrend.trend - latestTrend.targetRange[1]
    targetGapKg = Math.max(0, gap)
    status = gap <= 0 ? 'on_track' : gap <= .5 ? 'possible' : 'behind'
  }

  return {
    fullSeries,
    visibleSeries,
    selected,
    trendSource,
    morningCount,
    finalizedCount: fullSeries.filter((datum) => datum.finalized).length,
    visibleFinalizedCount: visibleSeries.filter((datum) => datum.finalized).length,
    averages: {
      intake: intakeAverage.value,
      intakeSampleCount: intakeAverage.sampleCount,
      activity: activityAverage.value,
      activitySampleCount: activityAverage.sampleCount
    },
    latestMorningKg: latestMorning?.morning,
    latestMorningDate: latestMorning?.fullDate,
    latestTrendKg: latestTrend?.trend,
    previousWeekDeltaKg: latestTrend?.previousWeekDeltaKg,
    targetGapKg,
    status,
    cumulativeFinalizedDeficit: finalizedCumulativeDeficit(ordered, settings),
    prediction: weightPrediction(morningLogs.map((log) => ({ date: log.date, weight: log.weightKg as number })), settings.finalWeighInDate)
  }
}
