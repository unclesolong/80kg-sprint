import { openDB } from 'idb'
import { chooseImprint, createInitialCompanion } from './progression'
import { emptyGrowthSnapshot, settleGrowthSnapshot } from './engine'
import type { GrowthAffinity, GrowthRepositorySettleInput, GrowthSnapshot, LuminousCompanionState } from './types'

export const GROWTH_DB_NAME = '80kg-sprint-growth'
export const GROWTH_DB_VERSION = 1
export const GROWTH_STORES = ['missions', 'rewards', 'cycles', 'achievements'] as const

let growthDbPromise: ReturnType<typeof openDB> | undefined

const openGrowthDb = () => {
  growthDbPromise ??= openDB(GROWTH_DB_NAME, GROWTH_DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('missions')) db.createObjectStore('missions', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('rewards')) db.createObjectStore('rewards', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('cycles')) db.createObjectStore('cycles', { keyPath: 'cycleId' })
      if (!db.objectStoreNames.contains('achievements')) db.createObjectStore('achievements', { keyPath: 'id' })
    }
  })
  return growthDbPromise
}

const readSnapshot = async (
  source: {
    objectStore(name: string): {
      get(key: string): Promise<unknown>
      getAll(): Promise<unknown[]>
    }
  },
  cycleId: string,
  birthMarkId?: string
): Promise<GrowthSnapshot> => {
  const [companion, missions, rewardLedger, achievements] = await Promise.all([
    source.objectStore('cycles').get(cycleId),
    source.objectStore('missions').getAll(),
    source.objectStore('rewards').getAll(),
    source.objectStore('achievements').getAll()
  ])
  return {
    companion: (companion as GrowthSnapshot['companion'] | undefined) ?? createInitialCompanion(cycleId, birthMarkId),
    missions: missions as GrowthSnapshot['missions'],
    rewardLedger: rewardLedger as GrowthSnapshot['rewardLedger'],
    achievements: achievements as GrowthSnapshot['achievements']
  }
}

interface GrowthSnapshotWriter {
  putCompanion(value: GrowthSnapshot['companion']): Promise<unknown>
  putMission(value: GrowthSnapshot['missions'][number]): Promise<unknown>
  deleteMission(id: string): Promise<unknown>
  putReward(value: GrowthSnapshot['rewardLedger'][number]): Promise<unknown>
  deleteReward(id: string): Promise<unknown>
  putAchievement(value: GrowthSnapshot['achievements'][number]): Promise<unknown>
}

const persistSnapshotDiff = async (
  previous: GrowthSnapshot,
  next: GrowthSnapshot,
  writer: GrowthSnapshotWriter
): Promise<void> => {
  const nextMissionIds = new Set(next.missions.map((mission) => mission.id))
  const nextRewardIds = new Set(next.rewardLedger.map((entry) => entry.id))
  await Promise.all([
    writer.putCompanion(next.companion),
    ...previous.missions.filter((mission) => !nextMissionIds.has(mission.id)).map((mission) => writer.deleteMission(mission.id)),
    ...next.missions.map(writer.putMission),
    ...previous.rewardLedger.filter((entry) => !nextRewardIds.has(entry.id)).map((entry) => writer.deleteReward(entry.id)),
    ...next.rewardLedger.map(writer.putReward),
    ...next.achievements.map(writer.putAchievement)
  ])
}

const reopenExpiredMissionsForDate = (snapshot: GrowthSnapshot, date: string): GrowthSnapshot => ({
  ...snapshot,
  missions: snapshot.missions.filter((mission) => mission.status !== 'expired' || !(
    (mission.cadence === 'daily' && mission.periodStart === date && mission.periodEnd === date)
    || (mission.cadence === 'weekly' && mission.periodStart <= date && mission.periodEnd >= date)
  ))
})

const settlementDates = (today: string, dates: readonly string[]): string[] => {
  const earlier = [...new Set(dates)]
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && date < today)
    .sort()
    .slice(-13)
  return [...earlier, today]
}

export const loadGrowthSnapshot = async (cycleId = 'luminous-current', birthMarkId?: string): Promise<GrowthSnapshot> => {
  const db = await openGrowthDb()
  return readSnapshot({ objectStore: (name) => ({
    get: (key) => db.get(name, key),
    getAll: () => db.getAll(name)
  }) }, cycleId, birthMarkId)
}

/**
 * Generates, evaluates and settles today's daily and weekly missions in one
 * IndexedDB transaction. Core log/Planner writes intentionally stay outside
 * this database so a growth storage failure cannot corrupt health records.
 */
export const settleGrowth = async (input: GrowthRepositorySettleInput): Promise<GrowthSnapshot> => {
  const db = await openGrowthDb()
  const cycleId = input.cycleId ?? 'luminous-current'
  const tx = db.transaction(GROWTH_STORES, 'readwrite')
  const snapshot = await readSnapshot(tx, cycleId, input.birthMarkId)
  const next = settleGrowthSnapshot(snapshot, { ...input, cycleId })
  const missionStore = tx.objectStore('missions')
  const rewardStore = tx.objectStore('rewards')
  await persistSnapshotDiff(snapshot, next, {
    putCompanion: (value) => tx.objectStore('cycles').put(value),
    putMission: (value) => missionStore.put(value),
    deleteMission: (id) => missionStore.delete(id),
    putReward: (value) => rewardStore.put(value),
    deleteReward: (id) => rewardStore.delete(id),
    putAchievement: (value) => tx.objectStore('achievements').put(value)
  })
  await tx.done
  return next
}

/**
 * Atomically replays up to 13 evidence dates and then settles today. Existing
 * historical rewards are preserved; their ledger keys still prevent duplicate
 * XP while expired missions inside the replay window can be regenerated.
 */
export const settleGrowthDates = async (
  input: GrowthRepositorySettleInput,
  dates: readonly string[]
): Promise<GrowthSnapshot> => {
  const db = await openGrowthDb()
  const cycleId = input.cycleId ?? 'luminous-current'
  const tx = db.transaction(GROWTH_STORES, 'readwrite')
  const original = await readSnapshot(tx, cycleId, input.birthMarkId)
  let next = original

  for (const date of settlementDates(input.today, dates)) {
    next = reopenExpiredMissionsForDate(next, date)
    next = settleGrowthSnapshot(
      next,
      { ...input, today: date, cycleId },
      { preserveExistingRewards: date !== input.today }
    )
  }

  const missionStore = tx.objectStore('missions')
  const rewardStore = tx.objectStore('rewards')
  await persistSnapshotDiff(original, next, {
    putCompanion: (value) => tx.objectStore('cycles').put(value),
    putMission: (value) => missionStore.put(value),
    deleteMission: (id) => missionStore.delete(id),
    putReward: (value) => rewardStore.put(value),
    deleteReward: (id) => rewardStore.delete(id),
    putAchievement: (value) => tx.objectStore('achievements').put(value)
  })
  await tx.done
  return next
}

export const saveGrowthImprint = async (
  slot: 1 | 2,
  affinity: GrowthAffinity,
  options: { cycleId?: string; chosenAt?: string; birthMarkId?: string } = {}
): Promise<LuminousCompanionState> => {
  const cycleId = options.cycleId ?? 'luminous-current'
  const db = await openGrowthDb()
  const tx = db.transaction('cycles', 'readwrite')
  const store = tx.objectStore('cycles')
  const current = (await store.get(cycleId) as LuminousCompanionState | undefined) ?? createInitialCompanion(cycleId, options.birthMarkId)
  const next = chooseImprint(current, slot, affinity, options.chosenAt)
  await store.put(next)
  await tx.done
  return next
}

export const saveEquippedAchievementAssets = async (
  assetIds: readonly string[],
  cycleId = 'luminous-current'
): Promise<LuminousCompanionState> => {
  const db = await openGrowthDb()
  const tx = db.transaction(['cycles', 'achievements'], 'readwrite')
  const cycleStore = tx.objectStore('cycles')
  const [current, achievements] = await Promise.all([
    cycleStore.get(cycleId) as Promise<LuminousCompanionState | undefined>,
    tx.objectStore('achievements').getAll() as Promise<GrowthSnapshot['achievements']>
  ])
  const allowed = new Set(achievements.map((achievement) => achievement.assetId))
  const equippedAchievementAssetIds = [...new Set(assetIds)].filter((assetId) => allowed.has(assetId))
  const next = { ...(current ?? createInitialCompanion(cycleId)), equippedAchievementAssetIds }
  await cycleStore.put(next)
  await tx.done
  return next
}

/** Atomic backup/restore entry point; callers are responsible for validating imported JSON. */
export const replaceGrowthSnapshot = async (snapshot: GrowthSnapshot): Promise<void> => {
  const db = await openGrowthDb()
  const tx = db.transaction(GROWTH_STORES, 'readwrite')
  await Promise.all(GROWTH_STORES.map((store) => tx.objectStore(store).clear()))
  await Promise.all([
    tx.objectStore('cycles').put(snapshot.companion),
    ...snapshot.missions.map((mission) => tx.objectStore('missions').put(mission)),
    ...snapshot.rewardLedger.map((entry) => tx.objectStore('rewards').put(entry)),
    ...snapshot.achievements.map((achievement) => tx.objectStore('achievements').put(achievement))
  ])
  await tx.done
}

export const createEmptyGrowthSnapshot = emptyGrowthSnapshot
