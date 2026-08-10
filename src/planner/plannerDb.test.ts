import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AIRun, FoodMetadata, FatLossPlan, PlannerConsent, PlannerSnapshot, PlanVersion, SafetyScreen, UserProfile, WeeklyReview } from './types'

const { openDBMock } = vi.hoisted(() => ({ openDBMock: vi.fn() }))

vi.mock('idb', () => ({ openDB: openDBMock }))

const indexedDBDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB')
const localStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')

const restoreGlobal = (name: 'indexedDB' | 'localStorage', descriptor?: PropertyDescriptor) => {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor)
  else Reflect.deleteProperty(globalThis, name)
}

const setIndexedDB = (value: Partial<IDBFactory>) => {
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value })
}

const blockIndexedDB = () => {
  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    get() { throw new Error('indexedDB blocked') }
  })
}

const setLocalStorage = (value: Pick<Storage, 'getItem' | 'setItem'>) => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value })
}

const blockLocalStorage = () => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { throw new Error('storage blocked') }
  })
}

const readableStorage = (marker: string | null = null) => ({
  getItem: vi.fn(() => marker),
  setItem: vi.fn()
})

const snapshotDatabase = () => ({
  get: vi.fn().mockResolvedValue(undefined),
  getAll: vi.fn().mockResolvedValue([])
})

const probeFactory = (exists: boolean, databases?: IDBFactory['databases']) => {
  const close = vi.fn()
  const abort = vi.fn()
  const open = vi.fn(() => {
    const request = {
      error: null,
      result: { close },
      transaction: { abort },
      onblocked: null,
      onerror: null,
      onsuccess: null,
      onupgradeneeded: null
    } as unknown as IDBOpenDBRequest
    queueMicrotask(() => {
      if (exists) request.onsuccess?.call(request, {} as Event)
      else {
        request.onupgradeneeded?.call(request, {} as IDBVersionChangeEvent)
        request.onerror?.call(request, {} as Event)
      }
    })
    return request
  })
  return { factory: { open, ...(databases ? { databases } : {}) } as Partial<IDBFactory>, open, close, abort }
}

beforeEach(() => {
  vi.resetModules()
  openDBMock.mockReset()
})

afterEach(() => {
  restoreGlobal('indexedDB', indexedDBDescriptor)
  restoreGlobal('localStorage', localStorageDescriptor)
})

describe('Planner database existence fallback', () => {
  it('attempts the normal open/read path when databases() is unavailable and localStorage cannot be read', async () => {
    const probe = probeFactory(true)
    setIndexedDB(probe.factory)
    blockLocalStorage()
    openDBMock.mockResolvedValue(snapshotDatabase())
    const plannerDb = await import('./plannerDb')

    await expect(plannerDb.plannerDatabaseExists()).resolves.toBe(true)
    await expect(plannerDb.loadPlannerSnapshotIfExists()).resolves.toEqual({
      plans: [],
      planVersions: [],
      weeklyReviews: [],
      consents: [],
      foodMetadata: []
    })
    expect(openDBMock).toHaveBeenCalledWith(
      plannerDb.PLANNER_DB_NAME,
      plannerDb.PLANNER_DB_VERSION,
      expect.objectContaining({ upgrade: expect.any(Function) })
    )
    expect(probe.close).toHaveBeenCalledTimes(2)
  })

  it('also fails safe to the open/read path when databases() enumeration rejects', async () => {
    const probe = probeFactory(true, vi.fn().mockRejectedValue(new Error('enumeration blocked')))
    setIndexedDB(probe.factory)
    setLocalStorage(readableStorage(null))
    const plannerDb = await import('./plannerDb')

    await expect(plannerDb.plannerDatabaseExists()).resolves.toBe(true)
  })

  it('probes without creating a missing database when databases() and the marker are unavailable', async () => {
    const probe = probeFactory(false)
    setIndexedDB(probe.factory)
    setLocalStorage(readableStorage(null))
    const plannerDb = await import('./plannerDb')

    await expect(plannerDb.plannerDatabaseExists()).resolves.toBe(false)
    await expect(plannerDb.loadPlannerSnapshotIfExists()).resolves.toEqual({
      plans: [],
      planVersions: [],
      weeklyReviews: [],
      consents: [],
      foodMetadata: []
    })
    expect(openDBMock).not.toHaveBeenCalled()
    expect(probe.abort).toHaveBeenCalledTimes(2)
  })

  it('does not trust a stale marker when the database itself is absent', async () => {
    const probe = probeFactory(false)
    setIndexedDB(probe.factory)
    setLocalStorage(readableStorage('1'))
    const plannerDb = await import('./plannerDb')

    await expect(plannerDb.plannerDatabaseExists()).resolves.toBe(false)
    expect(probe.abort).toHaveBeenCalledOnce()
  })

  it('propagates an indexedDB access failure so the App can block Planner writes', async () => {
    blockIndexedDB()
    setLocalStorage(readableStorage(null))
    const plannerDb = await import('./plannerDb')

    await expect(plannerDb.plannerDatabaseExists()).rejects.toThrow('indexedDB blocked')
    await expect(plannerDb.loadPlannerSnapshotIfExists()).rejects.toThrow('indexedDB blocked')
  })
})

describe('Planner marker commit isolation', () => {
  it('never rejects successful IndexedDB writes when localStorage.setItem throws', async () => {
    setIndexedDB({})
    const storage = readableStorage(null)
    storage.setItem.mockImplementation(() => { throw new Error('quota or security error') })
    setLocalStorage(storage)

    const put = vi.fn().mockResolvedValue('stored')
    const clear = vi.fn().mockResolvedValue(undefined)
    const transaction = {
      objectStore: vi.fn(() => ({ put, clear })),
      done: Promise.resolve()
    }
    openDBMock.mockResolvedValue({
      put,
      clear,
      transaction: vi.fn(() => transaction)
    })
    const plannerDb = await import('./plannerDb')

    await expect(plannerDb.saveInitialPlannerBundle(
      {} as UserProfile,
      {} as SafetyScreen,
      {} as FatLossPlan,
      {} as PlanVersion
    )).resolves.toBeUndefined()
    await expect(plannerDb.savePlanVersion({} as PlanVersion)).resolves.toBe('stored')
    await expect(plannerDb.saveWeeklyReview({} as WeeklyReview)).resolves.toBe('stored')
    await expect(plannerDb.savePlannerConsent({} as PlannerConsent)).resolves.toBe('stored')
    await expect(plannerDb.saveAIRun({} as AIRun)).resolves.toBe('stored')
    await expect(plannerDb.clearAIRuns()).resolves.toBeUndefined()
    await expect(plannerDb.saveFoodMetadata({} as FoodMetadata)).resolves.toBe('stored')
    await expect(plannerDb.replacePlannerSnapshot({
      plans: [],
      planVersions: [],
      weeklyReviews: [],
      consents: [],
      foodMetadata: []
    } as PlannerSnapshot)).resolves.toBeUndefined()

    expect(storage.setItem).toHaveBeenCalledTimes(8)
    expect(storage.setItem).toHaveBeenCalledWith('80kg-sprint-planner-created', '1')
  })

  it('still rejects the original IndexedDB failure and does not write a marker', async () => {
    setIndexedDB({})
    const storage = readableStorage(null)
    setLocalStorage(storage)
    const idbError = new Error('idb write failed')
    openDBMock.mockResolvedValue({ put: vi.fn().mockRejectedValue(idbError) })
    const plannerDb = await import('./plannerDb')

    await expect(plannerDb.savePlannerConsent({} as PlannerConsent)).rejects.toBe(idbError)
    expect(storage.setItem).not.toHaveBeenCalled()
  })
})
