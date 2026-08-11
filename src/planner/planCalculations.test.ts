import { describe, expect, it } from 'vitest'
import type { DailyLog } from '../types'
import { calculateSafetyBounds, createLocalPlanDraft, deriveDailyEnergyPlan, deriveTdeeEstimate, dinnerMainBudget, hasValidWearableEnergyInput, minimumSelfServeCalories, validateGoalDate } from './planCalculations'
import type { UserProfile } from './types'

const plannerProfile = (patch: Partial<UserProfile> = {}): UserProfile => ({
  id: 'current', age: 41, calculationSex: 'male', heightCm: 180, currentWeightKg: 80.2, goalWeightKg: 75,
  workActivity: 'sedentary', exerciseSessionsPerWeek: 3, exerciseMinutesPerWeek: 120, wearable: 'apple_watch',
  foodRestrictions: [], goalPace: 'standard', locale: 'zh-TW', timezone: 'Europe/Berlin',
  createdAt: '2026-08-07T00:00:00.000Z', updatedAt: '2026-08-07T00:00:00.000Z', ...patch
})

const wearableLog = (day: number, restingKcal = 1800, activeKcal = 400): DailyLog => ({
  id: `2026-08-${String(day).padStart(2, '0')}`, date: `2026-08-${String(day).padStart(2, '0')}`,
  restingKcal, activeKcal, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z'
})

describe('planner calculations', () => {
  it('prioritizes at least seven wearable days over formula estimates', () => {
    const estimate = deriveTdeeEstimate(plannerProfile(), Array.from({ length: 7 }, (_, index) => wearableLog(index + 1)))
    expect(estimate).toMatchObject({ value: 2200, confidence: 'medium', source: 'wearable_logs', sampleCount: 7 })
  })

  it('separates resting, active and total energy for the daily target table', () => {
    const energy = deriveDailyEnergyPlan(plannerProfile(), Array.from({ length: 14 }, (_, index) => wearableLog(index + 1, 1_750, 450)))
    expect(energy).toEqual({ restingEnergyKcal: 1_750, activeEnergyKcal: 450, estimatedTdeeKcal: 2_200, confidence: 'high', source: 'wearable_logs', sampleCount: 14 })
  })

  it('uses profile wearable averages before Mifflin', () => {
    const estimate = deriveTdeeEstimate(plannerProfile({ averageRestingEnergyKcal: 1750, averageActiveEnergyKcal: 450, wearableObservationDays: 14 }), [])
    expect(estimate).toMatchObject({ value: 2200, confidence: 'medium', source: 'profile_wearable_average' })
  })

  it('accepts either an empty wearable estimate or one complete bounded observation set', () => {
    expect(hasValidWearableEnergyInput(plannerProfile({ averageRestingEnergyKcal: undefined, averageActiveEnergyKcal: undefined, wearableObservationDays: undefined }))).toBe(true)
    expect(hasValidWearableEnergyInput(plannerProfile({ averageRestingEnergyKcal: 1750, averageActiveEnergyKcal: 450, wearableObservationDays: 14 }))).toBe(true)
    expect(hasValidWearableEnergyInput(plannerProfile({ averageRestingEnergyKcal: 1750, averageActiveEnergyKcal: undefined, wearableObservationDays: 14 }))).toBe(false)
    expect(hasValidWearableEnergyInput(plannerProfile({ averageRestingEnergyKcal: 499, averageActiveEnergyKcal: 450, wearableObservationDays: 14 }))).toBe(false)
    expect(hasValidWearableEnergyInput(plannerProfile({ averageRestingEnergyKcal: 1750, averageActiveEnergyKcal: 3001, wearableObservationDays: 14 }))).toBe(false)
    expect(hasValidWearableEnergyInput(plannerProfile({ averageRestingEnergyKcal: 1750, averageActiveEnergyKcal: 450, wearableObservationDays: 0 }))).toBe(false)
    expect(hasValidWearableEnergyInput(plannerProfile({ averageRestingEnergyKcal: 1750, averageActiveEnergyKcal: 450, wearableObservationDays: 1.5 }))).toBe(false)
  })

  it('falls back to a low-confidence Mifflin estimate', () => {
    const estimate = deriveTdeeEstimate(plannerProfile({ wearable: 'none', averageRestingEnergyKcal: 1750, averageActiveEnergyKcal: 450, wearableObservationDays: 14 }), [])
    expect(estimate.confidence).toBe('low')
    expect(estimate.source).toBe('mifflin')
    expect(estimate.value).toBeGreaterThan(minimumSelfServeCalories(plannerProfile()))
  })

  it('builds a standard 80.2 to 75 kg draft around a 12–14 week recommendation', () => {
    const bounds = calculateSafetyBounds(plannerProfile(), [], '2026-08-07')
    const draft = createLocalPlanDraft(bounds, 'standard')
    expect(draft.goalDate).toBe(bounds.recommendedGoalDate)
    expect(draft.goalDate >= '2026-10-30').toBe(true)
    expect(draft.goalDate <= '2026-11-20').toBe(true)
    expect(draft.calorieTargetKcal).toBeGreaterThanOrEqual(1500)
    expect(draft.expectedWeeklyLossKg).toBeLessThanOrEqual(0.9)
  })

  it('rejects an impossible seven-day goal date and supplies the earliest safe date', () => {
    const bounds = calculateSafetyBounds(plannerProfile({ currentWeightKg: 100, goalWeightKg: 70 }), [], '2026-08-07')
    const result = validateGoalDate('2026-08-14', bounds)
    expect(result.valid).toBe(false)
    expect(result.suggestedDate).toBe(bounds.earliestGoalDate)
    expect(result.suggestedDate > '2026-08-14').toBe(true)
  })

  it('does not subtract the evening reserve twice after it is logged', () => {
    expect(dinnerMainBudget(1800, 1200, 170, false)).toBe(430)
    expect(dinnerMainBudget(1800, 1200, 170, true)).toBe(600)
    expect(dinnerMainBudget(1800, 2000, 170, false)).toBe(0)
  })
})
