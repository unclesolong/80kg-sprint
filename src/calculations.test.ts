import { describe, expect, it } from 'vitest'
import { cumulativeDeficit, dailyDeficit, estimatedTDEE, fatEquivalentKg, linearRegressionProjection, mealTotals, movingAverage, sleepDurationHours, targetWeightForDate } from './calculations'
import { defaultMealDetails, defaultSettings, emptyLog } from './defaults'

describe('能量計算', () => {
  it('計算 TDEE 與每日赤字', () => {
    const log = { ...emptyLog('2026-08-01'), restingKcal: 1800, activeKcal: 660, intakeKcal: 1800 }
    expect(estimatedTDEE(log)).toBe(2460)
    expect(dailyDeficit(log)).toBe(660)
  })

  it('缺少必要資料時不製造估算', () => {
    expect(dailyDeficit({ ...emptyLog('2026-08-01'), activeKcal: 660, intakeKcal: 1800 })).toBeUndefined()
  })

  it('只累加挑戰期間內有效赤字', () => {
    const logs = [
      { ...emptyLog('2026-07-31'), restingKcal: 1800, activeKcal: 600, intakeKcal: 1800 },
      { ...emptyLog('2026-08-01'), restingKcal: 1800, activeKcal: 600, intakeKcal: 1800 },
      { ...emptyLog('2026-08-02'), restingKcal: 1800, activeKcal: 700, intakeKcal: 1800 }
    ]
    expect(cumulativeDeficit(logs, defaultSettings)).toBe(1300)
  })

  it('計算脂肪等值估算', () => expect(fatEquivalentKg(7700)).toBe(1))

  it('詳細餐點同步計算三大營養素、纖維與鈉', () => {
    const details = defaultMealDetails()
    details.breakfast = [{ key: 'test', label: '測試食物', amount: 100, unit: 'g', kcalPerUnit: 2, proteinPerUnit: .2, carbsPerUnit: .3, fatPerUnit: .1, fiberPerUnit: .05, sodiumPerUnit: 1.5 }]
    details.lunch = []; details.dinner = []; details.evening = []; details.ramen.enabled = false
    expect(mealTotals(details)).toEqual({ kcal: 200, protein: 20, carbs: 30, fat: 10, fiber: 5, sodium: 150 })
  })
})

describe('體重趨勢', () => {
  it('依實際基準體重建立目標線', () => {
    const settings = { ...defaultSettings, baselineWeightKg: 82, targetWeightKg: 80 }
    expect(targetWeightForDate('2026-08-01', settings)).toBe(82)
    expect(targetWeightForDate('2026-08-04', settings)).toBeCloseTo(81.142857, 5)
    expect(targetWeightForDate('2026-08-08', settings)).toBe(80)
  })

  it('計算 3 日移動平均', () => {
    expect(movingAverage([81.1, 80.9, 80.8, 80.6], 3)).toEqual([undefined, undefined, 80.93333333333334, 80.76666666666667])
  })

  it('少於 3 筆不做回歸預測', () => {
    expect(linearRegressionProjection([{ date: '2026-08-01', weight: 81.1 }, { date: '2026-08-02', weight: 81 }], '2026-08-08')).toBeUndefined()
  })

  it('使用線性回歸預測最終日', () => {
    const result = linearRegressionProjection([
      { date: '2026-08-01', weight: 81.2 },
      { date: '2026-08-02', weight: 81.0 },
      { date: '2026-08-03', weight: 80.8 }
    ], '2026-08-08')
    expect(result).toBeCloseTo(79.8, 5)
  })
})

describe('睡眠歸檔', () => {
  it('跨午夜計算前一晚睡眠', () => expect(sleepDurationHours('23:53', '06:53')).toBe(7))
  it('同一天時間不額外加 24 小時', () => expect(sleepDurationHours('00:30', '07:00')).toBe(6.5))
  it('缺少起訖時間不製造數字', () => expect(sleepDurationHours('23:30')).toBeUndefined())
})
