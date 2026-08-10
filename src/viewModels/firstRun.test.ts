import { describe, expect, it } from 'vitest'
import { emptyLog } from '../defaults'
import { emptyPlannerSnapshot } from '../planner/planSelectors'
import type { PlannerSnapshot } from '../planner/types'
import type { CustomFood, DailyLog } from '../types'
import { buildFirstRunState } from './firstRun'

const food: CustomFood = {
  id: 'food-1',
  name: '測試食物',
  basis: 'serving',
  kcal: 100,
  proteinG: 10,
  defaultAmount: 1
}

const input = (patch: Partial<{
  onboarded: boolean
  logs: DailyLog[]
  foods: CustomFood[]
  planner: PlannerSnapshot
  plannerLoadFailed: boolean
}> = {}) => ({
  settings: { onboarded: patch.onboarded ?? false },
  logs: patch.logs ?? [],
  foods: patch.foods ?? [],
  planner: patch.planner ?? emptyPlannerSnapshot(),
  plannerLoadFailed: patch.plannerLoadFailed ?? false
})

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

describe('buildFirstRunState', () => {
  it('shows welcome only for a genuinely empty device with incomplete onboarding', () => {
    expect(buildFirstRunState(input())).toEqual({
      isCompletelyEmpty: true,
      hasCoreHistory: false,
      hasDailyLogs: false,
      hasFoods: false,
      hasPlannerData: false,
      plannerDataUnavailable: false,
      shouldShowWelcome: true,
      shouldBypassLegacyOnboarding: false,
      counts: { dailyLogs: 0, mealLines: 0, foods: 0, plannerPlans: 0, plannerRecords: 0 }
    })
  })

  it('bypasses legacy onboarding when DailyLog history exists', () => {
    const state = buildFirstRunState(input({ logs: [emptyLog('2026-08-10')] }))
    expect(state).toMatchObject({
      isCompletelyEmpty: false,
      hasCoreHistory: true,
      hasDailyLogs: true,
      hasFoods: false,
      shouldShowWelcome: false,
      shouldBypassLegacyOnboarding: true
    })
  })

  it('distinguishes a foods-only device from DailyLog history', () => {
    const state = buildFirstRunState(input({ foods: [food] }))
    expect(state).toMatchObject({
      isCompletelyEmpty: false,
      hasCoreHistory: true,
      hasDailyLogs: false,
      hasFoods: true,
      shouldShowWelcome: false,
      shouldBypassLegacyOnboarding: true,
      counts: { dailyLogs: 0, foods: 1 }
    })
  })

  it.each([
    ['profile', { profile: {} }],
    ['safety', { safety: {} }],
    ['plan', { plans: [{}] }],
    ['plan version', { planVersions: [{}] }],
    ['weekly review', { weeklyReviews: [{}] }],
    ['consent', { consents: [{}] }],
    ['food metadata', { foodMetadata: [{}] }]
  ])('treats partial Planner %s data as existing data', (_name, plannerPatch) => {
    const planner = { ...emptyPlannerSnapshot(), ...plannerPatch } as PlannerSnapshot
    expect(buildFirstRunState(input({ planner }))).toMatchObject({
      isCompletelyEmpty: false,
      hasPlannerData: true,
      shouldShowWelcome: false,
      shouldBypassLegacyOnboarding: true
    })
  })

  it('counts only recorded MealLines and all Planner snapshot records', () => {
    const log = emptyLog('2026-08-10')
    log.mealDetails!.breakfast[0] = { ...log.mealDetails!.breakfast[0], amount: 100 }
    const planner = {
      ...emptyPlannerSnapshot(),
      profile: {} as PlannerSnapshot['profile'],
      safety: {} as PlannerSnapshot['safety'],
      plans: [{}] as PlannerSnapshot['plans'],
      planVersions: [{}] as PlannerSnapshot['planVersions'],
      weeklyReviews: [{}] as PlannerSnapshot['weeklyReviews'],
      consents: [{}] as PlannerSnapshot['consents'],
      foodMetadata: [{}] as PlannerSnapshot['foodMetadata']
    }
    expect(buildFirstRunState(input({ logs: [log], foods: [food], planner })).counts).toEqual({
      dailyLogs: 1,
      mealLines: 1,
      foods: 1,
      plannerPlans: 1,
      plannerRecords: 7
    })
  })

  it('does not show or bypass onboarding after the user has explicitly completed it', () => {
    expect(buildFirstRunState(input({ onboarded: true }))).toMatchObject({
      isCompletelyEmpty: true,
      shouldShowWelcome: false,
      shouldBypassLegacyOnboarding: false
    })
  })

  it('cannot classify the device as empty when Planner loading failed', () => {
    expect(buildFirstRunState(input({ plannerLoadFailed: true }))).toMatchObject({
      isCompletelyEmpty: false,
      hasCoreHistory: false,
      hasPlannerData: false,
      plannerDataUnavailable: true,
      shouldShowWelcome: false,
      shouldBypassLegacyOnboarding: true
    })
  })

  it('accepts deeply frozen inputs without mutating them', () => {
    const frozen = deepFreeze(input({ logs: [emptyLog('2026-08-10')], foods: [food] }))
    expect(() => buildFirstRunState(frozen)).not.toThrow()
    expect(Object.isFrozen(frozen.logs[0])).toBe(true)
    expect(Object.isFrozen(frozen.foods[0])).toBe(true)
  })
})
