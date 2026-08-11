import { describe, expect, it } from 'vitest'
import { defaultSettings, emptyLog } from '../defaults'
import type { PlannerSnapshot } from '../planner/types'
import { evaluateAchievementUnlocks } from './achievements'
import { addGrowthDays } from './dates'
import { emptyGrowthSnapshot, settleGrowthSnapshot } from './engine'
import type { GrowthSnapshot } from './types'
import { validateGrowthSnapshot } from './validation'

const planner: PlannerSnapshot = {
  plans: [],
  planVersions: [],
  weeklyReviews: [],
  consents: [],
  foodMetadata: []
}

const validSettledSnapshot = (): GrowthSnapshot => {
  const log = {
    ...emptyLog('2026-08-04'),
    intakeKcal: 1_800,
    fatigueLevel: 2 as const,
    dayFinalized: true
  }
  return settleGrowthSnapshot(emptyGrowthSnapshot('backup-cycle', 'birth-mark-2'), {
    today: log.date,
    logs: [log],
    settings: { ...defaultSettings, guidanceMode: 'tracking_only' },
    planner,
    now: '2026-08-04T20:00:00.000Z'
  })
}

describe('GrowthSnapshot runtime validation', () => {
  it('accepts empty, settled and previously persisted type-valid snapshots', () => {
    const empty = emptyGrowthSnapshot()
    const settled = validSettledSnapshot()
    const previouslyPersisted: GrowthSnapshot = {
      ...empty,
      companion: {
        ...empty.companion,
        xp: 460,
        growthNode: 5,
        mainForm: 'soft_cluster',
        affinities: { awareness: 3, nourishment: 7, activity: 1, recovery: 2 }
      }
    }

    expect(validateGrowthSnapshot(empty)).toBe(true)
    expect(validateGrowthSnapshot(JSON.parse(JSON.stringify(settled)))).toBe(true)
    expect(validateGrowthSnapshot(previouslyPersisted)).toBe(true)
  })

  it('rejects missing keys, unknown keys and non-array collections', () => {
    const snapshot = validSettledSnapshot()
    const { rewardLedger: _omitted, ...missingLedger } = snapshot

    expect(validateGrowthSnapshot(missingLedger)).toBe(false)
    expect(validateGrowthSnapshot({ ...snapshot, executable: 'javascript:alert(1)' })).toBe(false)
    expect(validateGrowthSnapshot({ ...snapshot, missions: { ...snapshot.missions } })).toBe(false)
    expect(validateGrowthSnapshot({ ...snapshot, achievements: null })).toBe(false)
  })

  it('fails closed for invalid enums, unsafe numbers and malformed nested records', () => {
    const snapshot = validSettledSnapshot()
    const invalidAffinity = structuredClone(snapshot) as GrowthSnapshot
    ;(invalidAffinity.companion.affinities as Record<string, unknown>).recovery = Number.POSITIVE_INFINITY

    const missingAffinity = structuredClone(snapshot) as GrowthSnapshot
    delete (missingAffinity.companion.affinities as Partial<Record<string, number>>).awareness

    const invalidMission = structuredClone(snapshot) as GrowthSnapshot
    ;(invalidMission.missions[0] as unknown as Record<string, unknown>).metric = 'execute_code'

    const invalidReward = structuredClone(snapshot) as GrowthSnapshot
    ;(invalidReward.rewardLedger[0] as unknown as Record<string, unknown>).xpDelta = -10

    const invalidAchievement = structuredClone(snapshot) as GrowthSnapshot
    ;(invalidAchievement.achievements[0] as unknown as Record<string, unknown>).achievementId = '../../badge'

    expect(validateGrowthSnapshot({ ...snapshot, companion: { ...snapshot.companion, mainForm: 'unknown' } })).toBe(false)
    expect(validateGrowthSnapshot({ ...snapshot, companion: { ...snapshot.companion, growthNode: 13 } })).toBe(false)
    expect(validateGrowthSnapshot(invalidAffinity)).toBe(false)
    expect(validateGrowthSnapshot(missingAffinity)).toBe(false)
    expect(validateGrowthSnapshot(invalidMission)).toBe(false)
    expect(validateGrowthSnapshot(invalidReward)).toBe(false)
    expect(validateGrowthSnapshot(invalidAchievement)).toBe(false)
  })

  it('rejects duplicate record ids and explicitly undefined optional fields', () => {
    const snapshot = validSettledSnapshot()
    expect(validateGrowthSnapshot({ ...snapshot, missions: [...snapshot.missions, structuredClone(snapshot.missions[0])] })).toBe(false)
    expect(validateGrowthSnapshot({
      ...snapshot,
      companion: { ...snapshot.companion, recentAuraId: undefined }
    })).toBe(false)
  })

  it('returns false instead of throwing when a hostile property accessor is supplied', () => {
    const hostile: Record<string, unknown> = {
      missions: [],
      rewardLedger: [],
      achievements: []
    }
    Object.defineProperty(hostile, 'companion', {
      enumerable: true,
      get: () => { throw new Error('do not execute untrusted getters') }
    })

    expect(() => validateGrowthSnapshot(hostile)).not.toThrow()
    expect(validateGrowthSnapshot(hostile)).toBe(false)
  })

  it('keeps comeback evidence restorable after more than 100 completed days', () => {
    const dates = Array.from({ length: 105 }, (_, index) => addGrowthDays('2025-01-01', index + (index >= 100 ? 4 : 0)))
    const base = emptyGrowthSnapshot()
    const missions: GrowthSnapshot['missions'] = dates.map((date) => ({
      id: `${date}:daily_reflection`,
      ruleVersion: 1,
      dateOrWeek: date,
      cadence: 'daily',
      periodStart: date,
      periodEnd: date,
      mode: 'tracking',
      slot: 'behavior',
      category: 'awareness',
      source: 'local_rule',
      metric: 'daily_reflection',
      operator: 'complete',
      targetMin: 1,
      progress: 1,
      status: 'completed',
      reward: 'dew',
      createdAt: `${date}T20:00:00.000Z`
    }))
    const snapshot = { ...base, missions }
    const achievements = evaluateAchievementUnlocks(snapshot, {
      today: dates.at(-1)!,
      logs: [],
      settings: defaultSettings,
      planner,
      now: `${dates.at(-1)}T21:00:00.000Z`
    })
    const comeback = achievements.find((achievement) => achievement.id === 'comeback')

    expect(comeback?.evidenceIds).toEqual([dates[99], dates[100]])
    expect(validateGrowthSnapshot({ ...snapshot, achievements })).toBe(true)
  })
})
