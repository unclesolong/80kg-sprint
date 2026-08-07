import type { ChallengeSettings, DailyLog, MealDetails } from './types'

export const parseLocalDate = (date: string): Date => {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0)
}

export const localDateString = (date = new Date()): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export const daysBetween = (start: string, end: string): number =>
  Math.round((parseLocalDate(end).getTime() - parseLocalDate(start).getTime()) / 86_400_000)

export const sleepDurationHours = (startedAt?: string, endedAt?: string): number | undefined => {
  if (!startedAt || !endedAt) return undefined
  const [startHour, startMinute] = startedAt.split(':').map(Number)
  const [endHour, endMinute] = endedAt.split(':').map(Number)
  if (![startHour, startMinute, endHour, endMinute].every(Number.isFinite)) return undefined
  const start = startHour * 60 + startMinute
  let end = endHour * 60 + endMinute
  if (end < start) end += 24 * 60
  return Math.round((end - start) / 60 * 100) / 100
}

export interface ActivityTotals {
  baseActiveKcal?: number
  workoutActiveKcal: number
  additionalWorkoutActiveKcal: number
  effectiveActiveKcal?: number
  otherActiveKcal?: number
}

/**
 * Daily activity is a snapshot plus only the workouts explicitly marked as
 * missing from that snapshot. Legacy workout records are treated as included,
 * preserving their historical totals.
 */
export const activityTotals = (log: DailyLog): ActivityTotals => {
  const workouts = log.workouts ?? []
  const workoutActiveKcal = workouts.reduce((sum, workout) => sum + (workout.activeKcal ?? 0), 0)
  const additionalWorkoutActiveKcal = workouts.reduce((sum, workout) =>
    sum + (workout.activityKcalMode === 'add_to_daily_total' ? workout.activeKcal ?? 0 : 0), 0)
  const effectiveActiveKcal = log.activeKcal != null
    ? log.activeKcal + additionalWorkoutActiveKcal
    : additionalWorkoutActiveKcal > 0 ? additionalWorkoutActiveKcal : undefined
  return {
    baseActiveKcal: log.activeKcal,
    workoutActiveKcal,
    additionalWorkoutActiveKcal,
    effectiveActiveKcal,
    otherActiveKcal: effectiveActiveKcal == null ? undefined : Math.max(0, effectiveActiveKcal - workoutActiveKcal)
  }
}

export const effectiveActiveKcal = (log: DailyLog): number | undefined => activityTotals(log).effectiveActiveKcal

export const estimatedTDEE = (log: DailyLog): number | undefined => {
  const activeKcal = effectiveActiveKcal(log)
  if (log.restingKcal == null || activeKcal == null) return undefined
  return log.restingKcal + activeKcal
}

export const dailyDeficit = (log: DailyLog): number | undefined => {
  const tdee = estimatedTDEE(log)
  return tdee == null || log.intakeKcal == null ? undefined : tdee - log.intakeKcal
}

export const finalizedDeficit = (log: DailyLog): number | undefined => log.dayFinalized ? dailyDeficit(log) : undefined

export const finalizedCumulativeDeficit = (logs: DailyLog[], settings: ChallengeSettings): number =>
  logs
    .filter((log) => log.dayFinalized && log.date >= settings.startDate && log.date <= settings.finalWeighInDate)
    .reduce((total, log) => total + (dailyDeficit(log) ?? 0), 0)

export const cumulativeDeficit = (logs: DailyLog[], settings: ChallengeSettings): number =>
  logs
    .filter((log) => log.date >= settings.startDate && log.date <= settings.finalWeighInDate)
    .reduce((total, log) => total + (dailyDeficit(log) ?? 0), 0)

export const fatEquivalentKg = (deficit: number): number => deficit / 7700

export const energyModelWeight = (deficit: number, baseline: number): number => baseline - fatEquivalentKg(deficit)

export const targetWeightForDate = (date: string, settings: ChallengeSettings): number => {
  const total = Math.max(daysBetween(settings.startDate, settings.finalWeighInDate), 1)
  const elapsed = Math.min(Math.max(daysBetween(settings.startDate, date), 0), total)
  return settings.baselineWeightKg + (settings.targetWeightKg - settings.baselineWeightKg) * elapsed / total
}

export const targetWeightRangeForDate = (date: string, settings: ChallengeSettings, tolerance = .3) => {
  const target = targetWeightForDate(date, settings)
  return { lower: target - tolerance, upper: target + tolerance }
}

export const movingAverage = (values: Array<number | undefined>, window: number): Array<number | undefined> =>
  values.map((_, index) => {
    if (index + 1 < window) return undefined
    const slice = values.slice(index + 1 - window, index + 1)
    if (slice.some((value) => value == null)) return undefined
    return slice.reduce<number>((sum, value) => sum + (value as number), 0) / window
  })

export const linearRegressionProjection = (
  points: Array<{ date: string; weight: number }>,
  targetDate: string
): number | undefined => {
  if (points.length < 3) return undefined
  const origin = parseLocalDate(points[0].date).getTime()
  const data = points.map((point) => ({
    x: (parseLocalDate(point.date).getTime() - origin) / 86_400_000,
    y: point.weight
  }))
  const xMean = data.reduce((sum, point) => sum + point.x, 0) / data.length
  const yMean = data.reduce((sum, point) => sum + point.y, 0) / data.length
  const denominator = data.reduce((sum, point) => sum + (point.x - xMean) ** 2, 0)
  if (denominator === 0) return yMean
  const slope = data.reduce((sum, point) => sum + (point.x - xMean) * (point.y - yMean), 0) / denominator
  const x = (parseLocalDate(targetDate).getTime() - origin) / 86_400_000
  return yMean + slope * (x - xMean)
}

export type PredictionConfidence = 'insufficient' | 'low' | 'trend'

export const weightPrediction = (
  points: Array<{ date: string; weight: number }>,
  targetDate: string
): { confidence: PredictionConfidence; value?: number; sampleCount: number } => {
  const sampleCount = points.length
  if (sampleCount < 7) return { confidence: 'insufficient', sampleCount }
  const value = linearRegressionProjection(points, targetDate)
  if (value == null) return { confidence: 'insufficient', sampleCount }
  return { confidence: sampleCount < 14 ? 'low' : 'trend', value: Math.round(value * 10) / 10, sampleCount }
}

export interface NutritionTotals { kcal: number; protein: number; carbs: number; fat: number; fiber: number; sodium: number }

export const mealTotals = (details: MealDetails): NutritionTotals => {
  const lines = [...details.breakfast, ...details.lunch, ...details.dinner, ...details.evening]
  let kcal = lines.reduce((sum, line) => sum + line.amount * line.kcalPerUnit, 0)
  let protein = lines.reduce((sum, line) => sum + line.amount * line.proteinPerUnit, 0)
  let carbs = lines.reduce((sum, line) => sum + line.amount * (line.carbsPerUnit ?? 0), 0)
  let fat = lines.reduce((sum, line) => sum + line.amount * (line.fatPerUnit ?? 0), 0)
  let fiber = lines.reduce((sum, line) => sum + line.amount * (line.fiberPerUnit ?? 0), 0)
  let sodium = lines.reduce((sum, line) => sum + line.amount * (line.sodiumPerUnit ?? 0), 0)
  if (details.ramen.enabled) {
    const ramen = details.ramen
    const soupFactor = ramen.drankSoup ? 1 : 0.85
    const consumedFactor = (ramen.noodleRatio * 0.72 + ramen.seasoningRatio * 0.08 + ramen.oilRatio * 0.2) * soupFactor
    const sodiumFactor = (ramen.noodleRatio * 0.15 + ramen.seasoningRatio * 0.75 + ramen.oilRatio * 0.1) * soupFactor
    kcal += ramen.packageKcal * consumedFactor
    protein += (ramen.packageProteinG ?? 0) * consumedFactor
    carbs += (ramen.packageCarbsG ?? 0) * consumedFactor
    fat += (ramen.packageFatG ?? 0) * consumedFactor
    sodium += (ramen.packageSodiumMg ?? 0) * sodiumFactor
    kcal += ramen.chickenG * 1.2 + ramen.vegetablesG * 0.35
    protein += ramen.chickenG * 0.225 + ramen.vegetablesG * 0.02
    carbs += ramen.vegetablesG * 0.07
    fat += ramen.chickenG * 0.026 + ramen.vegetablesG * 0.002
    fiber += ramen.vegetablesG * 0.025
    sodium += ramen.chickenG * 0.45 + ramen.vegetablesG * 0.3
  }
  const oneDecimal = (value: number) => Math.round(value * 10) / 10
  return { kcal: Math.round(kcal), protein: oneDecimal(protein), carbs: oneDecimal(carbs), fat: oneDecimal(fat), fiber: oneDecimal(fiber), sodium: Math.round(sodium) }
}

export type MealName = 'breakfast' | 'lunch' | 'dinner' | 'evening'
export type OptionalNutrient = 'carbs' | 'fat' | 'fiber' | 'sodium'

export const mealSubtotal = (details: MealDetails, meal: MealName): NutritionTotals => mealTotals({
  breakfast: meal === 'breakfast' ? details.breakfast : [],
  lunch: meal === 'lunch' ? details.lunch : [],
  dinner: meal === 'dinner' ? details.dinner : [],
  evening: meal === 'evening' ? details.evening : [],
  ramen: { ...details.ramen, enabled: meal === 'dinner' && details.ramen.enabled }
})

export const dinnerBudgetSummary = (details: MealDetails, settings: ChallengeSettings) => {
  const breakfastKcal = mealSubtotal(details, 'breakfast').kcal
  const lunchKcal = mealSubtotal(details, 'lunch').kcal
  const dinnerKcal = mealSubtotal(details, 'dinner').kcal
  const eveningKcal = mealSubtotal(details, 'evening').kcal
  const budget = Math.max(0, settings.intakeKcalMaximum - breakfastKcal - lunchKcal - eveningKcal)
  return {
    breakfastKcal,
    lunchKcal,
    dinnerKcal,
    eveningKcal,
    budget,
    remaining: Math.max(0, budget - dinnerKcal),
    over: Math.max(0, dinnerKcal - budget)
  }
}

const nutrientFields: Record<OptionalNutrient, keyof MealDetails['breakfast'][number]> = {
  carbs: 'carbsPerUnit', fat: 'fatPerUnit', fiber: 'fiberPerUnit', sodium: 'sodiumPerUnit'
}

/** Percentage of consumed food rows with an explicitly supplied nutrient value. */
export const nutritionCoverage = (details: MealDetails, nutrient: OptionalNutrient): number => {
  const lines = [...details.breakfast, ...details.lunch, ...details.dinner, ...details.evening].filter((line) => line.amount > 0)
  const field = nutrientFields[nutrient]
  let total = lines.length
  let covered = lines.filter((line) => line[field] != null && Number.isFinite(line[field] as number)).length
  if (details.ramen.enabled) {
    total += 1
    const ramenKnown = nutrient === 'carbs' ? details.ramen.packageCarbsG != null
      : nutrient === 'fat' ? details.ramen.packageFatG != null
        : nutrient === 'sodium' ? details.ramen.packageSodiumMg != null
          : details.ramen.vegetablesG > 0
    if (ramenKnown) covered += 1
  }
  return total ? Math.round(covered / total * 100) : 0
}

export const nutritionCoverageDisplay = (details: MealDetails, nutrient: OptionalNutrient, value: number | undefined) => {
  const coverage = nutritionCoverage(details, nutrient)
  const unit = nutrient === 'sodium' ? 'mg' : 'g'
  const amount = nutrient === 'sodium' ? Math.round(value ?? 0).toLocaleString('zh-TW') : (value ?? 0).toFixed(1)
  return {
    coverage,
    value: `${coverage < 90 ? '至少 ' : ''}${amount} ${unit}`,
    note: coverage < 90 ? `部分資料 · 涵蓋 ${coverage}%` : '完整'
  }
}

export const achievementRate = (log: DailyLog, settings: ChallengeSettings): number => {
  const activeKcal = effectiveActiveKcal(log)
  const checks = [
    log.weightKg != null && log.weightCondition === 'morning_fasted',
    (activeKcal ?? 0) >= settings.activeKcalMinimum,
    (log.intakeKcal ?? -1) >= settings.intakeKcalMinimum && (log.intakeKcal ?? Infinity) <= settings.intakeKcalMaximum,
    (log.proteinG ?? 0) >= settings.proteinMinimumG,
    (log.waterMl ?? 0) >= settings.waterMinimumMl,
    (log.sleepHours ?? 0) >= settings.sleepMinimumHours,
    (log.exerciseMinutes ?? 0) >= settings.exerciseMinutesMinimum || (log.steps ?? 0) >= settings.stepsMinimum
  ]
  return Math.round(checks.filter(Boolean).length / checks.length * 100)
}

export interface DailyCompletion {
  completed: number
  total: 7
  items: Array<{ key: string; label: string; complete: boolean }>
}

export const dailyCompletion = (log: DailyLog, settings: ChallengeSettings): DailyCompletion => {
  const activity = activityTotals(log)
  const items = [
    { key: 'weight', label: '晨間體重', complete: log.weightKg != null && log.weightCondition === 'morning_fasted' },
    { key: 'sleep', label: '睡眠', complete: log.sleepHours != null },
    { key: 'food', label: '飲食已更新', complete: log.intakeKcal != null || log.foodUpdatedAt != null },
    { key: 'protein', label: '蛋白質', complete: (log.proteinG ?? 0) >= settings.proteinMinimumG },
    { key: 'water', label: '白開水', complete: (log.waterMl ?? 0) >= settings.waterMinimumMl },
    { key: 'activity', label: '活動資料', complete: activity.effectiveActiveKcal != null && log.restingKcal != null && log.exerciseMinutes != null && log.steps != null },
    { key: 'finalized', label: '晚間結算', complete: log.dayFinalized === true }
  ]
  return { completed: items.filter((item) => item.complete).length, total: 7, items }
}

export const remainingFoodBudget = (log: DailyLog, settings: ChallengeSettings): number =>
  Math.max(0, settings.intakeKcalMaximum - (log.intakeKcal ?? 0))

export const remainingActivity = (log: DailyLog, settings: ChallengeSettings): number =>
  Math.max(0, settings.activeKcalMinimum - (effectiveActiveKcal(log) ?? 0))

export const shouldShowSevenDayAverage = (morningWeightCount: number): boolean => morningWeightCount >= 7

export type TrendStatus = 'collecting' | 'on_track' | 'possible' | 'behind'

export const weightTrendStatus = (logs: DailyLog[], date: string, settings: ChallengeSettings): { status: TrendStatus; label: string; detail: string; trend?: number; gap?: number } => {
  const morning = logs
    .filter((log) => log.date <= date && log.weightCondition === 'morning_fasted' && log.weightKg != null)
    .sort((a, b) => a.date.localeCompare(b.date))
  if (morning.length < 3) return { status: 'collecting', label: '資料累積中', detail: '至少需要 3 筆晨間體重。' }
  const trend = movingAverage(morning.map((log) => log.weightKg), 3).at(-1)!
  const range = targetWeightRangeForDate(date, settings)
  const gap = trend - range.upper
  if (gap <= 0) return { status: 'on_track', label: '進度正常', detail: '3 日趨勢位於目前目標區間內。', trend, gap }
  if (gap <= .5) return { status: 'possible', label: '仍有機會', detail: `3 日趨勢距目標區間約 ${gap.toFixed(1)} kg。`, trend, gap }
  return { status: 'behind', label: '暫時落後', detail: `3 日趨勢高於目標區間約 ${gap.toFixed(1)} kg；先維持紀錄，不做激烈補償。`, trend, gap }
}

export const average = (values: Array<number | undefined>): number | undefined => {
  const valid = values.filter((value): value is number => value != null)
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : undefined
}
