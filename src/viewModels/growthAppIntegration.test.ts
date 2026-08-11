import { describe, expect, it } from 'vitest'
import { emptyLog } from '../defaults'
import { createInitialCompanion } from '../growth/progression'
import type { GrowthMission, GrowthSnapshot, RewardLedgerEntry } from '../growth/types'
import type { PlannerSnapshot } from '../planner/types'
import { buildGrowthPageView, buildGrowthXpBreakdown, resolveGrowthAchievementArtworkUrl, resolveGrowthArtworkUrl, resolveGrowthHabitatArtworkUrl, runGrowthSync, selectGrowthSettlementDates } from './growthAppIntegration'

const planner = (weeklyReviews: PlannerSnapshot['weeklyReviews'] = []): PlannerSnapshot => ({
  plans: [], planVersions: [], weeklyReviews, consents: [], foodMetadata: []
})

const snapshot = (): GrowthSnapshot => ({
  companion: { ...createInitialCompanion('test-cycle'), xp: 300, growthNode: 4, mainForm: 'soft_cluster', affinities: { awareness: 3, nourishment: 2, activity: 1, recovery: 4 } },
  missions: [],
  rewardLedger: [],
  achievements: []
})

const dailyMission = (overrides: Partial<GrowthMission> = {}): GrowthMission => ({
  id: 'daily:2026-08-11:water',
  ruleVersion: 1,
  dateOrWeek: '2026-08-11',
  cadence: 'daily',
  periodStart: '2026-08-11',
  periodEnd: '2026-08-11',
  mode: 'planner',
  slot: 'behavior',
  category: 'nourishment',
  source: 'local_rule',
  metric: 'water_target',
  operator: 'at_least',
  targetMin: 2_000,
  progress: 1_000,
  status: 'in_progress',
  reward: 'fruit',
  createdAt: '2026-08-11T08:00:00.000Z',
  ...overrides
})

const rewardEntry = (
  taskId: string,
  cadence: RewardLedgerEntry['cadence'],
  periodKey: string,
  overrides: Partial<RewardLedgerEntry> = {}
): RewardLedgerEntry => ({
  id: `task:${taskId}`,
  taskId,
  cadence,
  periodKey,
  xpDelta: cadence === 'daily' ? 10 : 20,
  category: 'nourishment',
  affinityDelta: cadence === 'daily' ? 1 : 2,
  createdAt: '2026-08-11T20:00:00.000Z',
  ...overrides
})

describe('growth App adapter', () => {
  it('maps only today daily missions and preserves waiting-for-data semantics', () => {
    const current = snapshot()
    current.missions = [
      dailyMission({ evaluationReason: 'waiting_for_data' }),
      dailyMission({ id: 'yesterday', dateOrWeek: '2026-08-10' }),
      dailyMission({ id: 'weekly', cadence: 'weekly', dateOrWeek: '2026-08-11' }),
      dailyMission({ id: 'superseded', status: 'superseded' })
    ]

    const view = buildGrowthPageView(current, '2026-08-11')

    expect(view.missions).toHaveLength(1)
    expect(view.missions[0]).toMatchObject({ status: 'waiting_record', xpReward: 10, rewarded: false, target: 2_000 })
    expect(view.missions[0].description).not.toContain('越少越好')
  })

  it('builds imprint recommendations, locked achievements and the formal stage asset URL', () => {
    const view = buildGrowthPageView(snapshot(), '2026-08-11', 'recovery')

    expect(view.imprintChoice).toMatchObject({ milestone: 4, selected: 'recovery' })
    expect(view.imprintChoice?.recommendations.map((item) => item.affinity)).toEqual(['recovery', 'awareness'])
    expect(view.achievements).toHaveLength(12)
    expect(view.achievements.every((achievement) => achievement.status === 'locked')).toBe(true)
    expect(view.achievements.every((achievement) => achievement.artworkUrl?.includes('/art/growth/achievements/'))).toBe(true)
    expect(view.habitat.artworkLayers?.[0]).toMatchObject({ id: 'star-tide-habitat', slot: 'habitat' })
    expect(view.habitat.residents).toEqual([])
    expect(view.habitat.collection.every((entry) => entry.artworkUrl?.includes('/art/growth/achievements/'))).toBe(true)
    expect(resolveGrowthArtworkUrl(4, '/80kg-sprint/')).toBe('/80kg-sprint/art/growth/luminous-stage-04.webp')
    expect(resolveGrowthAchievementArtworkUrl('comeback', '/80kg-sprint')).toBe('/80kg-sprint/art/growth/achievements/comeback.webp')
    expect(resolveGrowthHabitatArtworkUrl('/80kg-sprint')).toBe('/80kg-sprint/art/growth/luminous-habitat-star-tide.webp')
  })

  it('moves a mature 潤光 into the habitat as a permanent resident', () => {
    const current = snapshot()
    current.companion = {
      ...current.companion,
      xp: 2_140,
      growthNode: 12,
      mainForm: 'star_tide',
      firstImprint: 'activity',
      secondImprint: 'recovery'
    }

    const view = buildGrowthPageView(current, '2026-08-11')

    expect(view.habitat.residents).toEqual([expect.objectContaining({
      id: 'test-cycle',
      name: '星潮・完全共鳴',
      description: '疾潮 × 月幕歷程的成熟潤光。',
      status: 'resident',
      artworkUrl: expect.stringContaining('luminous-stage-12.webp')
    })])
  })
})

describe('growth XP breakdown', () => {
  it('joins daily and weekly rewards to missions and classifies dates by periodKey', () => {
    const current = snapshot()
    const daily = dailyMission({ status: 'completed', progress: 2_000 })
    const weekly = dailyMission({
      id: 'weekly:2026-08-10:review',
      dateOrWeek: '2026-08-10',
      cadence: 'weekly',
      periodStart: '2026-08-10',
      periodEnd: '2026-08-16',
      slot: 'weekly',
      category: 'awareness',
      metric: 'weekly_review',
      targetMin: 1,
      progress: 1,
      status: 'completed'
    })
    current.missions = [daily, weekly]
    current.rewardLedger = [
      rewardEntry(daily.id, 'daily', daily.periodStart),
      rewardEntry(weekly.id, 'weekly', weekly.periodStart, { category: 'awareness' })
    ]
    current.companion.xp = 30

    const breakdown = buildGrowthXpBreakdown(current, '2026-08-11')

    expect(breakdown).toMatchObject({
      displayedXp: 30,
      attributedXp: 30,
      residualXp: 0,
      integrity: 'exact',
      daily: { count: 1, xp: 10 },
      weekly: { count: 1, xp: 20 },
      todayPeriodXp: 10
    })
    expect(breakdown.byCategory).toMatchObject({
      nourishment: { count: 1, xp: 10 },
      awareness: { count: 1, xp: 20 }
    })
    expect(breakdown.entries).toEqual([
      expect.objectContaining({
        taskId: daily.id,
        cadence: 'daily',
        periodKey: '2026-08-11',
        metric: 'water_target',
        missionStatus: 'completed',
        attribution: 'mission'
      }),
      expect.objectContaining({
        taskId: weekly.id,
        cadence: 'weekly',
        periodKey: '2026-08-10',
        metric: 'weekly_review',
        attribution: 'mission'
      })
    ])
    expect(buildGrowthPageView(current, '2026-08-11').missions[0]).toMatchObject({
      id: daily.id,
      xpReward: 10,
      rewarded: true
    })
  })

  it('fully explains a 260 XP fixture from 20 daily and 3 weekly rewards', () => {
    const current = snapshot()
    const dailyMissions = Array.from({ length: 20 }, (_, index) => {
      const period = `2026-08-${String((index % 10) + 1).padStart(2, '0')}`
      return dailyMission({
        id: `daily-${index}`,
        dateOrWeek: period,
        periodStart: period,
        periodEnd: period,
        slot: 'core',
        category: 'awareness',
        metric: 'daily_finalized',
        targetMin: 1,
        progress: 1,
        status: 'completed'
      })
    })
    const weeklyMissions = ['2026-07-27', '2026-08-03', '2026-08-10'].map((period, index) => dailyMission({
      id: `weekly-${index}`,
      dateOrWeek: period,
      cadence: 'weekly',
      periodStart: period,
      periodEnd: period,
      slot: 'weekly',
      category: 'recovery',
      metric: 'weekly_recovery',
      targetMin: 1,
      progress: 1,
      status: 'completed'
    }))
    current.missions = [...dailyMissions, ...weeklyMissions]
    current.rewardLedger = [
      ...dailyMissions.map((mission) => rewardEntry(mission.id, 'daily', mission.periodStart, { category: 'awareness' })),
      ...weeklyMissions.map((mission) => rewardEntry(mission.id, 'weekly', mission.periodStart, { category: 'recovery' }))
    ]
    current.companion.xp = 260

    const breakdown = buildGrowthXpBreakdown(current, '2026-08-11')

    expect(breakdown).toMatchObject({
      displayedXp: 260,
      attributedXp: 260,
      residualXp: 0,
      integrity: 'exact',
      daily: { count: 20, xp: 200 },
      weekly: { count: 3, xp: 60 }
    })
    expect(breakdown.byCategory.awareness).toEqual({ count: 20, xp: 200 })
    expect(breakdown.byCategory.recovery).toEqual({ count: 3, xp: 60 })
    expect(breakdown.entries).toHaveLength(23)
    expect(breakdown.entries.every((entry) => entry.attribution === 'mission')).toBe(true)
  })

  it('keeps orphan rewards visible and reports signed unattributed XP without inventing provenance', () => {
    const current = snapshot()
    current.companion.xp = 50
    current.rewardLedger = [rewardEntry('missing-mission', 'daily', '2026-08-01')]

    const breakdown = buildGrowthXpBreakdown(current, '2026-08-11')

    expect(breakdown).toMatchObject({
      displayedXp: 50,
      attributedXp: 10,
      residualXp: 40,
      integrity: 'residual',
      todayPeriodXp: 0
    })
    expect(breakdown.entries[0]).toMatchObject({
      taskId: 'missing-mission',
      title: '每日培育任務',
      periodKey: '2026-08-01',
      creditedAt: '2026-08-11T20:00:00.000Z',
      attribution: 'orphan'
    })
    expect(breakdown.entries[0]).not.toHaveProperty('metric')

    current.companion.xp = 0
    expect(buildGrowthXpBreakdown(current, '2026-08-11')).toMatchObject({
      residualXp: -10,
      integrity: 'over_attributed'
    })
  })
})

describe('runGrowthSync', () => {
  it('returns a successfully settled snapshot', async () => {
    const result = await runGrowthSync({ xp: 10 }, async () => ({ xp: 20 }))

    expect(result).toEqual({ snapshot: { xp: 20 } })
  })

  it('preserves the last readable snapshot and hides private failure details', async () => {
    const previous = { xp: 30 }
    const result = await runGrowthSync(previous, async () => {
      throw new Error('weight=81.4; private IndexedDB row')
    })

    expect(result.snapshot).toBe(previous)
    expect(result.error).toContain('健康紀錄仍可照常使用')
    expect(result.error).not.toContain('81.4')
  })
})

describe('growth backfill date selection', () => {
  it('does not materialize blank historical days when there is no log or weekly evidence', () => {
    expect(selectGrowthSettlementDates({
      today: '2026-08-14',
      logs: [],
      planner: planner(),
      snapshot: snapshot()
    })).toEqual(['2026-08-14'])
  })

  it('includes the 14-day boundary, excludes older/future and blank historical dates, and leaves today last', () => {
    const current = snapshot()
    const dates = selectGrowthSettlementDates({
      today: '2026-08-14',
      logs: [emptyLog('2026-07-31'), emptyLog('2026-08-01'), emptyLog('2026-08-10'), emptyLog('2026-08-15')],
      planner: planner(),
      snapshot: current
    })

    expect(dates).toEqual(['2026-08-01', '2026-08-10', '2026-08-14'])
    expect(dates).toHaveLength(3)
  })

  it('replays a recent expired day with evidence and a modified completed day, but skips other settled days', () => {
    const current = snapshot()
    current.missions = [
      dailyMission({ id: 'expired', dateOrWeek: '2026-08-05', periodStart: '2026-08-05', periodEnd: '2026-08-05', status: 'expired' }),
      dailyMission({ id: 'modified-completed', dateOrWeek: '2026-08-06', periodStart: '2026-08-06', periodEnd: '2026-08-06', status: 'completed' }),
      dailyMission({ id: 'settled', dateOrWeek: '2026-08-07', periodStart: '2026-08-07', periodEnd: '2026-08-07', status: 'completed' })
    ]

    const dates = selectGrowthSettlementDates({
      today: '2026-08-14',
      logs: [emptyLog('2026-08-05'), emptyLog('2026-08-06'), emptyLog('2026-08-07')],
      planner: planner(),
      snapshot: current,
      modifiedDate: '2026-08-06'
    })

    expect(dates).toEqual(['2026-08-05', '2026-08-06', '2026-08-14'])
  })

  it('uses weekly review evidence without generating every blank day in that week', () => {
    const dates = selectGrowthSettlementDates({
      today: '2026-08-14',
      logs: [],
      planner: planner([{
        id: 'review-1',
        planId: 'plan-1',
        weekStart: '2026-08-03',
        weekEnd: '2026-08-09',
        dataCompleteness: 1,
        summary: { morningWeightCount: 0, intakeDayCount: 0, finalizedDayCount: 0, highSaltMealCount: 0, bowelMovementDays: 0, cumulativeFinalizedDeficitKcal: 0 },
        currentVersionId: 'version-1',
        comment: { title: '', summary: '', bullets: [], tone: 'neutral' },
        warnings: [],
        status: 'applied',
        createdAt: '2026-08-09T20:00:00.000Z'
      }]),
      snapshot: snapshot()
    })

    expect(dates).toEqual(['2026-08-09', '2026-08-14'])
  })

  it('retries a completed date after reload when persisted core evidence is newer than its last Growth evaluation', () => {
    const current = snapshot()
    current.missions = [dailyMission({
      id: 'previously-completed',
      dateOrWeek: '2026-08-10',
      periodStart: '2026-08-10',
      periodEnd: '2026-08-10',
      status: 'completed',
      evaluatedAt: '2026-08-10T08:00:00.000Z'
    })]
    const changedLog = { ...emptyLog('2026-08-10'), updatedAt: '2026-08-10T09:00:00.000Z' }

    expect(selectGrowthSettlementDates({
      today: '2026-08-14',
      logs: [changedLog],
      planner: planner(),
      snapshot: current
    })).toEqual(['2026-08-10', '2026-08-14'])

    current.missions[0] = { ...current.missions[0], evaluatedAt: '2026-08-10T10:00:00.000Z' }
    expect(selectGrowthSettlementDates({
      today: '2026-08-14',
      logs: [changedLog],
      planner: planner(),
      snapshot: current
    })).toEqual(['2026-08-14'])
  })
})
