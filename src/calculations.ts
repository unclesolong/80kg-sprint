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

export const estimatedTDEE = (log: DailyLog): number | undefined => {
  if (log.restingKcal == null || log.activeKcal == null) return undefined
  return log.restingKcal + log.activeKcal
}

export const dailyDeficit = (log: DailyLog): number | undefined => {
  const tdee = estimatedTDEE(log)
  return tdee == null || log.intakeKcal == null ? undefined : tdee - log.intakeKcal
}

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

export const achievementRate = (log: DailyLog, settings: ChallengeSettings): number => {
  const checks = [
    log.weightKg != null && log.weightCondition === 'morning_fasted',
    (log.activeKcal ?? 0) >= settings.activeKcalMinimum,
    (log.intakeKcal ?? -1) >= settings.intakeKcalMinimum && (log.intakeKcal ?? Infinity) <= settings.intakeKcalMaximum,
    (log.proteinG ?? 0) >= settings.proteinMinimumG,
    (log.waterMl ?? 0) >= settings.waterMinimumMl,
    (log.sleepHours ?? 0) >= settings.sleepMinimumHours,
    (log.exerciseMinutes ?? 0) >= settings.exerciseMinutesMinimum || (log.steps ?? 0) >= settings.stepsMinimum
  ]
  return Math.round(checks.filter(Boolean).length / checks.length * 100)
}

export const average = (values: Array<number | undefined>): number | undefined => {
  const valid = values.filter((value): value is number => value != null)
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : undefined
}
