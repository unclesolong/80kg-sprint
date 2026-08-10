import { describe, expect, it } from 'vitest'
import { defaultSettings, emptyLog } from '../defaults'
import type { ChallengeSettings, DailyLog } from '../types'
import { buildTrendDashboardModel } from './trendDashboard'

const settings: ChallengeSettings = { ...defaultSettings, startDate: '2026-08-01', finalWeighInDate: '2026-08-31' }
const date = (day: number) => `2026-08-${String(day).padStart(2, '0')}`
const log = (day: number, patch: Partial<DailyLog> = {}): DailyLog => ({ ...emptyLog(date(day)), ...patch })
const morningLogs = (count: number) => Array.from({ length: count }, (_, index) => log(index + 1, { weightKg: 81 - index * .1, weightCondition: 'morning_fasted' }))

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    Object.values(value).forEach(deepFreeze)
  }
  return value
}

describe('buildTrendDashboardModel', () => {
  it('calculates moving averages on the full series before slicing the visible range', () => {
    const model = buildTrendDashboardModel(morningLogs(16), settings, '7d')
    expect(model.fullSeries).toHaveLength(16)
    expect(model.visibleSeries).toHaveLength(7)
    expect(model.visibleSeries[0].fullDate).toBe(date(10))
    expect(model.visibleSeries[0].ma7).toBeCloseTo(80.4)
    expect(model.visibleSeries[0].trend).toBeCloseTo(80.4)
  })

  it('uses range only for visibleSeries and range-scoped recorded-day averages', () => {
    const logs = morningLogs(16).map((item, index) => ({ ...item, intakeKcal: index < 2 ? undefined : 1_700 + index, activeKcal: index % 2 ? 400 : undefined }))
    const seven = buildTrendDashboardModel(logs, settings, '7d')
    const fourteen = buildTrendDashboardModel(logs, settings, '14d')
    const all = buildTrendDashboardModel(logs, settings, 'all')
    expect(seven.fullSeries).toEqual(fourteen.fullSeries)
    expect(fourteen.fullSeries).toEqual(all.fullSeries)
    expect(seven.visibleSeries).toHaveLength(7)
    expect(fourteen.visibleSeries).toHaveLength(14)
    expect(all.visibleSeries).toHaveLength(16)
    expect(seven.averages.intakeSampleCount).toBe(7)
    expect(all.averages.intakeSampleCount).toBe(14)
  })

  it.each([
    [2, 'none'],
    [3, 'ma3'],
    [6, 'ma3'],
    [7, 'ma7']
  ] as const)('selects the correct trend source for %i morning samples', (count, source) => {
    const model = buildTrendDashboardModel(morningLogs(count), settings, 'all')
    expect(model.trendSource).toBe(source)
    expect(model.latestTrendKg == null).toBe(source === 'none')
  })

  it('does not turn missing values into zero or create a fake morning point', () => {
    const logs = [
      log(1, { weightKg: 81, intakeKcal: undefined, activeKcal: undefined }),
      log(2, { weightKg: 80.8, weightCondition: 'other', intakeKcal: 1_800, activeKcal: 0 }),
      log(3, { weightKg: 80.6, intakeKcal: 2_000, activeKcal: 400 })
    ]
    const model = buildTrendDashboardModel(logs, settings, 'all')
    expect(model.fullSeries[1].morning).toBeUndefined()
    expect(model.fullSeries[1].trend).toBeUndefined()
    expect(model.averages.intake).toBe(1_900)
    expect(model.averages.intakeSampleCount).toBe(2)
    expect(model.averages.activity).toBe(200)
    expect(model.averages.activitySampleCount).toBe(2)
  })

  it('uses finalized days only for cumulative deficit', () => {
    const logs = [
      log(1, { restingKcal: 1_500, activeKcal: 500, intakeKcal: 1_800, dayFinalized: true }),
      log(2, { restingKcal: 2_000, activeKcal: 1_000, intakeKcal: 1_000, dayFinalized: false })
    ]
    const model = buildTrendDashboardModel(logs, settings, 'all')
    expect(model.cumulativeFinalizedDeficit).toBe(200)
    expect(model.finalizedCount).toBe(1)
  })

  it('falls back to the latest visible morning when selected date does not exist', () => {
    const logs = [...morningLogs(5), log(6, { intakeKcal: 1_800 })]
    const model = buildTrendDashboardModel(logs, settings, 'all', '2099-01-01')
    expect(model.selected?.fullDate).toBe(date(5))
  })

  it('calculates change against the nearest trend at least seven calendar days earlier', () => {
    const model = buildTrendDashboardModel(morningLogs(14), settings, 'all')
    expect(model.previousWeekDeltaKg).toBeCloseTo(-.7)
    expect(model.fullSeries.at(-1)?.previousWeekDeltaKg).toBeCloseTo(-.7)
  })

  it('does not mutate frozen input logs', () => {
    const logs = morningLogs(10)
    const snapshot = structuredClone(logs)
    deepFreeze(logs)
    buildTrendDashboardModel(logs, settings, '7d', date(8))
    expect(logs).toEqual(snapshot)
  })
})
