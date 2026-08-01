import { describe, expect, it } from 'vitest'
import { daysBetween, localDateString, parseLocalDate } from './calculations'

describe('Europe/Berlin 本地日期', () => {
  it('跨 UTC 日期時仍回傳柏林日期', () => {
    expect(localDateString(new Date('2026-07-31T22:30:00.000Z'))).toBe('2026-08-01')
  })

  it('解析 YYYY-MM-DD 不會使用 UTC 午夜', () => {
    const date = parseLocalDate('2026-08-01')
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(7)
    expect(date.getDate()).toBe(1)
  })

  it('正確計算挑戰日數', () => expect(daysBetween('2026-08-01', '2026-08-08')).toBe(7))
})
