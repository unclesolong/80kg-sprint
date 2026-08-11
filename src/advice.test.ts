import { describe, expect, it } from 'vitest'
import { buildAdvice } from './advice'
import { defaultSettings, emptyLog } from './defaults'

describe('活動相關不適建議', () => {
  it('不適 3 以上不會要求追活動數字', () => {
    const current = { ...emptyLog('2026-08-02'), lowerLegTightness: 3 as const, activeKcal: 300 }
    const text = buildAdvice(current, [current], defaultSettings).map((item) => item.text).join(' ')
    expect(text).toContain('不必為了達成活動數字')
    expect(text).not.toMatch(/660|500|550|超慢跑/)
  })

  it('不適 2 只提供通用恢復原則', () => {
    const current = { ...emptyLog('2026-08-02'), lowerLegTightness: 2 as const, activeKcal: 300 }
    const text = buildAdvice(current, [current], defaultSettings).map((item) => item.text).join(' ')
    expect(text).toContain('避免會加重症狀的運動')
    expect(text).not.toContain('補跑')
  })

  it('連續兩天上升時不提高運動量', () => {
    const previous = { ...emptyLog('2026-08-01'), lowerLegTightness: 0 as const }
    const current = { ...emptyLog('2026-08-02'), lowerLegTightness: 1 as const, activeKcal: 300 }
    expect(buildAdvice(current, [previous, current], defaultSettings)[0].text).toContain('不要提高運動量')
  })

  it('純記錄模式不會把相容性數值當成飲食或活動處方', () => {
    const current = { ...emptyLog('2026-08-02'), intakeKcal: 3_000, proteinG: 0, waterMl: 0, activeKcal: 0 }
    const text = buildAdvice(current, [current], defaultSettings).map((item) => item.text).join(' ')
    expect(text).not.toMatch(/達基本目標|計畫範圍|蛋白質尚未達|白開水尚未達/)
  })
})
