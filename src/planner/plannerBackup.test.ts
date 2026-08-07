import { describe, expect, it } from 'vitest'
import { emptyPlannerSnapshot } from './planSelectors'
import { makePlannerBackup, normalizePlannerBackup, validatePlannerBackup } from './plannerBackup'

describe('planner backup', () => {
  it('is separate from the legacy backup and uses its own version 1 envelope', () => {
    const backup = makePlannerBackup(emptyPlannerSnapshot())
    expect(backup.schemaVersion).toBe(1)
    expect(backup).toHaveProperty('planner')
    expect(backup).not.toHaveProperty('logs')
    expect(backup).not.toHaveProperty('settings')
  })

  it('validates and normalizes a planner backup', () => {
    const backup = makePlannerBackup(emptyPlannerSnapshot())
    expect(validatePlannerBackup(backup)).toBe(true)
    expect(normalizePlannerBackup(backup)).toEqual(emptyPlannerSnapshot())
  })

  it('rejects malformed data without a complete planner envelope', () => {
    expect(validatePlannerBackup({ schemaVersion: 1, exportedAt: 'x', planner: { plans: [] } })).toBe(false)
    expect(validatePlannerBackup({ schemaVersion: 2, exportedAt: 'x', planner: emptyPlannerSnapshot() })).toBe(false)
  })

  it('rejects nested corruption and unexpected private stores', () => {
    const corruptVersion = makePlannerBackup(emptyPlannerSnapshot()) as unknown as Record<string, unknown>
    const planner = corruptVersion.planner as Record<string, unknown>
    planner.planVersions = [{ id: 'broken', calorieTargetKcal: '900' }]
    expect(validatePlannerBackup(corruptVersion)).toBe(false)
    const extraStore = makePlannerBackup(emptyPlannerSnapshot()) as unknown as Record<string, unknown>
    ;(extraStore.planner as Record<string, unknown>).aiRuns = [{ rawRequest: 'private' }]
    expect(validatePlannerBackup(extraStore)).toBe(false)
  })
})
