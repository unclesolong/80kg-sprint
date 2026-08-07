import { describe, expect, it } from 'vitest'
import { activityTotals, cumulativeDeficit, dailyDeficit, dinnerBudgetSummary, effectiveActiveKcal, estimatedTDEE, fatEquivalentKg, finalizedDeficit, linearRegressionProjection, mealTotals, movingAverage, nutritionCoverageDisplay, shouldShowSevenDayAverage, sleepDurationHours, targetWeightForDate, targetWeightRangeForDate, weightPrediction, weightTrendStatus } from './calculations'
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

  it('只把尚未反映的運動加到活動快照', () => {
    const log = { ...emptyLog('2026-08-01'), activeKcal: 300, workouts: [
      { id: 'included', type: 'walk' as const, title: '步行', durationMinutes: 30, activeKcal: 200, source: 'apple_watch' as const },
      { id: 'pending', type: 'run' as const, title: '晚間跑步', durationMinutes: 20, activeKcal: 171, source: 'manual' as const, activityKcalMode: 'add_to_daily_total' as const }
    ] }
    expect(activityTotals(log)).toEqual({
      baseActiveKcal: 300,
      workoutActiveKcal: 371,
      additionalWorkoutActiveKcal: 171,
      effectiveActiveKcal: 471,
      otherActiveKcal: 100
    })
  })

  it('舊運動明細預設已包含，不改變既有總量', () => {
    const log = { ...emptyLog('2026-08-01'), activeKcal: 600, workouts: [
      { id: 'legacy', type: 'run' as const, title: '跑步', durationMinutes: 30, activeKcal: 300, source: 'apple_watch' as const }
    ] }
    expect(effectiveActiveKcal(log)).toBe(600)
  })

  it('沒有 Watch 快照時可用待加入明細作為目前值', () => {
    const pending = { ...emptyLog('2026-08-01'), workouts: [
      { id: 'manual', type: 'walk' as const, title: '步行', durationMinutes: 30, activeKcal: 120, source: 'manual' as const, activityKcalMode: 'add_to_daily_total' as const }
    ] }
    const included = { ...emptyLog('2026-08-01'), workouts: [
      { id: 'watch', type: 'walk' as const, title: '步行', durationMinutes: 30, activeKcal: 120, source: 'apple_watch' as const }
    ] }
    expect(effectiveActiveKcal(pending)).toBe(120)
    expect(effectiveActiveKcal(included)).toBeUndefined()
  })

  it('TDEE 使用快照加待同步運動，不加入已包含運動', () => {
    const log = { ...emptyLog('2026-08-01'), restingKcal: 1800, activeKcal: 300, intakeKcal: 1700, workouts: [
      { id: 'pending', type: 'run' as const, title: '晚間跑步', durationMinutes: 20, activeKcal: 171, source: 'manual' as const, activityKcalMode: 'add_to_daily_total' as const }
    ] }
    expect(estimatedTDEE(log)).toBe(2271)
    expect(dailyDeficit(log)).toBe(571)
  })

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

  it('目標使用正負 0.3 kg 區間', () => {
    const range = targetWeightRangeForDate('2026-08-01', defaultSettings)
    expect(range.lower).toBeCloseTo(80.8)
    expect(range.upper).toBeCloseTo(81.4)
  })

  it('少於 7 筆不顯示 7 日平均', () => {
    expect(shouldShowSevenDayAverage(6)).toBe(false)
    expect(shouldShowSevenDayAverage(7)).toBe(true)
  })

  it('少於 3 筆晨間體重時只顯示資料累積中', () => {
    const result = weightTrendStatus([{ ...emptyLog('2026-08-01'), weightKg: 81.1 }], '2026-08-01', defaultSettings)
    expect(result.status).toBe('collecting')
  })
})

describe('晚間結算', () => {
  it('尚未結算不提供最終赤字', () => {
    const log = { ...emptyLog('2026-08-01'), restingKcal: 1800, activeKcal: 600, intakeKcal: 1800 }
    expect(finalizedDeficit(log)).toBeUndefined()
    expect(finalizedDeficit({ ...log, dayFinalized: true })).toBe(600)
  })
})

describe('睡眠歸檔', () => {
  it('跨午夜計算前一晚睡眠', () => expect(sleepDurationHours('23:53', '06:53')).toBe(7))
  it('同一天時間不額外加 24 小時', () => expect(sleepDurationHours('00:30', '07:00')).toBe(6.5))
  it('缺少起訖時間不製造數字', () => expect(sleepDurationHours('23:30')).toBeUndefined())
})

describe('V05 衍生計算', () => {
  const line = (key: string, kcal: number, fiber?: number) => ({ key, label: key, amount: 1, unit: '份' as const, kcalPerUnit: kcal, proteinPerUnit: 10, ...(fiber == null ? {} : { fiberPerUnit: fiber }) })

  it('晚餐預算會先扣除早餐、午餐與 evening 食物', () => {
    const details = emptyLog('2026-08-07').mealDetails!
    details.breakfast = [line('breakfast', 560)]
    details.lunch = [line('lunch', 530)]
    details.evening = [line('soy-chia', 173)]
    expect(dinnerBudgetSummary(details, defaultSettings)).toMatchObject({ budget: 587, eveningKcal: 173 })
  })

  it('晚餐超標時 remaining 不會成為負數', () => {
    const details = emptyLog('2026-08-07').mealDetails!
    details.breakfast = [line('breakfast', 560)]
    details.lunch = [line('lunch', 530)]
    details.evening = [line('evening', 173)]
    details.dinner = [line('dinner', 670)]
    expect(dinnerBudgetSummary(details, defaultSettings)).toMatchObject({ budget: 587, remaining: 0, over: 83 })
  })

  it('營養欄位不完整時顯示至少與部分資料涵蓋率', () => {
    const details = emptyLog('2026-08-07').mealDetails!
    details.lunch = [line('known', 100, 7), line('unknown', 100)]
    expect(nutritionCoverageDisplay(details, 'fiber', 7)).toEqual({ coverage: 50, value: '至少 7.0 g', note: '部分資料 · 涵蓋 50%' })
  })

  it('少於 7 筆體重不顯示精確預測，7 至 13 筆標示低信心', () => {
    const points = Array.from({ length: 7 }, (_, index) => ({ date: `2026-08-0${index + 1}`, weight: 81 - index * .1 }))
    expect(weightPrediction(points.slice(0, 6), '2026-08-08')).toEqual({ confidence: 'insufficient', sampleCount: 6 })
    expect(weightPrediction(points, '2026-08-08')).toMatchObject({ confidence: 'low', sampleCount: 7 })
  })
})
