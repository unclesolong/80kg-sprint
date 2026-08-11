import { describe, expect, it } from 'vitest'
import { appendPlanVersion, emptyPlannerSnapshot, selectDailyPlanTargetRows, selectPlanVersionByEffectiveDate, selectPlanVersionForDate } from './planSelectors'
import type { PlanVersion } from './types'

const version = (id: string, effectiveFrom: string, calorieTargetKcal: number): PlanVersion => ({
  id,
  planId: 'plan-1',
  effectiveFrom,
  goalDate: '2026-11-30',
  calorieTargetKcal,
  calorieRangeMinKcal: 1_700,
  calorieRangeMaxKcal: 2_100,
  proteinMinG: 130,
  proteinMaxG: 160,
  waterTargetMl: 2_400,
  sleepTargetMinHours: 7,
  aerobicMinutesPerWeek: 120,
  strengthDaysPerWeek: 2,
  expectedWeeklyLossKg: 0.45,
  eveningReserveKcal: 250,
  reservedTemplateIds: [],
  focusTasks: ['每天記錄'],
  comment: { title: '本週計畫', summary: '維持可持續節奏。', bullets: [], tone: 'supportive' },
  createdAt: `${effectiveFrom}T00:00:00.000Z`,
  createdBy: 'manual'
})

describe('plan version selectors', () => {
  it('歷史日期永遠選到當天生效的 immutable 版本', () => {
    const first = version('v1', '2026-08-01', 2_000)
    const second = version('v2', '2026-08-08', 1_900)
    expect(selectPlanVersionForDate([second, first], 'plan-1', '2026-08-07')).toBe(first)
    expect(selectPlanVersionForDate([second, first], 'plan-1', '2026-08-08')).toBe(second)
    expect(selectPlanVersionForDate([second, first], 'another-plan', '2026-08-08')).toBeUndefined()
  })

  it('追加新版本不會修改既有 snapshot 或舊版本', () => {
    const first = version('v1', '2026-08-01', 2_000)
    const original = { ...emptyPlannerSnapshot(), planVersions: [first] }
    const before = structuredClone(original)
    const next = appendPlanVersion(original, version('v2', '2026-08-08', 1_900))
    expect(original).toEqual(before)
    expect(next.planVersions.map((item) => item.id)).toEqual(['v1', 'v2'])
    expect(next.planVersions[0]).toEqual(first)
  })

  it('同一生效日可找到既有版本，避免每次套用都建立重複版本', () => {
    const existing = version('v2', '2026-08-08', 1_900)
    expect(selectPlanVersionByEffectiveDate([existing], 'plan-1', '2026-08-08')).toBe(existing)
    expect(selectPlanVersionByEffectiveDate([existing], 'plan-1', '2026-08-15')).toBeUndefined()
  })

  it('將新版計畫轉成攝取、活動、靜止與 TDEE 四列表格', () => {
    const current = { ...version('v3', '2026-08-10', 1_800), energyPlan: { restingEnergyKcal: 1_750, activeEnergyKcal: 450, estimatedTdeeKcal: 2_200, source: 'wearable_logs' as const, confidence: 'high' as const, sampleCount: 14 } }
    expect(selectDailyPlanTargetRows(current).map((row) => [row.key, row.valueKcal])).toEqual([['intake', 1_800], ['active', 450], ['resting', 1_750], ['tdee', 2_200]])
    expect(selectDailyPlanTargetRows(version('legacy', '2026-08-01', 2_000))).toHaveLength(1)
  })
})
