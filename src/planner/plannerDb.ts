import { openDB } from 'idb'
import { emptyPlannerSnapshot } from './planSelectors'
import type { FatLossPlan, PlannerSnapshot, PlanVersion, SafetyScreen, UserProfile, WeeklyReview } from './types'

export const PLANNER_DB_NAME = '80kg-sprint-planner'
export const PLANNER_DB_VERSION = 1
export const PLANNER_STORES = ['profile', 'safety', 'plans', 'planVersions', 'weeklyReviews', 'aiRuns', 'consents', 'foodMetadata', 'drafts', 'uiPreferences'] as const
const PLANNER_MARKER = '80kg-sprint-planner-created'

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

export const plannerDatabaseExists = async () => {
  if (typeof indexedDB === 'undefined') return false
  if (typeof indexedDB.databases === 'function') {
    const databases = await indexedDB.databases()
    return databases.some((database) => database.name === PLANNER_DB_NAME)
  }
  return typeof localStorage !== 'undefined' && localStorage.getItem(PLANNER_MARKER) === '1'
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

export const saveInitialPlannerBundle = async (profile: UserProfile, safety: SafetyScreen, plan: FatLossPlan, version: PlanVersion) => {
  const db = await openPlannerDb()
  const tx = db.transaction(['profile', 'safety', 'plans', 'planVersions'], 'readwrite')
  await Promise.all([
    tx.objectStore('profile').put(profile, 'current'),
    tx.objectStore('safety').put(safety, 'current'),
    tx.objectStore('plans').put(plan),
    tx.objectStore('planVersions').put(version)
  ])
  await tx.done
  if (typeof localStorage !== 'undefined') localStorage.setItem(PLANNER_MARKER, '1')
}

export const savePlanVersion = async (version: PlanVersion) => (await openPlannerDb()).put('planVersions', version)
export const saveWeeklyReview = async (review: WeeklyReview) => (await openPlannerDb()).put('weeklyReviews', review)

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
  if (typeof localStorage !== 'undefined') localStorage.setItem(PLANNER_MARKER, '1')
}
