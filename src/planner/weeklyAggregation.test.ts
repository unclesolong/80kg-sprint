import { describe, expect, it } from 'vitest'
import type { DailyLog } from '../types'
import { aggregateWeek, buildLocalWeeklyComment, validateWeeklyCalorieAdjustment } from './weeklyAggregation'

const log = (day: number, patch: Partial<DailyLog> = {}): DailyLog => ({
  id: `2026-08-${String(day).padStart(2, '0')}`, date: `2026-08-${String(day).padStart(2, '0')}`,
  weightKg: 80 - day * 0.05, weightCondition: 'morning_fasted', intakeKcal: 1800, proteinG: 135,
  waterMl: 2400, activeKcal: 400, restingKcal: 1800, steps: 8000, sleepHours: 7.2,
  lowerLegTightness: 1, dayFinalized: true, createdAt: '', updatedAt: '', ...patch
})

describe('weekly aggregation', () => {
  it('does not recommend calorie changes when data is incomplete', () => {
    const result = aggregateWeek([log(1), log(2)], '2026-08-01', '2026-08-07')
    expect(result.dataCompleteness).toBeLessThan(30)
    expect(buildLocalWeeklyComment(result.summary, result.dataCompleteness).decision).toBe('improve_data_first')
  })

  it('uses the full seven-day denominator and a regression slope for weight trend', () => {
    const logs = [log(1, { weightKg: 80 }), log(3, { weightKg: 79.8 }), log(7, { weightKg: 79.4 })]
    const result = aggregateWeek(logs, '2026-08-01', '2026-08-07')
    expect(result.dataCompleteness).toBeLessThan(50)
    expect(result.summary.weightTrendKg).toBeCloseTo(-0.7, 1)
  })

  it('prioritizes recovery when pain is high', () => {
    const logs = Array.from({ length: 7 }, (_, index) => log(index + 1, { lowerLegTightness: 3 }))
    const result = aggregateWeek(logs, '2026-08-01', '2026-08-07')
    expect(buildLocalWeeklyComment(result.summary, result.dataCompleteness).decision).toBe('recovery_priority')
  })

  it('only accepts the permitted weekly calorie adjustments', () => {
    expect([-150, -100, 0, 100, 150].every(validateWeeklyCalorieAdjustment)).toBe(true)
    expect(validateWeeklyCalorieAdjustment(-500)).toBe(false)
    expect(validateWeeklyCalorieAdjustment(75)).toBe(false)
  })
})
