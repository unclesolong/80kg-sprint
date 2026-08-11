import { describe, expect, it } from 'vitest'
import { defaultSettings, emptyLog } from '../defaults'
import type { FatLossPlan, PlannerSnapshot, PlanVersion } from '../planner/types'
import { emptyGrowthSnapshot, settleGrowthSnapshot } from './engine'
import { selectCompanionProgress } from './progression'

const settings = { ...defaultSettings, guidanceMode: 'tracking_only' as const }
const emptyPlanner: PlannerSnapshot = { plans: [], planVersions: [], weeklyReviews: [], consents: [], foodMetadata: [] }

const input = (today: string, logs: ReturnType<typeof emptyLog>[]) => ({
  today, logs, settings, planner: emptyPlanner, now: `${today}T20:00:00.000Z`
})

describe('growth settlement', () => {
  it('settles task rewards idempotently and caps same-category daily affinity', () => {
    const log = { ...emptyLog('2026-08-04'), intakeKcal: 1_800, fatigueLevel: 2 as const, dayFinalized: true }
    const first = settleGrowthSnapshot(emptyGrowthSnapshot(), input(log.date, [log]))
    const second = settleGrowthSnapshot(first, input(log.date, [log]))
    expect(first.companion.xp).toBe(20)
    expect(first.companion.affinities.awareness).toBe(1)
    expect(first.rewardLedger).toHaveLength(2)
    expect(first.achievements.map((achievement) => achievement.id)).toContain('first_complete_day')
    expect(second).toEqual(first)
  })

  it('reassigns the daily affinity point when the originally credited same-category task is corrected', () => {
    const date = '2026-08-04'
    const finalized = { ...emptyLog(date), intakeKcal: 1_800, dayFinalized: true }
    const first = settleGrowthSnapshot(emptyGrowthSnapshot(), input(date, [finalized]))
    const credited = first.rewardLedger.find((entry) => entry.affinityDelta === 1)!
    const other = first.rewardLedger.find((entry) => entry.id !== credited.id)!
    expect(first.companion.affinities.awareness).toBe(1)

    const foodOnly = { ...finalized, dayFinalized: false }
    const corrected = settleGrowthSnapshot(first, input(date, [foodOnly]))
    expect(corrected.rewardLedger.some((entry) => entry.id === credited.id)).toBe(false)
    expect(corrected.rewardLedger.find((entry) => entry.id === other.id)?.affinityDelta).toBe(1)
    expect(corrected.companion.affinities.awareness).toBe(1)
    expect(corrected.companion.xp).toBe(first.companion.xp - 10)
  })

  it('awards weekly tasks at 20 XP while keeping daily tasks at 10 XP', () => {
    const logs = Array.from({ length: 4 }, (_, index) => ({
      ...emptyLog(`2026-08-0${index + 3}`), intakeKcal: 1_800, dayFinalized: true
    }))
    const settled = settleGrowthSnapshot(emptyGrowthSnapshot(), input('2026-08-06', logs))
    const daily = settled.rewardLedger.filter((entry) => entry.cadence === 'daily')
    const weekly = settled.rewardLedger.filter((entry) => entry.cadence === 'weekly')
    expect(daily.every((entry) => entry.xpDelta === 10)).toBe(true)
    expect(weekly).toHaveLength(1)
    expect(weekly[0].xpDelta).toBe(20)
  })

  it('does not deduct XP, affinity or unlocks when later days are missed', () => {
    const log = { ...emptyLog('2026-08-04'), intakeKcal: 1_800, dayFinalized: true }
    const first = settleGrowthSnapshot(emptyGrowthSnapshot(), input(log.date, [log]))
    const later = settleGrowthSnapshot(first, input('2026-08-10', [log]))
    const earnedIds = first.rewardLedger.map((entry) => entry.id)
    expect(later.companion.xp).toBeGreaterThanOrEqual(first.companion.xp)
    expect(later.companion.affinities.awareness).toBeGreaterThanOrEqual(first.companion.affinities.awareness)
    expect(later.rewardLedger.filter((entry) => earnedIds.includes(entry.id))).toHaveLength(earnedIds.length)
    expect(later.missions.filter((mission) => mission.periodStart === '2026-08-04').every((mission) => ['completed', 'expired'].includes(mission.status))).toBe(true)
  })

  it('unlocks the whitelisted comeback achievement after three full missed days', () => {
    const firstLog = { ...emptyLog('2026-08-01'), intakeKcal: 1_800, dayFinalized: true }
    const first = settleGrowthSnapshot(emptyGrowthSnapshot(), input('2026-08-01', [firstLog]))
    const returnLog = { ...emptyLog('2026-08-05'), intakeKcal: 1_700, dayFinalized: true }
    const returned = settleGrowthSnapshot(first, input('2026-08-05', [firstLog, returnLog]))
    expect(returned.achievements.map((achievement) => achievement.id)).toContain('comeback')
  })
})

describe('immutable PlanVersion mission snapshots', () => {
  const plan: FatLossPlan = {
    id: 'plan', name: 'plan', status: 'active', startDate: '2026-08-01', goalWeightKg: 75,
    createdAt: '2026-08-01', source: 'manual',
    safetyDecisionSnapshot: { status: 'approved', reasonCodes: [], userMessages: [], limitations: [] }
  }
  const makeVersion = (id: string, effectiveFrom: string, min: number, max: number): PlanVersion => ({
    id, planId: plan.id, effectiveFrom, goalDate: '2026-12-01', calorieTargetKcal: (min + max) / 2,
    calorieRangeMinKcal: min, calorieRangeMaxKcal: max, proteinMinG: 100, proteinMaxG: 150,
    waterTargetMl: 2_000, sleepTargetMinHours: 7, aerobicMinutesPerWeek: 120, strengthDaysPerWeek: 2,
    expectedWeeklyLossKg: .4, eveningReserveKcal: 200, reservedTemplateIds: [], focusTasks: [],
    comment: { title: '', summary: '', bullets: [], tone: 'neutral' }, createdAt: effectiveFrom, createdBy: 'manual'
  })

  it('creates new ids and thresholds without mutating the historical task', () => {
    const v1 = { ...makeVersion('v1', '2026-08-01', 1_600, 2_000), focusTaskSpecs: [{ templateId: 'balanced_intake' }] } as PlanVersion
    const v2 = { ...makeVersion('v2', '2026-08-05', 1_700, 2_100), focusTaskSpecs: [{ templateId: 'balanced_intake' }] } as PlanVersion
    const planner = { ...emptyPlanner, plans: [plan], planVersions: [v1, v2] }
    const first = settleGrowthSnapshot(emptyGrowthSnapshot(), {
      today: '2026-08-04', logs: [], settings: { ...settings, guidanceMode: 'planner' }, planner, now: '2026-08-04T10:00:00Z'
    })
    const second = settleGrowthSnapshot(first, {
      today: '2026-08-05', logs: [], settings: { ...settings, guidanceMode: 'planner' }, planner, now: '2026-08-05T10:00:00Z'
    })
    const oldMission = second.missions.find((mission) => mission.planVersionId === 'v1' && mission.metric === 'balanced_intake')!
    const newMission = second.missions.find((mission) => mission.planVersionId === 'v2' && mission.metric === 'balanced_intake')!
    expect(oldMission).toMatchObject({ targetMin: 1_600, targetMax: 2_000 })
    expect(newMission).toMatchObject({ targetMin: 1_700, targetMax: 2_100 })
    expect(newMission.id).not.toBe(oldMission.id)
  })

  it('re-evaluates a completed same-day task and reverses its reward after a correction below the safe range', () => {
    const focused = { ...makeVersion('v1', '2026-08-01', 1_600, 2_000), focusTaskSpecs: [{ templateId: 'balanced_intake' }] } as PlanVersion
    const planner = { ...emptyPlanner, plans: [plan], planVersions: [focused] }
    const safe = { ...emptyLog('2026-08-04'), intakeKcal: 1_800, dayFinalized: true }
    const first = settleGrowthSnapshot(emptyGrowthSnapshot(), {
      today: safe.date, logs: [safe], settings: { ...settings, guidanceMode: 'planner' }, planner, now: '2026-08-04T18:00:00Z'
    })
    const original = first.missions.find((mission) => mission.metric === 'balanced_intake')!
    expect(original.status).toBe('completed')
    expect(first.rewardLedger.some((entry) => entry.taskId === original.id)).toBe(true)

    const tooLow = { ...safe, intakeKcal: 1_000 }
    const correctionInput = {
      today: tooLow.date, logs: [tooLow], settings: { ...settings, guidanceMode: 'planner' as const }, planner, now: '2026-08-04T20:00:00Z'
    }
    const corrected = settleGrowthSnapshot(first, correctionInput)
    expect(corrected.missions.find((mission) => mission.id === original.id)).toMatchObject({
      status: 'in_progress', progress: 1_000, targetMin: 1_600, targetMax: 2_000, evaluationReason: 'outside_target'
    })
    expect(corrected.rewardLedger.some((entry) => entry.taskId === original.id)).toBe(false)
    expect(corrected.companion.xp).toBe(first.companion.xp - 10)
    expect(corrected.companion.affinities.nourishment).toBe(first.companion.affinities.nourishment - 1)
    expect(settleGrowthSnapshot(corrected, correctionInput)).toEqual(corrected)

    const earnedAgain = settleGrowthSnapshot(corrected, {
      ...correctionInput, logs: [safe], now: '2026-08-04T21:00:00Z'
    })
    expect(earnedAgain.companion.xp).toBe(first.companion.xp)
    expect(earnedAgain.rewardLedger.filter((entry) => entry.taskId === original.id)).toHaveLength(1)
  })

  it('recomputes level, form and star-tide rings when a corrected reward crosses a threshold', () => {
    const focused = { ...makeVersion('v1', '2026-08-01', 1_600, 2_000), focusTaskSpecs: [{ templateId: 'balanced_intake' }] } as PlanVersion
    const planner = { ...emptyPlanner, plans: [plan], planVersions: [focused] }
    const safe = { ...emptyLog('2026-08-04'), intakeKcal: 1_800, dayFinalized: true }
    const first = settleGrowthSnapshot(emptyGrowthSnapshot(), {
      today: safe.date, logs: [safe], settings: { ...settings, guidanceMode: 'planner' }, planner, now: '2026-08-04T18:00:00Z'
    })
    const tooLow = { ...safe, intakeKcal: 1_000 }
    const correction = {
      today: tooLow.date, logs: [tooLow], settings: { ...settings, guidanceMode: 'planner' as const }, planner, now: '2026-08-04T20:00:00Z'
    }

    const belowLevelFour = settleGrowthSnapshot({
      ...first,
      companion: { ...first.companion, xp: 300, growthNode: 4, mainForm: 'soft_cluster' }
    }, correction)
    expect(belowLevelFour.companion).toMatchObject({ xp: 290, growthNode: 3, mainForm: 'light_drop' })

    const belowFirstRing = settleGrowthSnapshot({
      ...first,
      companion: { ...first.companion, xp: 2_440, growthNode: 12, mainForm: 'star_tide', maturedAt: '2026-08-01T00:00:00Z' }
    }, correction)
    expect(selectCompanionProgress(belowFirstRing.companion)).toMatchObject({ xp: 2_430, starTideRings: 0 })
  })

  it('supersedes and unrewards completed same-day planner tasks when the current mode becomes tracking-only', () => {
    const focused = { ...makeVersion('v1', '2026-08-01', 1_600, 2_000), focusTaskSpecs: [{ templateId: 'balanced_intake' }] } as PlanVersion
    const planner = { ...emptyPlanner, plans: [plan], planVersions: [focused] }
    const log = { ...emptyLog('2026-08-04'), intakeKcal: 1_800, exerciseMinutes: 30, dayFinalized: true }
    const first = settleGrowthSnapshot(emptyGrowthSnapshot(), {
      today: log.date, logs: [log], settings: { ...settings, guidanceMode: 'planner' }, planner, now: '2026-08-04T18:00:00Z'
    })
    const oldDaily = first.missions.filter((mission) => mission.cadence === 'daily' && mission.mode === 'planner')
    expect(oldDaily.every((mission) => mission.status === 'completed')).toBe(true)

    const switched = settleGrowthSnapshot(first, {
      today: log.date, logs: [log], settings, planner: emptyPlanner, now: '2026-08-04T20:00:00Z'
    })
    expect(switched.missions.filter((mission) => oldDaily.some((old) => old.id === mission.id)).every((mission) => mission.status === 'superseded')).toBe(true)
    expect(switched.rewardLedger.some((entry) => oldDaily.some((mission) => mission.id === entry.taskId))).toBe(false)
    expect(switched.missions.filter((mission) => mission.cadence === 'daily' && mission.status !== 'superseded').map((mission) => mission.metric).sort())
      .toEqual(['daily_reflection', 'food_logged'])
    expect(switched.rewardLedger.filter((entry) => entry.cadence === 'daily')).toHaveLength(2)
    expect(switched.companion.xp).toBe(20)
  })

  it('supersedes the old same-day PlanVersion task set when a new version becomes effective', () => {
    const v1 = { ...makeVersion('v1', '2026-08-01', 1_600, 2_000), focusTaskSpecs: [{ templateId: 'balanced_intake' }] } as PlanVersion
    const v2 = { ...makeVersion('v2', '2026-08-04', 1_700, 2_100), focusTaskSpecs: [{ templateId: 'balanced_intake' }] } as PlanVersion
    const first = settleGrowthSnapshot(emptyGrowthSnapshot(), {
      today: '2026-08-04', logs: [], settings: { ...settings, guidanceMode: 'planner' },
      planner: { ...emptyPlanner, plans: [plan], planVersions: [v1] }, now: '2026-08-04T10:00:00Z'
    })
    const changed = settleGrowthSnapshot(first, {
      today: '2026-08-04', logs: [], settings: { ...settings, guidanceMode: 'planner' },
      planner: { ...emptyPlanner, plans: [plan], planVersions: [v1, v2] }, now: '2026-08-04T11:00:00Z'
    })
    expect(changed.missions.filter((mission) => mission.cadence === 'daily' && mission.planVersionId === 'v1').every((mission) => mission.status === 'superseded')).toBe(true)
    expect(changed.missions.filter((mission) => mission.cadence === 'daily' && mission.planVersionId === 'v2').every((mission) => mission.status !== 'superseded')).toBe(true)
  })

  it('supersedes and unrewards a nourishment task when high hunger activates the safety override', () => {
    const focused = { ...makeVersion('v1', '2026-08-01', 1_600, 2_000), focusTaskSpecs: [{ templateId: 'balanced_intake' }] } as PlanVersion
    const planner = { ...emptyPlanner, plans: [plan], planVersions: [focused] }
    const prior = { ...emptyLog('2026-08-03'), hungerLevel: 4 as const, dayFinalized: true }
    const normal = { ...emptyLog('2026-08-04'), intakeKcal: 1_800, hungerLevel: 2 as const, dayFinalized: true }
    const first = settleGrowthSnapshot(emptyGrowthSnapshot(), {
      today: normal.date, logs: [prior, normal], settings: { ...settings, guidanceMode: 'planner' }, planner, now: '2026-08-04T18:00:00Z'
    })
    const nourishment = first.missions.find((mission) => mission.metric === 'balanced_intake')!
    expect(nourishment.status).toBe('completed')

    const unsafe = { ...normal, hungerLevel: 5 as const }
    const corrected = settleGrowthSnapshot(first, {
      today: unsafe.date, logs: [prior, unsafe], settings: { ...settings, guidanceMode: 'planner' }, planner, now: '2026-08-04T20:00:00Z'
    })
    expect(corrected.missions.find((mission) => mission.id === nourishment.id)?.status).toBe('superseded')
    expect(corrected.rewardLedger.some((entry) => entry.taskId === nourishment.id)).toBe(false)
    expect(corrected.companion.xp).toBe(first.companion.xp - 10)
  })

  it('never grants a fourth daily reward when recovery appears after activity was already completed', () => {
    const focused = { ...makeVersion('v1', '2026-08-01', 1_600, 2_000), focusTaskSpecs: [{ templateId: 'balanced_intake' }] } as PlanVersion
    const planner = { ...emptyPlanner, plans: [plan], planVersions: [focused] }
    const normal = {
      ...emptyLog('2026-08-04'), intakeKcal: 1_800, exerciseMinutes: 30, dayFinalized: true
    }
    const first = settleGrowthSnapshot(emptyGrowthSnapshot(), {
      today: normal.date, logs: [normal], settings: { ...settings, guidanceMode: 'planner' }, planner, now: '2026-08-04T18:00:00Z'
    })
    const painCorrection = { ...normal, lowerLegTightness: 3 as const, fatigueLevel: 4 as const }
    const corrected = settleGrowthSnapshot(first, {
      today: normal.date, logs: [painCorrection], settings: { ...settings, guidanceMode: 'planner' }, planner, now: '2026-08-04T20:00:00Z'
    })
    expect(first.rewardLedger.filter((entry) => entry.cadence === 'daily')).toHaveLength(3)
    expect(corrected.rewardLedger.filter((entry) => entry.cadence === 'daily')).toHaveLength(3)
    expect(corrected.companion.xp).toBe(first.companion.xp)
    expect(corrected.missions.find((mission) => mission.metric === 'activity_summary')?.status).toBe('superseded')
    expect(corrected.missions.find((mission) => mission.metric === 'recovery_checkin')?.status).toBe('completed')
    expect(corrected.rewardLedger.some((entry) => entry.taskId.includes('activity_summary'))).toBe(false)
    expect(corrected.rewardLedger.some((entry) => entry.taskId.includes('recovery_checkin'))).toBe(true)
  })
})
