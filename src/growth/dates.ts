const DAY_MS = 86_400_000

export const growthDayNumber = (date: string): number => Date.parse(`${date}T12:00:00Z`) / DAY_MS

export const growthDaysBetween = (start: string, end: string): number =>
  Math.round(growthDayNumber(end) - growthDayNumber(start))

export const addGrowthDays = (date: string, days: number): string => {
  const value = new Date(Date.parse(`${date}T12:00:00Z`) + days * DAY_MS)
  return value.toISOString().slice(0, 10)
}

/** Monday through Sunday, independent of the runtime timezone. */
export const growthWeekBounds = (date: string): { weekStart: string; weekEnd: string } => {
  const value = new Date(`${date}T12:00:00Z`)
  const day = value.getUTCDay()
  const daysFromMonday = day === 0 ? 6 : day - 1
  const weekStart = addGrowthDays(date, -daysFromMonday)
  return { weekStart, weekEnd: addGrowthDays(weekStart, 6) }
}

export const deterministicDateTime = (date: string): string => `${date}T00:00:00.000Z`
