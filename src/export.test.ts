import { describe, expect, it } from 'vitest'
import { defaultSettings, emptyLog } from './defaults'
import { buildCsv, buildWeeklySummary, makeBackup } from './export'
import { emptyGrowthSnapshot } from './growth/engine'

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

const exportSettings = {
  ...defaultSettings,
  startDate: '2026-08-01',
  finalWeighInDate: '2026-08-08',
  baselineWeightKg: 81.1,
  targetWeightKg: 80
}

describe('活動匯出', () => {
  it('AI 摘要分列快照、待同步與目前合計', () => {
    const summary = buildWeeklySummary(exportSettings, [activityLog], '2026-08-01')
    expect(summary).toContain('活動能量摘要：300 kcal')
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
    const summary = buildWeeklySummary(exportSettings, [{ ...activityLog, dayFinalized: false }], '2026-08-01')
    expect(summary).toContain('日結狀態：尚未結算')
    expect(summary).toContain('最終推估赤字：—')
    expect(summary).toContain('已結算天數：0 天')
  })

  it('純記錄模式不把 sentinel 或參考體重誤寫成個人目標', () => {
    const summary = buildWeeklySummary(exportSettings, [activityLog], '2026-08-01')
    expect(summary).toContain('追蹤模式：純記錄')
    expect(summary).not.toContain('目標體重：')
    expect(summary).not.toContain('目標體重：0 kg')
  })

  it('建立備份不改寫既有歷史 log 的序列化內容', () => {
    const legacy = { ...emptyLog('2026-08-01'), mealDetails: undefined, intakeKcal: 1680, proteinG: 132 }
    const before = JSON.stringify(legacy)
    const backup = makeBackup(defaultSettings, [legacy], [])
    expect(JSON.stringify(backup.logs[0])).toBe(before)
  })

  it('舊版呼叫維持無 growth 的 v1 payload，第四參數可加入完整 GrowthSnapshot', () => {
    const legacyBackup = makeBackup(defaultSettings, [], [])
    expect(legacyBackup.schemaVersion).toBe(1)
    expect(Object.prototype.hasOwnProperty.call(legacyBackup, 'growth')).toBe(false)

    const growth = emptyGrowthSnapshot('backup-cycle', 'birth-mark-1')
    const backupWithGrowth = makeBackup(defaultSettings, [], [], growth)
    expect(backupWithGrowth.schemaVersion).toBe(1)
    expect(backupWithGrowth.growth).toBe(growth)
  })
})
