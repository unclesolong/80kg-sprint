import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, emptyLog } from '../defaults'
import type { PlannerSnapshot } from '../planner/types'

const { openDBMock } = vi.hoisted(() => ({ openDBMock: vi.fn() }))
vi.mock('idb', () => ({ openDB: openDBMock }))

type Stored = { id?: string; cycleId?: string }

const fakeGrowthDatabase = () => {
  const maps = new Map<string, Map<string, Stored>>([
    ['missions', new Map()], ['rewards', new Map()], ['cycles', new Map()], ['achievements', new Map()]
  ])
  const store = (name: string) => ({
    get: async (key: string) => maps.get(name)!.get(key),
    getAll: async () => [...maps.get(name)!.values()],
    put: async (value: Stored) => {
      const key = String(name === 'cycles' ? value.cycleId : value.id)
      maps.get(name)!.set(key, structuredClone(value))
      return key
    },
    delete: async (key: string) => { maps.get(name)!.delete(key) },
    clear: async () => { maps.get(name)!.clear() }
  })
  const transaction = vi.fn(() => ({ objectStore: store, done: Promise.resolve() }))
  const db = {
    transaction,
    get: async (name: string, key: string) => store(name).get(key),
    getAll: async (name: string) => store(name).getAll()
  }
  return { db, maps, transaction }
}

beforeEach(() => {
  vi.resetModules()
  openDBMock.mockReset()
})

describe('growth IndexedDB repository', () => {
  it('atomically replays settlement without duplicating task ledger entries', async () => {
    const fake = fakeGrowthDatabase()
    openDBMock.mockResolvedValue(fake.db)
    const repository = await import('./repository')
    const planner: PlannerSnapshot = { plans: [], planVersions: [], weeklyReviews: [], consents: [], foodMetadata: [] }
    const log = { ...emptyLog('2026-08-04'), intakeKcal: 1_800, fatigueLevel: 2 as const, dayFinalized: true }
    const input = {
      today: log.date,
      logs: [log],
      settings: { ...defaultSettings, guidanceMode: 'tracking_only' as const },
      planner,
      now: '2026-08-04T20:00:00.000Z'
    }

    const first = await repository.settleGrowth(input)
    const replay = await repository.settleGrowth(input)

    expect(first.companion.xp).toBe(20)
    expect(replay.companion.xp).toBe(20)
    expect(replay.rewardLedger).toHaveLength(2)
    expect(fake.maps.get('rewards')?.size).toBe(2)
    expect(fake.transaction).toHaveBeenCalledWith(repository.GROWTH_STORES, 'readwrite')
    expect(openDBMock).toHaveBeenCalledTimes(1)
  })

  it('atomically deletes revoked reward rows so a same-day correction survives reload', async () => {
    const fake = fakeGrowthDatabase()
    openDBMock.mockResolvedValue(fake.db)
    const repository = await import('./repository')
    const planner: PlannerSnapshot = { plans: [], planVersions: [], weeklyReviews: [], consents: [], foodMetadata: [] }
    const date = '2026-08-04'
    const completed = { ...emptyLog(date), intakeKcal: 1_800, dayFinalized: true }
    const shared = {
      today: date,
      settings: { ...defaultSettings, guidanceMode: 'tracking_only' as const },
      planner,
      now: '2026-08-04T20:00:00.000Z'
    }
    const first = await repository.settleGrowth({ ...shared, logs: [completed] })
    expect(first.rewardLedger).toHaveLength(2)
    expect(fake.maps.get('rewards')?.size).toBe(2)

    const corrected = await repository.settleGrowth({ ...shared, logs: [emptyLog(date)] })
    const restored = await repository.loadGrowthSnapshot()
    expect(corrected.companion.xp).toBe(0)
    expect(corrected.rewardLedger).toHaveLength(0)
    expect(fake.maps.get('rewards')?.size).toBe(0)
    expect(restored.companion.xp).toBe(0)
    expect(restored.rewardLedger).toHaveLength(0)
  })

  it('backfills expired evidence dates in one transaction without duplicating or revoking historical rewards', async () => {
    const fake = fakeGrowthDatabase()
    openDBMock.mockResolvedValue(fake.db)
    const repository = await import('./repository')
    const planner: PlannerSnapshot = { plans: [], planVersions: [], weeklyReviews: [], consents: [], foodMetadata: [] }
    const oldDate = '2026-08-04'
    const today = '2026-08-05'
    const oldLog = { ...emptyLog(oldDate), intakeKcal: 1_800, dayFinalized: true }
    const settings = { ...defaultSettings, guidanceMode: 'tracking_only' as const }

    await repository.settleGrowth({ today: oldDate, logs: [], settings, planner, now: '2026-08-04T20:00:00.000Z' })
    const missed = await repository.settleGrowth({ today, logs: [oldLog], settings, planner, now: '2026-08-05T08:00:00.000Z' })
    expect(missed.rewardLedger.filter((entry) => entry.periodKey === oldDate)).toHaveLength(0)

    const beforeTransactions = fake.transaction.mock.calls.length
    const backfilled = await repository.settleGrowthDates(
      { today, logs: [oldLog], settings, planner, now: '2026-08-05T09:00:00.000Z' },
      [today, oldDate, oldDate]
    )
    expect(fake.transaction.mock.calls.length).toBe(beforeTransactions + 1)
    expect(backfilled.rewardLedger.filter((entry) => entry.periodKey === oldDate)).toHaveLength(2)
    expect(backfilled.missions.some((mission) =>
      mission.cadence === 'daily' && mission.periodStart === today && mission.status === 'available')).toBe(true)

    const replay = await repository.settleGrowthDates(
      { today, logs: [oldLog], settings, planner, now: '2026-08-05T09:00:00.000Z' },
      [oldDate, today]
    )
    expect(replay.rewardLedger.filter((entry) => entry.periodKey === oldDate)).toHaveLength(2)
    expect(replay.companion.xp).toBe(backfilled.companion.xp)

    const historicalCorrection = await repository.settleGrowthDates(
      { today, logs: [emptyLog(oldDate)], settings, planner, now: '2026-08-05T10:00:00.000Z' },
      [oldDate, today]
    )
    expect(historicalCorrection.rewardLedger.filter((entry) => entry.periodKey === oldDate)).toHaveLength(2)
    expect(historicalCorrection.companion.xp).toBe(replay.companion.xp)
  })

  it('restores a snapshot by clearing and replacing every growth store in one transaction', async () => {
    const fake = fakeGrowthDatabase()
    openDBMock.mockResolvedValue(fake.db)
    const repository = await import('./repository')
    const snapshot = repository.createEmptyGrowthSnapshot('restored', 'birth-mark-3')
    snapshot.companion.xp = 460
    snapshot.companion.growthNode = 5
    snapshot.companion.mainForm = 'soft_cluster'

    await repository.replaceGrowthSnapshot(snapshot)
    const restored = await repository.loadGrowthSnapshot('restored')

    expect(restored.companion).toEqual(snapshot.companion)
    expect(fake.maps.get('cycles')?.size).toBe(1)
  })

  it('persists an Lv4 imprint choice and returns the same choice after reload', async () => {
    const fake = fakeGrowthDatabase()
    openDBMock.mockResolvedValue(fake.db)
    const repository = await import('./repository')
    const snapshot = repository.createEmptyGrowthSnapshot()
    snapshot.companion = {
      ...snapshot.companion,
      xp: 300,
      growthNode: 4,
      mainForm: 'soft_cluster',
      affinities: { awareness: 2, nourishment: 8, activity: 6, recovery: 1 }
    }
    await repository.replaceGrowthSnapshot(snapshot)

    await repository.saveGrowthImprint(1, 'nourishment', { chosenAt: '2026-08-04T20:00:00Z' })
    const restored = await repository.loadGrowthSnapshot()

    expect(restored.companion.firstImprint).toBe('nourishment')
    expect(restored.companion.firstImprintAffinityBaseline).toEqual(snapshot.companion.affinities)
  })
})
