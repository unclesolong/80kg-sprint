import { describe, expect, it } from 'vitest'
import { defaultSettings, emptyLog } from '../defaults'
import type { FatLossPlan, PlanVersion } from '../planner/types'
import { buildDailyMissions, buildWeeklyMissions, deriveGrowthSafetyState, evaluateMission } from './missions'

const plan: FatLossPlan = {
  id: 'plan-1',
  name: 'test',
  status: 'active',
  startDate: '2026-08-01',
  goalWeightKg: 75,
  createdAt: '2026-08-01T00:00:00.000Z',
  source: 'manual',
  safetyDecisionSnapshot: {
    status: 'approved', reasonCodes: [], userMessages: [], limitations: [],
    bounds: {
      dailyCalories: { min: 1_600, max: 2_000, recommended: 1_800 },
      weeklyLossKg: { min: 0.1, max: 0.8, recommended: 0.4 },
      weeklyLossPercent: { min: 0.1, max: 1, recommended: 0.5 },
      proteinG: { min: 100, max: 160, recommended: 130 },
      waterMl: { min: 1_500, max: 3_500, recommended: 2_200 },
      aerobicMinutesPerWeek: { min: 0, max: 300, recommended: 120 },
      strengthDaysPerWeek: { min: 0, max: 4, recommended: 2 },
      earliestGoalDate: '2026-10-01', recommendedGoalDate: '2026-11-01', latestSuggestedGoalDate: '2027-01-01'
    }
  }
}

const version: PlanVersion = {
  id: 'version-1', planId: plan.id, effectiveFrom: '2026-08-01', goalDate: '2026-11-01',
  calorieTargetKcal: 1_800, calorieRangeMinKcal: 1_600, calorieRangeMaxKcal: 2_000,
  proteinMinG: 110, proteinMaxG: 150, waterTargetMl: 2_200, sleepTargetMinHours: 7,
  aerobicMinutesPerWeek: 120, strengthDaysPerWeek: 2, expectedWeeklyLossKg: .4,
  eveningReserveKcal: 200, reservedTemplateIds: [], focusTasks: ['文字不可執行'],
  comment: { title: 'test', summary: 'test', bullets: [], tone: 'neutral' },
  createdAt: '2026-08-01T00:00:00.000Z', createdBy: 'manual'
}

describe('growth mission generation', () => {
  it('keeps tracking-only and legacy users free of nutrition or activity prescriptions', () => {
    for (const guidanceMode of ['tracking_only', 'legacy_targets'] as const) {
      const missions = buildDailyMissions({ date: '2026-08-04', guidanceMode, logs: [] })
      expect(missions).toHaveLength(2)
      expect(missions.map((mission) => mission.metric)).toEqual(['food_logged', 'daily_reflection'])
      expect(missions.every((mission) => mission.planVersionId == null)).toBe(true)
    }
  })

  it('snapshots a whitelisted structured PlanVersion focus without parsing focusTasks text', () => {
    const focused = { ...version, focusTaskSpecs: [{ templateId: 'balanced_intake' }] } as PlanVersion & { focusTaskSpecs: Array<{ templateId: 'balanced_intake' }> }
    const missions = buildDailyMissions({ date: '2026-08-04', guidanceMode: 'planner', logs: [], plan, planVersion: focused })
    expect(missions).toHaveLength(3)
    expect(missions[0]).toMatchObject({
      metric: 'balanced_intake', targetMin: 1_600, targetMax: 2_000, planVersionId: 'version-1'
    })
  })

  it('replaces activity with an equal recovery mission when pain blocks activity', () => {
    const log = { ...emptyLog('2026-08-04'), lowerLegTightness: 3 as const }
    const missions = buildDailyMissions({ date: log.date, guidanceMode: 'planner', logs: [log], plan, planVersion: version })
    const recovery = missions.find((mission) => mission.metric === 'recovery_checkin')
    expect(recovery).toMatchObject({ category: 'recovery', supersedesMissionId: expect.stringContaining('activity_summary') })
    expect(missions.some((mission) => mission.metric === 'activity_summary')).toBe(false)
  })

  it('pauses nourishment scoring after two consecutive high-hunger days', () => {
    const logs = [
      { ...emptyLog('2026-08-03'), hungerLevel: 4 as const, dayFinalized: true },
      { ...emptyLog('2026-08-04'), hungerLevel: 5 as const, dayFinalized: true }
    ]
    expect(deriveGrowthSafetyState('2026-08-04', logs, plan).nutritionUnsafe).toBe(true)
    const missions = buildDailyMissions({ date: '2026-08-04', guidanceMode: 'planner', logs, plan, planVersion: version })
    expect(missions).toHaveLength(2)
    expect(missions.some((mission) => mission.category === 'nourishment')).toBe(false)
  })
})

describe('growth mission evaluation', () => {
  const calorieMission = () => buildDailyMissions({
    date: '2026-08-04', guidanceMode: 'planner', logs: [], plan,
    planVersion: { ...version, focusTaskSpecs: [{ templateId: 'balanced_intake' }] } as PlanVersion
  })[0]

  it('waits for data and finalization, and never rewards eating below the safe range', () => {
    const mission = calorieMission()
    const missing = evaluateMission(mission, { today: '2026-08-04', logs: [], now: '2026-08-04T20:00:00Z' })
    expect(missing).toMatchObject({ status: 'available', evaluationReason: 'waiting_for_data' })

    const open = evaluateMission(mission, { today: '2026-08-04', logs: [{ ...emptyLog('2026-08-04'), intakeKcal: 1_800 }] })
    expect(open.status).toBe('in_progress')

    const tooLow = evaluateMission(mission, { today: '2026-08-04', logs: [{ ...emptyLog('2026-08-04'), intakeKcal: 1_000, dayFinalized: true }] })
    expect(tooLow).toMatchObject({ status: 'in_progress', evaluationReason: 'outside_target' })

    const safe = evaluateMission(mission, { today: '2026-08-04', logs: [{ ...emptyLog('2026-08-04'), intakeKcal: 1_800, dayFinalized: true }] })
    expect(safe.status).toBe('completed')
  })

  it('uses structured workout minutes without double-counting the daily exercise summary', () => {
    const weekly = buildWeeklyMissions({
      date: '2026-08-05', weekStart: '2026-08-03', weekEnd: '2026-08-09', guidanceMode: 'planner', logs: [], plan,
      planVersion: { ...version, strengthDaysPerWeek: 0, aerobicMinutesPerWeek: 120 }
    }).find((mission) => mission.metric === 'weekly_aerobic')!
    const log = {
      ...emptyLog('2026-08-04'), exerciseMinutes: 100,
      workouts: [{ id: 'walk', type: 'walk' as const, title: 'walk', durationMinutes: 30, source: 'manual' as const }]
    }
    const evaluated = evaluateMission(weekly, { today: '2026-08-05', logs: [log] })
    expect(evaluated.progress).toBe(30)
    expect(evaluated.status).toBe('in_progress')
  })

  it('does not complete a water mission above the snapshotted Safety Bounds maximum', () => {
    const waterVersion = { ...version, focusTaskSpecs: [{ templateId: 'water_target' }] } as PlanVersion
    const mission = buildDailyMissions({ date: '2026-08-04', guidanceMode: 'planner', logs: [], plan, planVersion: waterVersion })[0]
    expect(mission).toMatchObject({ metric: 'water_target', targetMin: 2_200, targetMax: 3_500 })
    const evaluated = evaluateMission(mission, {
      today: '2026-08-04',
      logs: [{ ...emptyLog('2026-08-04'), waterMl: 4_000, dayFinalized: true }]
    })
    expect(evaluated).toMatchObject({ status: 'in_progress', evaluationReason: 'outside_target' })
  })
})
