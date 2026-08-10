import type { DailyLog, MealDetails } from '../types'

export const UPDATE_INTEGRITY_SESSION_KEY = '80kg-update-integrity-v1'

export interface DataIntegritySummary {
  logCount: number
  mealLineCount: number
  workoutCount: number
  earliestDate?: string
  latestDate?: string
}

/** The only data that may be retained for an update integrity check. */
export interface UpdateIntegritySessionPayload {
  summary: DataIntegritySummary
  hash: string
}

export type UpdateIntegrityComparison =
  | { status: 'missing'; current: UpdateIntegritySessionPayload }
  | { status: 'match'; previous: UpdateIntegritySessionPayload; current: UpdateIntegritySessionPayload }
  | { status: 'mismatch'; previous: UpdateIntegritySessionPayload; current: UpdateIntegritySessionPayload }

type StorageReader = Pick<Storage, 'getItem'>
type StorageWriter = Pick<Storage, 'setItem'>
type StorageRemover = Pick<Storage, 'removeItem'>

const mealKeys: ReadonlyArray<keyof Pick<MealDetails, 'breakfast' | 'lunch' | 'dinner' | 'evening'>> = [
  'breakfast',
  'lunch',
  'dinner',
  'evening'
]

const compareText = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0

/**
 * JSON-compatible stringify with deterministic object-key ordering.
 * It intentionally rejects cycles and BigInt values instead of silently
 * producing a hash that could not represent an exported JSON record.
 */
export function stableStringify(value: unknown): string {
  const ancestors = new Set<object>()

  const stringify = (item: unknown, inArray: boolean): string | undefined => {
    if (item === null) return 'null'

    switch (typeof item) {
      case 'string':
      case 'boolean':
        return JSON.stringify(item)
      case 'number':
        return Number.isFinite(item) ? JSON.stringify(item) : 'null'
      case 'undefined':
      case 'function':
      case 'symbol':
        return inArray ? 'null' : undefined
      case 'bigint':
        throw new TypeError('BigInt is not supported by stableStringify')
      case 'object':
        break
    }

    const object = item as object
    if (ancestors.has(object)) throw new TypeError('Cannot stableStringify a cyclic value')
    ancestors.add(object)

    let result: string
    if (Array.isArray(item)) {
      result = `[${item.map((entry) => stringify(entry, true) ?? 'null').join(',')}]`
    } else {
      const entries = Object.keys(item as Record<string, unknown>)
        .sort(compareText)
        .flatMap((key) => {
          const serialized = stringify((item as Record<string, unknown>)[key], false)
          return serialized === undefined ? [] : [`${JSON.stringify(key)}:${serialized}`]
        })
      result = `{${entries.join(',')}}`
    }

    ancestors.delete(object)
    return result
  }

  return stringify(value, false) ?? 'null'
}

const compareCanonical = <T>(getPrimaryKey: (value: T) => string) => (left: T, right: T) => {
  const primary = compareText(getPrimaryKey(left), getPrimaryKey(right))
  return primary || compareText(stableStringify(left), stableStringify(right))
}

const canonicalLogs = (logs: readonly DailyLog[]): DailyLog[] =>
  [...logs].sort(compareCanonical((log) => log.id))

/** Computes a read-only count/date summary without migrating or rewriting logs. */
export function buildDataIntegritySummary(logs: readonly DailyLog[]): DataIntegritySummary {
  let mealLineCount = 0
  let workoutCount = 0
  let earliestDate: string | undefined
  let latestDate: string | undefined

  for (const log of logs) {
    if (log.mealDetails) {
      for (const meal of mealKeys) mealLineCount += log.mealDetails[meal].filter((line) => line.amount > 0).length
    }
    workoutCount += log.workouts?.length ?? 0

    if (log.date) {
      if (earliestDate === undefined || log.date < earliestDate) earliestDate = log.date
      if (latestDate === undefined || log.date > latestDate) latestDate = log.date
    }
  }

  return {
    logCount: logs.length,
    mealLineCount,
    workoutCount,
    ...(earliestDate === undefined ? {} : { earliestDate }),
    ...(latestDate === undefined ? {} : { latestDate })
  }
}

/** Produces a local-only, order-independent SHA-256 fingerprint of the logs. */
export async function hashDailyLogs(
  logs: readonly DailyLog[],
  subtle: SubtleCrypto | undefined = globalThis.crypto?.subtle
): Promise<string> {
  if (!subtle) throw new Error('Web Crypto SHA-256 is unavailable on this device')
  const bytes = new TextEncoder().encode(stableStringify(canonicalLogs(logs)))
  const digest = await subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function createUpdateIntegritySessionPayload(
  logs: readonly DailyLog[],
  subtle?: SubtleCrypto
): Promise<UpdateIntegritySessionPayload> {
  return {
    summary: buildDataIntegritySummary(logs),
    hash: await hashDailyLogs(logs, subtle)
  }
}

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]) => {
  const actual = Object.keys(value).sort(compareText)
  const expected = [...keys].sort(compareText)
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

const isNonNegativeInteger = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 0

const isIsoDate = (value: unknown): value is string => {
  if (typeof value !== 'string') return false
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth[month - 1]
}

const isSummary = (value: unknown): value is DataIntegritySummary => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const summary = value as Record<string, unknown>
  const allowedKeys = ['logCount', 'mealLineCount', 'workoutCount', 'earliestDate', 'latestDate']
  if (Object.keys(summary).some((key) => !allowedKeys.includes(key))) return false
  if (!['logCount', 'mealLineCount', 'workoutCount'].every((key) => key in summary)) return false
  if (!isNonNegativeInteger(summary.logCount) || !isNonNegativeInteger(summary.mealLineCount) || !isNonNegativeInteger(summary.workoutCount)) return false
  if (summary.earliestDate !== undefined && !isIsoDate(summary.earliestDate)) return false
  if (summary.latestDate !== undefined && !isIsoDate(summary.latestDate)) return false
  if (typeof summary.earliestDate === 'string' && typeof summary.latestDate === 'string' && summary.earliestDate > summary.latestDate) return false
  return true
}

const isPayload = (value: unknown): value is UpdateIntegritySessionPayload => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const payload = value as Record<string, unknown>
  return hasExactKeys(payload, ['summary', 'hash'])
    && isSummary(payload.summary)
    && typeof payload.hash === 'string'
    && /^[a-f0-9]{64}$/.test(payload.hash)
}

export function serializeUpdateIntegritySessionPayload(payload: UpdateIntegritySessionPayload): string {
  if (!isPayload(payload)) throw new TypeError('Invalid update integrity payload')
  return stableStringify(payload)
}

export function parseUpdateIntegritySessionPayload(value: string | null): UpdateIntegritySessionPayload | undefined {
  if (value === null) return undefined
  try {
    const parsed: unknown = JSON.parse(value)
    return isPayload(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

export function writeUpdateIntegritySessionPayload(storage: StorageWriter, payload: UpdateIntegritySessionPayload): void {
  storage.setItem(UPDATE_INTEGRITY_SESSION_KEY, serializeUpdateIntegritySessionPayload(payload))
}

export function readUpdateIntegritySessionPayload(storage: StorageReader): UpdateIntegritySessionPayload | undefined {
  try {
    return parseUpdateIntegritySessionPayload(storage.getItem(UPDATE_INTEGRITY_SESSION_KEY))
  } catch {
    // The integrity marker is optional during normal app startup. Browsers can
    // deny session storage while IndexedDB remains available, so a blocked read
    // must never turn a successful data load into an application load failure.
    return undefined
  }
}

export function clearUpdateIntegritySessionPayload(storage: StorageRemover): void {
  try {
    storage.removeItem(UPDATE_INTEGRITY_SESSION_KEY)
  } catch {
    // Clearing a best-effort session marker must not interrupt recovery UI.
  }
}

export async function compareUpdateIntegritySessionPayload(
  previous: UpdateIntegritySessionPayload | undefined,
  logs: readonly DailyLog[],
  subtle?: SubtleCrypto
): Promise<UpdateIntegrityComparison> {
  const current = await createUpdateIntegritySessionPayload(logs, subtle)
  if (!previous) return { status: 'missing', current }

  const status = previous.hash === current.hash
    && stableStringify(previous.summary) === stableStringify(current.summary)
    ? 'match'
    : 'mismatch'
  return { status, previous, current }
}
