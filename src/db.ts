import { openDB } from 'idb'
import type { ChallengeSettings, CustomFood, DailyLog } from './types'
import { defaultSettings } from './defaults'

const dbPromise = openDB('80kg-sprint', 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('logs')) db.createObjectStore('logs', { keyPath: 'id' })
    if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings')
    if (!db.objectStoreNames.contains('foods')) db.createObjectStore('foods', { keyPath: 'id' })
  }
})

export const loadAll = async () => {
  const db = await dbPromise
  const [settings, logs, foods] = await Promise.all([
    db.get('settings', 'challenge') as Promise<ChallengeSettings | undefined>,
    db.getAll('logs') as Promise<DailyLog[]>,
    db.getAll('foods') as Promise<CustomFood[]>
  ])
  return { settings: settings ?? defaultSettings, logs, foods }
}

export const saveSettings = async (settings: ChallengeSettings) => (await dbPromise).put('settings', settings, 'challenge')
export const saveLog = async (log: DailyLog) => (await dbPromise).put('logs', log)
export const saveFood = async (food: CustomFood) => (await dbPromise).put('foods', food)
export const deleteFood = async (id: string) => (await dbPromise).delete('foods', id)

export const replaceAllData = async (settings: ChallengeSettings, logs: DailyLog[], foods: CustomFood[]) => {
  const db = await dbPromise
  const tx = db.transaction(['settings', 'logs', 'foods'], 'readwrite')
  await Promise.all([tx.objectStore('logs').clear(), tx.objectStore('foods').clear()])
  await tx.objectStore('settings').put(settings, 'challenge')
  await Promise.all(logs.map((log) => tx.objectStore('logs').put(log)))
  await Promise.all(foods.map((food) => tx.objectStore('foods').put(food)))
  await tx.done
}

export const clearAllData = async () => {
  const db = await dbPromise
  const tx = db.transaction(['settings', 'logs', 'foods'], 'readwrite')
  await Promise.all([
    tx.objectStore('settings').clear(),
    tx.objectStore('logs').clear(),
    tx.objectStore('foods').clear()
  ])
  await tx.done
}
