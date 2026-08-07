import { describe, expect, it, vi } from 'vitest'
import { loadApplicationData } from '../appData'
import { defaultSettings } from '../defaults'
import { makeBackup } from '../export'
import type { DailyLog } from '../types'
import { createLocalPlanDraft } from './planCalculations'
import { PLANNER_DB_NAME, PLANNER_DB_VERSION, PLANNER_STORES } from './plannerDb'
import { buildInitialPlanBundle } from './plannerRepository'
import { evaluateSafety } from './safetyEngine'
import { plannerProfile } from './testFixtures'
import type { SafetyScreen } from './types'

const legacyLog: DailyLog = { id: '2026-08-01', date: '2026-08-01', weightKg: 81.1, weightCondition: 'morning_fasted', createdAt: 'a', updatedAt: 'b' }
const safeScreen: SafetyScreen = { id: 'current', under18: false, pregnantOrBreastfeeding: false, eatingDisorderHistory: false, diabetesOrGlucoseMedication: false, kidneyDisease: false, seriousCardiovascularDisease: false, weightLossMedication: false, currentInjuryOrPain: false, faintingChestPainOrSevereDizziness: false, purgingLaxativesDiureticsOrForcedExercise: false, answeredAt: '2026-08-07' }

describe('planner data isolation', () => {
  it('uses a separate version-1 planner database with no legacy stores', () => {
    expect(PLANNER_DB_NAME).toBe('80kg-sprint-planner')
    expect(PLANNER_DB_VERSION).toBe(1)
    expect(PLANNER_STORES).not.toContain('logs')
    expect(PLANNER_STORES).not.toContain('settings')
    expect(PLANNER_STORES).not.toContain('foods')
  })

  it('keeps the legacy backup schema at version 1', () => {
    expect(makeBackup(defaultSettings, [legacyLog], []).schemaVersion).toBe(1)
  })

  it('keeps legacy JSON byte-for-byte unchanged while building a plan', () => {
    const legacy = { settings: { ...defaultSettings }, logs: [legacyLog], foods: [] }
    const before = JSON.stringify(legacy)
    const profile = plannerProfile()
    const decision = evaluateSafety(profile, safeScreen, legacy.logs, '2026-08-07')
    buildInitialPlanBundle(profile, decision, createLocalPlanDraft(decision.bounds!, profile.goalPace), '2026-08-07')
    expect(JSON.stringify(legacy)).toBe(before)
  })

  it('does not block legacy loading when the planner database fails', async () => {
    const legacy = { settings: defaultSettings, logs: [legacyLog], foods: [] }
    const result = await loadApplicationData(vi.fn().mockResolvedValue(legacy), vi.fn().mockRejectedValue(new Error('planner unavailable')))
    expect(result.legacy).toBe(legacy)
    expect(result.planner.plans).toEqual([])
    expect(result.plannerError).toBe('planner unavailable')
  })

  it('performs no planner write when no plan exists', async () => {
    const plannerLoader = vi.fn().mockResolvedValue({ plans: [], planVersions: [], weeklyReviews: [], consents: [], foodMetadata: [] })
    await loadApplicationData(vi.fn().mockResolvedValue({ settings: defaultSettings, logs: [], foods: [] }), plannerLoader)
    expect(plannerLoader).toHaveBeenCalledOnce()
  })
})
