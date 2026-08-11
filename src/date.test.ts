import { describe, expect, it } from 'vitest'
import { daysBetween, localDateString, parseLocalDate } from './calculations'

describe('使用者裝置本地日期', () => {
  it('使用裝置日曆日期，不固定綁定特定城市', () => {
    expect(localDateString(new Date(2026, 7, 1, 12, 0, 0))).toBe('2026-08-01')
  })

  it('解析 YYYY-MM-DD 不會使用 UTC 午夜', () => {
    const date = parseLocalDate('2026-08-01')
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(7)
    expect(date.getDate()).toBe(1)
  })

  it('正確計算追蹤日數', () => expect(daysBetween('2026-08-01', '2026-08-08')).toBe(7))
})
