import { describe, expect, it } from 'vitest'
import { defaultSettings, migrateSettings } from './defaults'
import type { FoodTemplate } from './types'

const historicalTemplate: FoodTemplate = {
  id: 'saved-by-user',
  name: '我的早餐',
  description: '既有使用者自己的模板',
  meal: 'breakfast',
  quick: true,
  kcal: 500,
  proteinG: 30,
  carbsG: 50,
  fatG: 15,
  fiberG: 5,
  sodiumMg: 300
}

describe('fresh public defaults and legacy migration', () => {
  it('starts in tracking-only mode without personal foods or health prescriptions', () => {
    expect(defaultSettings.guidanceMode).toBe('tracking_only')
    expect(defaultSettings.foodTemplates).toEqual([])
    expect(defaultSettings).toMatchObject({
      baselineWeightKg: 0,
      targetWeightKg: 0,
      heightCm: 0,
      activeKcalTarget: 0,
      intakeKcalMinimum: 0,
      intakeKcalMaximum: 0,
      proteinMinimumG: 0,
      waterMinimumMl: 0,
      stepsMinimum: 0,
      exerciseMinutesMinimum: 0
    })
  })

  it('preserves an existing completed setup and its saved templates', () => {
    const migrated = migrateSettings({
      ...defaultSettings,
      onboarded: true,
      guidanceMode: undefined,
      activeKcalTarget: 640,
      intakeKcalMinimum: 1_700,
      foodTemplates: [historicalTemplate]
    })
    expect(migrated.guidanceMode).toBe('legacy_targets')
    expect(migrated.activeKcalTarget).toBe(640)
    expect(migrated.intakeKcalMinimum).toBe(1_700)
    expect(migrated.foodTemplates).toEqual([historicalTemplate])
    expect(migrated.foodTemplates?.[0]).not.toBe(historicalTemplate)
  })

  it('does not repopulate an intentionally empty template collection', () => {
    expect(migrateSettings({ ...defaultSettings, onboarded: true, foodTemplates: [] }).foodTemplates).toEqual([])
  })

  it('restores implicit presets only for a completed legacy setup with no stored template field', () => {
    const legacy = migrateSettings({ onboarded: true, intakeKcalMinimum: 1_700 })
    expect(legacy.guidanceMode).toBe('legacy_targets')
    expect(legacy.foodTemplates?.some((template) => template.id === 'fixed_breakfast')).toBe(true)
    expect(migrateSettings(undefined).foodTemplates).toEqual([])
  })
})
