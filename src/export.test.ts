import { describe, expect, it } from 'vitest'
import { defaultSettings, emptyLog } from './defaults'
import { buildCsv, buildWeeklySummary } from './export'

const activityLog = {
  ...emptyLog('2026-08-01'),
  activeKcal: 300,
  restingKcal: 1600,
  intakeKcal: 1700,
  dayFinalized: true,
  finalizedAt: '2026-08-01T22:00:00.000Z',
  workouts: [
    { id: 'watch', type: 'walk' as const, title: '步行', durationMinutes: 30, activeKcal: 200, source: 'apple_watch' as const },
    { id: 'late', type: 'run' as const, title: '晚間跑步', durationMinutes: 20, activeKcal: 171, source: 'manual' as const, activityKcalMode: 'add_to_daily_total' as const }
  ]
}

describe('活動匯出', () => {
  it('AI 摘要分列快照、待同步與目前合計', () => {
    const summary = buildWeeklySummary(defaultSettings, [activityLog], '2026-08-01')
    expect(summary).toContain('Apple Watch／活動摘要：300 kcal')
    expect(summary).toContain('尚未反映的運動加計：171 kcal')
    expect(summary).toContain('目前活動能量合計：471 kcal')
    expect(summary).toContain('平均活動能量：471 kcal')
    expect(summary).toContain('已結算天數：1 天')
    expect(summary).toContain('最終推估赤字：371 kcal')
  })

  it('CSV 保留三種活動數字', () => {
    const csv = buildCsv([activityLog])
    expect(csv).toContain('"已結算","結算時間","需重新結算","最終赤字kcal"')
    expect(csv).toContain('"是","2026-08-01T22:00:00.000Z","否","371"')
    expect(csv).toContain('"300","171","471"')
  })

  it('未結算日不輸出最終赤字', () => {
    const summary = buildWeeklySummary(defaultSettings, [{ ...activityLog, dayFinalized: false }], '2026-08-01')
    expect(summary).toContain('日結狀態：尚未結算')
    expect(summary).toContain('最終推估赤字：—')
    expect(summary).toContain('已結算天數：0 天')
  })
})
