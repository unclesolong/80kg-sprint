import { describe, expect, it } from 'vitest'
import { defaultSettings, emptyLog } from './defaults'
import { makeBackup } from './export'
import { validateBackup } from './validation'

describe('JSON 匯入驗證', () => {
  it('接受完整備份', () => {
    expect(validateBackup(makeBackup({ ...defaultSettings, onboarded: true }, [emptyLog('2026-08-01')], []))).toBe(true)
  })

  it('拒絕錯誤 schema 與日誌欄位', () => {
    const invalid = { ...makeBackup(defaultSettings, [], []), schemaVersion: 2 }
    expect(validateBackup(invalid)).toBe(false)
    expect(validateBackup({ ...makeBackup(defaultSettings, [], []), logs: [{ id: 'bad' }] })).toBe(false)
  })
})
