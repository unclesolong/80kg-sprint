import { describe, expect, it } from 'vitest'
import { formatChartValue } from './chartFormatting'

describe('圖表格式化', () => {
  it('目標區間固定為一位小數，不顯示原始陣列', () => {
    const value = formatChartValue('targetRange', [80.15714285714286, 80.75714285714287])
    expect(value).toBe('80.2–80.8 kg')
    expect(value).not.toContain(',')
  })

  it('各類數值不顯示長小數', () => {
    expect(formatChartValue('morning', 80.15714285714286)).toBe('80.2 kg')
    expect(formatChartValue('intake', 1722.678)).toBe('1,723 kcal')
    expect(formatChartValue('sleep', 6.66666)).toBe('6.7 小時')
  })

  it('無效數值與非數字陣列不顯示', () => {
    expect(formatChartValue('morning', Number.NaN)).toBeUndefined()
    expect(formatChartValue('targetRange', [80, Number.POSITIVE_INFINITY])).toBeUndefined()
    expect(formatChartValue('targetRange', '80,81')).toBeUndefined()
  })
})
