import { describe, expect, it } from 'vitest'
import { defaultSettings, emptyLog } from '../defaults'
import type { FatLossPlan, PlanVersion, UserProfile } from '../planner/types'
import type { DailyLog, MealDetails, MealLine } from '../types'
import { buildTodayDashboardModel, challengeDayNumber, inclusiveDateCount } from './todayDashboard'

const line = (key: string, kcal: number, templateId?: string): MealLine => ({
  key,
  label: key,
  amount: 1,
  unit: '份',
  kcalPerUnit: kcal,
  proteinPerUnit: 10,
  templateId
})

const details = (dinnerKcal = 0): MealDetails => ({
  breakfast: [line('breakfast', 540)],
  lunch: [line('lunch', 530)],
  dinner: dinnerKcal ? [line('dinner', dinnerKcal)] : [],
  evening: [],
  ramen: {
    enabled: false,
    packageKcal: 0,
    noodleRatio: 1,
    seasoningRatio: 1,
    oilRatio: 1,
    drankSoup: false,
    chickenG: 0,
    vegetablesG: 0
  }
})

const version: PlanVersion = {
  id: 'version-1',
  planId: 'plan-1',
  effectiveFrom: '2026-08-01',
  goalDate: '2026-09-30',
  calorieTargetKcal: 1_700,
  calorieRangeMinKcal: 1_650,
  calorieRangeMaxKcal: 1_750,
  energyPlan: {
    restingEnergyKcal: 1_800,
    activeEnergyKcal: 550,
    estimatedTdeeKcal: 2_350,
    source: 'wearable_logs',
    confidence: 'medium',
    sampleCount: 10
  },
  proteinMinG: 130,
  proteinMaxG: 155,
  waterTargetMl: 2_500,
  sleepTargetMinHours: 7,
  aerobicMinutesPerWeek: 120,
  strengthDaysPerWeek: 2,
  expectedWeeklyLossKg: 0.4,
  eveningReserveKcal: 160,
  reservedTemplateIds: ['soy_chia'],
  focusTasks: ['穩定記錄'],
  comment: { title: '保持節奏', summary: '維持目前設定。', bullets: [], tone: 'supportive' },
  createdAt: '2026-08-01T00:00:00.000Z',
  createdBy: 'manual'
}

const plan: FatLossPlan = {
  id: 'plan-1',
  name: '75KG Journey',
  status: 'active',
  startDate: '2026-08-01',
  goalWeightKg: 75,
  createdAt: '2026-08-01T00:00:00.000Z',
  source: 'manual',
  safetyDecisionSnapshot: { status: 'approved', reasonCodes: [], userMessages: [], limitations: [] }
}

const profile: UserProfile = {
  id: 'current',
  age: 41,
  calculationSex: 'male',
  heightCm: 180,
  currentWeightKg: 80,
  goalWeightKg: 75,
  workActivity: 'sedentary',
  exerciseSessionsPerWeek: 3,
  wearable: 'apple_watch',
  foodRestrictions: [],
  goalPace: 'standard',
  locale: 'zh-TW',
  timezone: 'Europe/Berlin',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z'
}

const completeLog = (date = '2026-08-08', patch: Partial<DailyLog> = {}): DailyLog => ({
  ...emptyLog(date),
  weightKg: 79.5,
  weightCondition: 'morning_fasted',
  sleepHours: 7.5,
  lowerLegTightness: 0,
  bowelMovement: 'yes',
  intakeKcal: 1_070,
  proteinG: 140,
  waterMl: 2_500,
  activeKcal: 430,
  restingKcal: 1_800,
  exerciseMinutes: 35,
  steps: 7_500,
  hungerLevel: 2,
  fatigueLevel: 2,
  highSaltMeal: false,
  mealDetails: details(),
  ...patch
})

const build = (log: DailyLog, logs: DailyLog[] = [log]) => buildTodayDashboardModel({
  today: log.date,
  log,
  logs,
  settings: defaultSettings,
  plan,
  planVersion: version,
  plannerProfile: profile
})

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    Object.values(value as Record<string, unknown>).forEach(deepFreeze)
  }
  return value
}

describe('inclusive challenge dates', () => {
  it('counts both endpoints without changing the seven target-line intervals', () => {
    expect(inclusiveDateCount('2026-08-01', '2026-08-08')).toBe(8)
    expect(challengeDayNumber('2026-08-01', '2026-08-08', '2026-08-01')).toBe(1)
    expect(challengeDayNumber('2026-08-01', '2026-08-08', '2026-08-08')).toBe(8)
  })

  it('clamps dates before and after the challenge', () => {
    expect(challengeDayNumber('2026-08-01', '2026-08-08', '2026-07-20')).toBe(1)
    expect(challengeDayNumber('2026-08-01', '2026-08-08', '2026-08-20')).toBe(8)
  })
})

describe('today dashboard model', () => {
  it('uses the neutral app brand when no long-term plan has a name', () => {
    const log = completeLog()
    const model = buildTodayDashboardModel({ today: log.date, log, logs: [log], settings: defaultSettings })
    expect(model.challenge.title).toBe('減脂追蹤')
  })

  it('uses Planner min/center/max and the maximum for remaining calories', () => {
    const model = build(completeLog())
    expect(model.calories).toMatchObject({
      consumedKcal: 1_070,
      minimumKcal: 1_650,
      centerKcal: 1_700,
      maximumKcal: 1_750,
      remainingToMaximumKcal: 680,
      overMaximumKcal: 0
    })
  })

  it('subtracts breakfast, lunch and the unlogged evening reserve from calorie max', () => {
    expect(build(completeLog()).dinner).toMatchObject({
      breakfastKcal: 540,
      lunchKcal: 530,
      eveningKcal: 0,
      reservedEveningKcal: 160,
      budgetKcal: 520,
      eatenKcal: 0
    })
  })

  it('reports dinner remaining and overage without negative numbers', () => {
    expect(build(completeLog('2026-08-08', { mealDetails: details(490) })).dinner).toMatchObject({
      budgetKcal: 520,
      eatenKcal: 490,
      remainingKcal: 30,
      overKcal: 0
    })
    expect(build(completeLog('2026-08-08', { mealDetails: details(560) })).dinner).toMatchObject({
      budgetKcal: 520,
      eatenKcal: 560,
      remainingKcal: 0,
      overKcal: 40
    })
  })

  it('does not subtract the Planner reserve twice after its template is logged', () => {
    const value = details()
    value.evening = [line('soy chia', 160, 'soy_chia')]
    expect(build(completeLog('2026-08-08', { mealDetails: value })).dinner).toMatchObject({
      eveningKcal: 160,
      reservedEveningKcal: 0,
      budgetKcal: 520
    })
  })

  it('shows activity remaining and the reached state from effective activity', () => {
    const settings = { ...defaultSettings, activeKcalMinimum: 550 }
    const low = buildTodayDashboardModel({ today: '2026-08-08', log: completeLog(), logs: [], settings, plan, planVersion: version, plannerProfile: profile })
    const reachedLog = completeLog('2026-08-08', { activeKcal: 580 })
    const reached = buildTodayDashboardModel({ today: '2026-08-08', log: reachedLog, logs: [], settings, plan, planVersion: version, plannerProfile: profile })
    expect(low.activity).toMatchObject({ effectiveKcal: 430, minimumKcal: 550, remainingToMinimumKcal: 120, basicGoalReached: false })
    expect(reached.activity).toMatchObject({ effectiveKcal: 580, remainingToMinimumKcal: 0, basicGoalReached: true })
  })

  it('only exposes moving averages after the required morning count', () => {
    const logs = Array.from({ length: 7 }, (_, index) => completeLog(`2026-08-0${index + 1}`, { weightKg: 80 - index * 0.1 }))
    expect(build(logs[1], logs.slice(0, 2)).weight).toMatchObject({ morningCount: 2, trend3Kg: undefined, trend7Kg: undefined })
    expect(build(logs[4], logs.slice(0, 5)).weight.trend3Kg).toBeCloseTo(79.7)
    expect(build(logs[4], logs.slice(0, 5)).weight.trend7Kg).toBeUndefined()
    expect(build(logs[6], logs).weight.trend7Kg).toBeCloseTo(79.7)
  })

  it('prioritizes missing food over water, while pain remains the top safety action', () => {
    const missingFood = completeLog('2026-08-08', { intakeKcal: undefined, proteinG: undefined, waterMl: 0 })
    expect(build(missingFood).primaryAction).toMatchObject({ title: '更新今天已吃的食物', stage: 'food' })
    const pain = completeLog('2026-08-08', { intakeKcal: undefined, lowerLegTightness: 3 })
    expect(build(pain).primaryAction).toMatchObject({ title: '今天優先恢復', stage: 'morning', tone: 'warn' })
  })

  it('uses the explicit refinalization action after data changes', () => {
    const model = build(completeLog('2026-08-08', { dayFinalized: false, needsRefinalization: true }))
    expect(model.finalization).toEqual({ finalized: false, needsRefinalization: true })
    expect(model.primaryAction.title).toBe('資料已更新，請重新結算')
  })

  it('does not mutate deep-frozen logs, settings, Plan or PlanVersion', () => {
    const log = completeLog()
    const input = {
      today: log.date,
      log,
      logs: [completeLog('2026-08-07', { weightKg: 79.7 }), log],
      settings: structuredClone(defaultSettings),
      plan: structuredClone(plan),
      planVersion: structuredClone(version),
      plannerProfile: structuredClone(profile)
    }
    const before = structuredClone(input)
    deepFreeze(input)
    expect(() => buildTodayDashboardModel(input)).not.toThrow()
    expect(input).toEqual(before)
  })
})
