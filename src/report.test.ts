import { describe, expect, it } from 'vitest'
import { defaultSettings } from './defaults'
import { buildReportSummary } from './report'
import type { DailyLog } from './types'

const log = (date: string, patch: Partial<DailyLog> = {}): DailyLog => ({
  id: date,
  date,
  createdAt: `${date}T08:00:00.000Z`,
  updatedAt: `${date}T08:00:00.000Z`,
  ...patch
})

describe('buildReportSummary', () => {
  it('excludes future challenge days from completeness', () => {
    const settings = { ...defaultSettings, startDate: '2026-08-01', finalWeighInDate: '2026-08-07' }
    const complete = {
      weightKg: 81,
      intakeKcal: 1800,
      proteinG: 140,
      activeKcal: 650,
      waterMl: 2600,
      sleepHours: 7.5,
      steps: 9000
    }
    const summary = buildReportSummary(settings, [log('2026-08-01', complete), log('2026-08-02', complete)], '2026-08-02')

    expect(summary.days).toHaveLength(2)
    expect(summary.completenessRate).toBe(100)
    expect(summary.completeDays).toBe(2)
  })

  it('treats missing fields as incomplete instead of zero', () => {
    const settings = { ...defaultSettings, startDate: '2026-08-01', finalWeighInDate: '2026-08-01' }
    const summary = buildReportSummary(settings, [log('2026-08-01', { weightKg: 81 })], '2026-08-01')

    expect(summary.days[0].completedFields).toBe(1)
    expect(summary.completenessRate).toBe(14)
    expect(summary.averageIntakeKcal).toBeUndefined()
  })

  it('does not add workout calories to the daily activity total', () => {
    const settings = { ...defaultSettings, startDate: '2026-08-01', finalWeighInDate: '2026-08-01' }
    const summary = buildReportSummary(settings, [log('2026-08-01', {
      activeKcal: 600,
      workouts: [{ id: 'run', type: 'run', title: '跑步', durationMinutes: 30, activeKcal: 300, source: 'apple_watch' }]
    })], '2026-08-01')

    expect(summary.averageActiveKcal).toBe(600)
  })
})
