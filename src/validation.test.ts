import { describe, expect, it } from 'vitest'
import { defaultSettings, emptyLog } from './defaults'
import { makeBackup } from './export'
import { emptyGrowthSnapshot } from './growth/engine'
import { validateBackup } from './validation'

describe('JSON 匯入驗證', () => {
  it('接受完整備份', () => {
    expect(validateBackup(makeBackup({ ...defaultSettings, onboarded: true }, [emptyLog('2026-08-01')], []))).toBe(true)
  })

  it('舊 v1 備份仍可匯入，合法 GrowthSnapshot 可選擇性加入', () => {
    const legacy = makeBackup(defaultSettings, [], [])
    const growth = emptyGrowthSnapshot('backup-cycle', 'birth-mark-4')

    expect(Object.prototype.hasOwnProperty.call(legacy, 'growth')).toBe(false)
    expect(validateBackup(legacy)).toBe(true)
    expect(validateBackup(makeBackup(defaultSettings, [], [], growth))).toBe(true)
  })

  it('growth 存在時採 fail-closed 驗證', () => {
    const base = makeBackup(defaultSettings, [], [])
    const growth = emptyGrowthSnapshot()

    expect(validateBackup({ ...base, growth: null })).toBe(false)
    expect(validateBackup({ ...base, growth: undefined })).toBe(false)
    expect(validateBackup({ ...base, growth: { ...growth, companion: { ...growth.companion, xp: -1 } } })).toBe(false)
    expect(validateBackup({ ...base, growth: { ...growth, missions: [{ id: 'malformed' }] } })).toBe(false)
  })

  it('拒絕錯誤 schema 與日誌欄位', () => {
    const invalid = { ...makeBackup(defaultSettings, [], []), schemaVersion: 2 }
    expect(validateBackup(invalid)).toBe(false)
    expect(validateBackup({ ...makeBackup(defaultSettings, [], []), logs: [{ id: 'bad' }] })).toBe(false)
  })

  it('接受合法運動加總模式並拒絕未知值', () => {
    const base = emptyLog('2026-08-01')
    const workout = { id: 'run', type: 'run' as const, title: '晚間跑步', durationMinutes: 20, activeKcal: 171, source: 'manual' as const }
    expect(validateBackup(makeBackup(defaultSettings, [{ ...base, workouts: [{ ...workout, activityKcalMode: 'add_to_daily_total' }] }], []))).toBe(true)
    expect(validateBackup(makeBackup(defaultSettings, [{ ...base, workouts: [{ ...workout, activityKcalMode: 'invalid' as never }] }], []))).toBe(false)
  })

  it('接受缺少 V02 欄位的舊備份', () => {
    const legacySettings = { ...defaultSettings } as Record<string, unknown>
    delete legacySettings.foodTemplates
    const legacyLog = { ...emptyLog('2026-08-01') } as Record<string, unknown>
    delete legacyLog.dayFinalized
    delete legacyLog.lowerLegTightness
    expect(validateBackup(makeBackup(legacySettings as unknown as typeof defaultSettings, [legacyLog as unknown as ReturnType<typeof emptyLog>], []))).toBe(true)
  })

  it('拒絕不合法的疼痛分數與日結時間', () => {
    expect(validateBackup(makeBackup(defaultSettings, [{ ...emptyLog('2026-08-01'), lowerLegTightness: 6 as never }], []))).toBe(false)
    expect(validateBackup(makeBackup(defaultSettings, [{ ...emptyLog('2026-08-01'), finalizedAt: 'not-a-time' }], []))).toBe(false)
  })
})
