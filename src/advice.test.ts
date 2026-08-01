import { describe, expect, it } from 'vitest'
import { buildAdvice } from './advice'
import { defaultSettings, emptyLog } from './defaults'

describe('下肢恢復建議', () => {
  it('緊繃 3 以上不建議補跑', () => {
    const current = { ...emptyLog('2026-08-02'), lowerLegTightness: 3 as const, activeKcal: 300 }
    const text = buildAdvice(current, [current], defaultSettings).map((item) => item.text).join(' ')
    expect(text).toContain('不追 660')
    expect(text).not.toContain('超慢跑')
  })

  it('緊繃 2 只建議輕鬆走路', () => {
    const current = { ...emptyLog('2026-08-02'), lowerLegTightness: 2 as const, activeKcal: 300 }
    const text = buildAdvice(current, [current], defaultSettings).map((item) => item.text).join(' ')
    expect(text).toContain('不補跑')
    expect(text).toContain('輕鬆走路')
  })

  it('連續兩天上升時不提高運動量', () => {
    const previous = { ...emptyLog('2026-08-01'), lowerLegTightness: 0 as const }
    const current = { ...emptyLog('2026-08-02'), lowerLegTightness: 1 as const, activeKcal: 300 }
    expect(buildAdvice(current, [previous, current], defaultSettings)[0].text).toContain('不要提高運動量')
  })
})
