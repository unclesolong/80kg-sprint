import { openDB } from 'idb'
import { emptyPlannerSnapshot } from './planSelectors'
import type { AIRun, FatLossPlan, FoodMetadata, PlannerConsent, PlannerSnapshot, PlanVersion, SafetyScreen, UserProfile, WeeklyReview } from './types'

export const PLANNER_DB_NAME = '80kg-sprint-planner'
export const PLANNER_DB_VERSION = 1
export const PLANNER_STORES = ['profile', 'safety', 'plans', 'planVersions', 'weeklyReviews', 'aiRuns', 'consents', 'foodMetadata', 'drafts', 'uiPreferences'] as const
const PLANNER_MARKER = '80kg-sprint-planner-created'

/** Legacy compatibility marker; it must never reverse a committed IDB write. */
const rememberPlannerDatabase = (): void => {
  try {
    globalThis.localStorage?.setItem(PLANNER_MARKER, '1')
  } catch {
    // IndexedDB is authoritative. Storage access may be blocked in private or
    // restricted browser contexts, so a marker failure is deliberately ignored.
  }
}

let plannerDbPromise: ReturnType<typeof openDB> | undefined

const openPlannerDb = () => {
  plannerDbPromise ??= openDB(PLANNER_DB_NAME, PLANNER_DB_VERSION, {
    upgrade(db) {
      for (const store of PLANNER_STORES) {
        if (db.objectStoreNames.contains(store)) continue
        if (['plans', 'planVersions', 'weeklyReviews', 'aiRuns', 'consents', 'foodMetadata', 'drafts'].includes(store)) db.createObjectStore(store, { keyPath: 'id' })
        else db.createObjectStore(store)
      }
    }
  })
  return plannerDbPromise
}

/**
 * Safely probes older browsers that do not expose indexedDB.databases().
 * Opening a missing DB triggers upgradeneeded; aborting that versionchange
 * transaction prevents an empty database from being created during startup.
 */
const probePlannerDatabaseExists = (databaseFactory: IDBFactory): Promise<boolean> => new Promise((resolve, reject) => {
  const request = databaseFactory.open(PLANNER_DB_NAME)
  let missingDatabase = false
  let settled = false
  const finish = (value: boolean) => {
    if (settled) return
    settled = true
    resolve(value)
  }
  const fail = (error: unknown) => {
    if (settled) return
    settled = true
    reject(error)
  }

  request.onupgradeneeded = () => {
    missingDatabase = true
    try {
      request.transaction?.abort()
    } catch (error) {
      fail(error)
    }
  }
  request.onsuccess = () => {
    try {
      request.result.close()
      finish(true)
    } catch (error) {
      fail(error)
    }
  }
  request.onerror = () => {
    if (missingDatabase) finish(false)
    else fail(request.error ?? new Error('Planner database probe failed'))
  }
  request.onblocked = () => fail(new Error('Planner database probe was blocked'))
})

export const plannerDatabaseExists = async () => {
  const databaseFactory = globalThis.indexedDB
  if (!databaseFactory) return false
  if (typeof databaseFactory.databases === 'function') {
    try {
      const databases = await databaseFactory.databases()
      return databases.some((database) => database.name === PLANNER_DB_NAME)
    } catch {
      // Fall through to the non-creating probe when enumeration is blocked.
    }
  }
  return probePlannerDatabaseExists(databaseFactory)
}

export const loadPlannerSnapshot = async (): Promise<PlannerSnapshot> => {
  const db = await openPlannerDb()
  const [profile, safety, plans, planVersions, weeklyReviews, consents, foodMetadata] = await Promise.all([
    db.get('profile', 'current') as Promise<UserProfile | undefined>,
    db.get('safety', 'current') as Promise<SafetyScreen | undefined>,
    db.getAll('plans') as Promise<FatLossPlan[]>,
    db.getAll('planVersions') as Promise<PlanVersion[]>,
    db.getAll('weeklyReviews') as Promise<WeeklyReview[]>,
    db.getAll('consents'),
    db.getAll('foodMetadata')
  ])
  return { profile, safety, plans, planVersions, weeklyReviews, consents, foodMetadata }
}

export const loadPlannerSnapshotIfExists = async () => await plannerDatabaseExists() ? loadPlannerSnapshot() : emptyPlannerSnapshot()

export const saveInitialPlannerBundle = async (profile: UserProfile, safety: SafetyScreen, plan: FatLossPlan, version: PlanVersion, consent?: PlannerConsent) => {
  const db = await openPlannerDb()
  const stores = consent ? ['profile', 'safety', 'plans', 'planVersions', 'consents'] as const : ['profile', 'safety', 'plans', 'planVersions'] as const
  const tx = db.transaction(stores, 'readwrite')
  const writes = [
    tx.objectStore('profile').put(profile, 'current'),
    tx.objectStore('safety').put(safety, 'current'),
    tx.objectStore('plans').put(plan),
    tx.objectStore('planVersions').put(version)
  ]
  if (consent) writes.push(tx.objectStore('consents').put(consent))
  await Promise.all(writes)
  await tx.done
  rememberPlannerDatabase()
}

export const savePlanVersion = async (version: PlanVersion) => {
  const result = await (await openPlannerDb()).put('planVersions', version)
  rememberPlannerDatabase()
  return result
}
export const saveWeeklyReview = async (review: WeeklyReview) => {
  const result = await (await openPlannerDb()).put('weeklyReviews', review)
  rememberPlannerDatabase()
  return result
}
export const savePlannerConsent = async (consent: PlannerConsent) => {
  const result = await (await openPlannerDb()).put('consents', consent)
  rememberPlannerDatabase()
  return result
}
export const saveAIRun = async (run: AIRun) => {
  const result = await (await openPlannerDb()).put('aiRuns', run)
  rememberPlannerDatabase()
  return result
}
export const clearAIRuns = async () => {
  const result = await (await openPlannerDb()).clear('aiRuns')
  rememberPlannerDatabase()
  return result
}
export const saveFoodMetadata = async (metadata: FoodMetadata) => {
  const result = await (await openPlannerDb()).put('foodMetadata', metadata)
  rememberPlannerDatabase()
  return result
}

export const replacePlannerSnapshot = async (snapshot: PlannerSnapshot) => {
  const db = await openPlannerDb()
  const stores = ['profile', 'safety', 'plans', 'planVersions', 'weeklyReviews', 'consents', 'foodMetadata'] as const
  const tx = db.transaction(stores, 'readwrite')
  await Promise.all(stores.map((store) => tx.objectStore(store).clear()))
  if (snapshot.profile) await tx.objectStore('profile').put(snapshot.profile, 'current')
  if (snapshot.safety) await tx.objectStore('safety').put(snapshot.safety, 'current')
  await Promise.all([
    ...snapshot.plans.map((item) => tx.objectStore('plans').put(item)),
    ...snapshot.planVersions.map((item) => tx.objectStore('planVersions').put(item)),
    ...snapshot.weeklyReviews.map((item) => tx.objectStore('weeklyReviews').put(item)),
    ...snapshot.consents.map((item) => tx.objectStore('consents').put(item)),
    ...snapshot.foodMetadata.map((item) => tx.objectStore('foodMetadata').put(item))
  ])
  await tx.done
  rememberPlannerDatabase()
}
