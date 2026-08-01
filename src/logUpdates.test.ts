import { describe, expect, it } from 'vitest'
import { emptyLog } from './defaults'
import { applyLogPatch } from './logUpdates'

describe('結算失效規則', () => {
  it('結算後修改飲食會自動取消結算', () => {
    const finalized = { ...emptyLog('2026-08-01'), dayFinalized: true, finalizedAt: '2026-08-01T20:00:00.000Z', intakeKcal: 1800 }
    const next = applyLogPatch(finalized, { intakeKcal: 1900 }, '2026-08-01T20:10:00.000Z')
    expect(next.dayFinalized).toBe(false)
    expect(next.finalizedAt).toBeUndefined()
    expect(next.needsRefinalization).toBe(true)
  })

  it('結算後修改活動會自動取消結算', () => {
    const finalized = { ...emptyLog('2026-08-01'), dayFinalized: true, finalizedAt: '2026-08-01T20:00:00.000Z', activeKcal: 600 }
    expect(applyLogPatch(finalized, { activeKcal: 650 }).dayFinalized).toBe(false)
    expect(applyLogPatch(finalized, { slowJogMinutes: 15 }).dayFinalized).toBe(false)
  })

  it('晨間體重修正不取消晚間能量結算', () => {
    const finalized = { ...emptyLog('2026-08-01'), dayFinalized: true, finalizedAt: '2026-08-01T20:00:00.000Z' }
    expect(applyLogPatch(finalized, { weightKg: 80.8 }).dayFinalized).toBe(true)
  })
})
