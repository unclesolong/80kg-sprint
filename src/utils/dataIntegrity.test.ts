import { describe, expect, it } from 'vitest'
import { emptyLog } from '../defaults'
import type { DailyLog, MealLine, WorkoutEntry } from '../types'
import {
  UPDATE_INTEGRITY_SESSION_KEY,
  buildDataIntegritySummary,
  clearUpdateIntegritySessionPayload,
  compareUpdateIntegritySessionPayload,
  createUpdateIntegritySessionPayload,
  hashDailyLogs,
  parseUpdateIntegritySessionPayload,
  readUpdateIntegritySessionPayload,
  serializeUpdateIntegritySessionPayload,
  stableStringify,
  writeUpdateIntegritySessionPayload
} from './dataIntegrity'

const mealLine = (key: string, amount: number): MealLine => ({
  key,
  label: `食物 ${key}`,
  amount,
  unit: 'g',
  kcalPerUnit: 1,
  proteinPerUnit: 0.1
})

const workout = (id: string): WorkoutEntry => ({
  id,
  type: 'walk',
  title: `運動 ${id}`,
  durationMinutes: 20,
  source: 'manual'
})

const log = (id: string, date: string, breakfast: MealLine[], workouts: WorkoutEntry[]): DailyLog => ({
  id,
  date,
  mealDetails: {
    breakfast,
    lunch: [mealLine(`${id}-lunch`, 120)],
    dinner: [],
    evening: [],
    ramen: {
      enabled: false,
      packageKcal: 450,
      noodleRatio: 1,
      seasoningRatio: 1,
      oilRatio: 1,
      drankSoup: false,
      chickenG: 0,
      vegetablesG: 0
    }
  },
  workouts,
  createdAt: `${date}T06:00:00.000Z`,
  updatedAt: `${date}T20:00:00.000Z`
})

const fixture = (): DailyLog[] => [
  log('log-b', '2026-08-10', [mealLine('banana', 80), mealLine('apple', 100)], [workout('walk-2'), workout('walk-1')]),
  log('log-a', '2026-08-01', [mealLine('yogurt', 250)], [workout('strength-1')])
]

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object') {
    Object.freeze(value)
    Object.values(value).forEach(deepFreeze)
  }
  return value
}

describe('data integrity summary', () => {
  it('counts logs, MealLines and workouts and finds the date range', () => {
    expect(buildDataIntegritySummary(fixture())).toEqual({
      logCount: 2,
      mealLineCount: 5,
      workoutCount: 3,
      earliestDate: '2026-08-01',
      latestDate: '2026-08-10'
    })
  })

  it('does not mutate frozen source logs', () => {
    const logs = deepFreeze(fixture())
    const before = JSON.stringify(logs)
    expect(() => buildDataIntegritySummary(logs)).not.toThrow()
    expect(JSON.stringify(logs)).toBe(before)
  })

  it('omits a date range for an empty collection', () => {
    expect(buildDataIntegritySummary([])).toEqual({ logCount: 0, mealLineCount: 0, workoutCount: 0 })
  })

  it('does not count zero-amount legacy placeholders as recorded food', () => {
    expect(buildDataIntegritySummary([emptyLog('2026-08-10')]).mealLineCount).toBe(0)
  })
})

describe('stable local integrity hash', () => {
  it('stableStringify orders object keys recursively', () => {
    expect(stableStringify({ z: 1, nested: { b: true, a: false }, a: 2 }))
      .toBe('{"a":2,"nested":{"a":false,"b":true},"z":1}')
  })

  it('is unchanged when the top-level logs are reordered', async () => {
    const original = fixture()
    const reordered = [...original].reverse()

    await expect(hashDailyLogs(reordered)).resolves.toBe(await hashDailyLogs(original))
  })

  it('detects a meaningful nested record-order change', async () => {
    const original = fixture()
    const reorderedMealLines = structuredClone(original)
    reorderedMealLines[0].mealDetails!.breakfast.reverse()

    expect(await hashDailyLogs(reorderedMealLines)).not.toBe(await hashDailyLogs(original))
  })

  it('changes when a MealLine amount changes', async () => {
    const original = fixture()
    const changed = structuredClone(original)
    changed[0].mealDetails!.breakfast[0].amount += 1

    expect(await hashDailyLogs(changed)).not.toBe(await hashDailyLogs(original))
  })

  it('hashes without mutating frozen source logs', async () => {
    const logs = deepFreeze(fixture())
    const before = JSON.stringify(logs)
    await hashDailyLogs(logs)
    expect(JSON.stringify(logs)).toBe(before)
  })
})

describe('update integrity session payload', () => {
  it('serializes only a summary and a SHA-256 hash', async () => {
    const payload = await createUpdateIntegritySessionPayload(fixture())
    const serialized = serializeUpdateIntegritySessionPayload(payload)
    const parsed = JSON.parse(serialized) as Record<string, unknown>

    expect(Object.keys(parsed).sort()).toEqual(['hash', 'summary'])
    expect(serialized).not.toContain('食物')
    expect(serialized).not.toContain('amount')
    expect(payload.hash).toMatch(/^[a-f0-9]{64}$/)
    expect(parseUpdateIntegritySessionPayload(serialized)).toEqual(payload)
  })

  it('rejects malformed, extra-field and health-detail payloads', () => {
    expect(parseUpdateIntegritySessionPayload('{')).toBeUndefined()
    expect(parseUpdateIntegritySessionPayload(JSON.stringify({
      summary: { logCount: 1, mealLineCount: 1, workoutCount: 0 },
      hash: '0'.repeat(64),
      logs: fixture()
    }))).toBeUndefined()
    expect(parseUpdateIntegritySessionPayload(JSON.stringify({
      summary: { logCount: 1, mealLineCount: 1, workoutCount: 0, earliestDate: 'private health note' },
      hash: '0'.repeat(64)
    }))).toBeUndefined()
    expect(parseUpdateIntegritySessionPayload(JSON.stringify({
      summary: { logCount: 1, mealLineCount: 1, workoutCount: 0, earliestDate: '2026-99-99' },
      hash: '0'.repeat(64)
    }))).toBeUndefined()
    expect(parseUpdateIntegritySessionPayload(JSON.stringify({
      summary: { logCount: 1, mealLineCount: 1, workoutCount: 0, earliestDate: '2026-08-10', latestDate: '2026-08-01' },
      hash: '0'.repeat(64)
    }))).toBeUndefined()
  })

  it('reads, writes and clears the versioned session key', async () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
      removeItem: (key: string) => { values.delete(key) }
    }
    const payload = await createUpdateIntegritySessionPayload(fixture())

    writeUpdateIntegritySessionPayload(storage, payload)
    expect(values.has(UPDATE_INTEGRITY_SESSION_KEY)).toBe(true)
    expect(readUpdateIntegritySessionPayload(storage)).toEqual(payload)
    clearUpdateIntegritySessionPayload(storage)
    expect(readUpdateIntegritySessionPayload(storage)).toBeUndefined()
  })

  it('classifies missing, matching and changed post-update data', async () => {
    const logs = fixture()
    const previous = await createUpdateIntegritySessionPayload(logs)
    await expect(compareUpdateIntegritySessionPayload(undefined, logs)).resolves.toMatchObject({ status: 'missing' })
    await expect(compareUpdateIntegritySessionPayload(previous, [...logs].reverse())).resolves.toMatchObject({ status: 'match' })

    const changed = structuredClone(logs)
    changed[0].mealDetails!.breakfast[0].amount += 1
    await expect(compareUpdateIntegritySessionPayload(previous, changed)).resolves.toMatchObject({ status: 'mismatch' })
  })
})
