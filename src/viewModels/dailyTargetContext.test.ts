import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../defaults'
import type { PlanVersion } from '../planner/types'
import { buildDailyTargetContext, settingsWithDailyTargets } from './dailyTargetContext'

const version: PlanVersion = {
  id: 'version-1',
  planId: 'plan-1',
  effectiveFrom: '2026-08-01',
  goalDate: '2026-09-30',
  calorieTargetKcal: 1_700,
  calorieRangeMinKcal: 1_650,
  calorieRangeMaxKcal: 1_750,
  proteinMinG: 130,
  proteinMaxG: 155,
  waterTargetMl: 2_600,
  sleepTargetMinHours: 7.5,
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

describe('daily target context', () => {
  it('uses Planner nutrition targets without inventing energy guidance for a legacy version', () => {
    const result = buildDailyTargetContext('2026-08-10', defaultSettings, version)
    expect(result.calories).toEqual({ min: 1_650, center: 1_700, max: 1_750 })
    expect(result.protein).toEqual({ min: 130, max: 155 })
    expect(result.waterTargetMl).toBe(2_600)
    expect(result.sleepMinimumHours).toBe(7.5)
    expect(result.guidance.activity).toBe(false)
    expect(result.activity).toEqual({
      minimum: defaultSettings.activeKcalMinimum,
      target: defaultSettings.activeKcalTarget,
      maximum: defaultSettings.activeKcalMaximum
    })
  })

  it('uses the midpoint for an existing legacy target range', () => {
    const settings = { ...defaultSettings, guidanceMode: 'legacy_targets' as const, intakeKcalMinimum: 1_700, intakeKcalMaximum: 1_850 }
    expect(buildDailyTargetContext('2026-08-08', settings).calories).toEqual({
      min: 1_700,
      center: 1_775,
      max: 1_850
    })
  })

  it('keeps compatibility numbers hidden in tracking-only mode', () => {
    const result = buildDailyTargetContext('2026-08-08', {
      ...defaultSettings,
      activeKcalMinimum: 600,
      intakeKcalMinimum: 1_700,
      intakeKcalMaximum: 1_850
    })
    expect(result.mode).toBe('tracking_only')
    expect(Object.values(result.guidance).every((enabled) => !enabled)).toBe(true)
  })

  it('uses an explicit Planner energy plan without inventing an activity range', () => {
    const withEnergy: PlanVersion = {
      ...version,
      energyPlan: {
        restingEnergyKcal: 1_750,
        activeEnergyKcal: 480,
        estimatedTdeeKcal: 2_230,
        source: 'mifflin',
        confidence: 'low',
        sampleCount: 0
      }
    }
    const result = buildDailyTargetContext('2026-08-10', defaultSettings, withEnergy)
    expect(result.guidance.activity).toBe(true)
    expect(result.activity).toEqual({ minimum: 480, target: 480, maximum: 480 })
  })

  it('adapts legacy settings immutably for existing selectors', () => {
    const settings = Object.freeze({ ...defaultSettings })
    const targets = buildDailyTargetContext('2026-08-10', settings, version)
    const adapted = settingsWithDailyTargets(settings, targets)
    expect(adapted).not.toBe(settings)
    expect(adapted.intakeKcalMinimum).toBe(1_650)
    expect(adapted.intakeKcalMaximum).toBe(1_750)
    expect(settings.intakeKcalMaximum).toBe(defaultSettings.intakeKcalMaximum)
  })
})
