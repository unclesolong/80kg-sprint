import { ACHIEVEMENT_DEFINITIONS } from './achievements'
import { AFFINITIES, type GrowthAffinity, type GrowthSnapshot } from './types'

const MAX_ID_LENGTH = 1_024
const MAX_SHORT_ID_LENGTH = 256
const MAX_TIMESTAMP_LENGTH = 64
const MAX_GROWTH_RECORDS = 100_000
const MAX_EVIDENCE_IDS = 100
const MAX_EQUIPPED_ASSETS = ACHIEVEMENT_DEFINITIONS.length
const MAX_TOTAL_XP = 10_000_000
const MAX_AFFINITY_TOTAL = 1_000_000
const MAX_MISSION_METRIC_VALUE = 10_000_000

const CADENCES = ['daily', 'weekly'] as const
const MODES = ['tracking', 'planner'] as const
const MISSION_STATUSES = ['available', 'in_progress', 'completed', 'superseded', 'expired'] as const
const MISSION_SOURCES = ['local_rule', 'ai_suggested', 'user_selected'] as const
const MISSION_OPERATORS = ['complete', 'at_least', 'within_range', 'count'] as const
const MISSION_SLOTS = ['core', 'behavior', 'care', 'weekly'] as const
const RESOURCES = ['dew', 'fruit', 'wind_seed', 'moonlight'] as const
const MAIN_FORMS = ['light_drop', 'soft_cluster', 'flow_ring', 'star_tide'] as const
const MISSION_METRICS = [
  'food_logged',
  'daily_reflection',
  'daily_finalized',
  'balanced_intake',
  'protein_range',
  'water_target',
  'sleep_target',
  'meal_action',
  'activity_summary',
  'recovery_checkin',
  'weekly_stable_recording',
  'weekly_body_observation',
  'weekly_aerobic',
  'weekly_strength',
  'weekly_recovery',
  'weekly_review'
] as const
const EVALUATION_REASONS = ['waiting_for_data', 'in_progress', 'completed', 'outside_target', 'expired', 'superseded'] as const
const ACHIEVEMENT_IDS = ACHIEVEMENT_DEFINITIONS.map((definition) => definition.id)
const ACHIEVEMENT_ASSET_BY_ID = new Map(ACHIEVEMENT_DEFINITIONS.map((definition) => [definition.id, definition.assetId]))
const RESOURCE_BY_AFFINITY = {
  awareness: 'dew',
  nourishment: 'fruit',
  activity: 'wind_seed',
  recovery: 'moonlight'
} as const satisfies Record<GrowthAffinity, (typeof RESOURCES)[number]>

const hasOwn = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key)

const asExactRecord = (
  value: unknown,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[] = []
): Record<string, unknown> | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) return undefined
  const allowed = new Set([...requiredKeys, ...optionalKeys])
  const keys = Reflect.ownKeys(value)
  if (keys.some((key) => typeof key !== 'string' || !allowed.has(key))) return undefined
  if (!requiredKeys.every((key) => hasOwn(value, key))) return undefined
  return value as Record<string, unknown>
}

const isEnumValue = <T extends string>(value: unknown, values: readonly T[]): value is T =>
  typeof value === 'string' && (values as readonly string[]).includes(value)

const isBoundedString = (value: unknown, maximumLength = MAX_SHORT_ID_LENGTH): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= maximumLength

const isNonNegativeSafeInteger = (value: unknown, maximum = Number.MAX_SAFE_INTEGER): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= maximum

const isNonNegativeSafeNumber = (value: unknown, maximum = Number.MAX_SAFE_INTEGER): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= maximum

const isDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = Date.parse(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value
}

const isTimestamp = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= MAX_TIMESTAMP_LENGTH &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
  isDate(value.slice(0, 10)) &&
  Number.isFinite(Date.parse(value))

const optionalField = (
  record: Record<string, unknown>,
  key: string,
  validator: (value: unknown) => boolean
): boolean => !hasOwn(record, key) || validator(record[key])

const isUniqueStringArray = (
  value: unknown,
  maximumItems: number,
  maximumStringLength = MAX_ID_LENGTH
): value is string[] => {
  if (!Array.isArray(value) || value.length > maximumItems) return false
  const seen = new Set<string>()
  for (const item of value) {
    if (!isBoundedString(item, maximumStringLength) || seen.has(item)) return false
    seen.add(item)
  }
  return true
}

const isAffinityTotals = (value: unknown): value is Record<GrowthAffinity, number> => {
  const item = asExactRecord(value, AFFINITIES)
  return Boolean(item && AFFINITIES.every((affinity) => isNonNegativeSafeInteger(item[affinity], MAX_AFFINITY_TOTAL)))
}

const isCompanion = (value: unknown): value is GrowthSnapshot['companion'] => {
  const item = asExactRecord(value, [
    'cycleId',
    'xp',
    'mainForm',
    'growthNode',
    'affinities',
    'birthMarkId',
    'equippedAchievementAssetIds'
  ], [
    'firstImprint',
    'secondImprint',
    'firstImprintAffinityBaseline',
    'firstImprintChosenAt',
    'secondImprintChosenAt',
    'recentAuraId',
    'maturedAt'
  ])
  if (!item) return false
  const validFields = isBoundedString(item.cycleId) &&
    isNonNegativeSafeInteger(item.xp, MAX_TOTAL_XP) &&
    isEnumValue(item.mainForm, MAIN_FORMS) &&
    isNonNegativeSafeInteger(item.growthNode) && item.growthNode >= 1 && item.growthNode <= 12 &&
    isAffinityTotals(item.affinities) &&
    isBoundedString(item.birthMarkId) &&
    isUniqueStringArray(item.equippedAchievementAssetIds, MAX_EQUIPPED_ASSETS) &&
    optionalField(item, 'firstImprint', (entry) => isEnumValue(entry, AFFINITIES)) &&
    optionalField(item, 'secondImprint', (entry) => isEnumValue(entry, AFFINITIES)) &&
    optionalField(item, 'firstImprintAffinityBaseline', isAffinityTotals) &&
    optionalField(item, 'firstImprintChosenAt', isTimestamp) &&
    optionalField(item, 'secondImprintChosenAt', isTimestamp) &&
    optionalField(item, 'recentAuraId', (entry) => isBoundedString(entry)) &&
    optionalField(item, 'maturedAt', isTimestamp)
  if (!validFields) return false

  const node = item.growthNode as number
  const expectedForm = node >= 10 ? 'star_tide' : node >= 7 ? 'flow_ring' : node >= 4 ? 'soft_cluster' : 'light_drop'
  if (item.mainForm !== expectedForm) return false
  if (hasOwn(item, 'firstImprint') && node < 4) return false
  if (hasOwn(item, 'secondImprint') && (!hasOwn(item, 'firstImprint') || node < 7)) return false
  if ((hasOwn(item, 'firstImprintAffinityBaseline') || hasOwn(item, 'firstImprintChosenAt')) && !hasOwn(item, 'firstImprint')) return false
  if (hasOwn(item, 'secondImprintChosenAt') && !hasOwn(item, 'secondImprint')) return false
  return !hasOwn(item, 'maturedAt') || Number(item.xp) >= 2_140
}

const isMission = (value: unknown): value is GrowthSnapshot['missions'][number] => {
  const item = asExactRecord(value, [
    'id',
    'ruleVersion',
    'dateOrWeek',
    'cadence',
    'periodStart',
    'periodEnd',
    'mode',
    'slot',
    'category',
    'source',
    'metric',
    'operator',
    'progress',
    'status',
    'reward',
    'createdAt'
  ], [
    'targetMin',
    'targetMax',
    'planId',
    'planVersionId',
    'safetyAlternativeId',
    'supersedesMissionId',
    'evaluatedAt',
    'evaluationReason'
  ])
  if (!item) return false
  if (!isBoundedString(item.id, MAX_ID_LENGTH) || item.ruleVersion !== 1 ||
    !isDate(item.dateOrWeek) || !isEnumValue(item.cadence, CADENCES) ||
    !isDate(item.periodStart) || !isDate(item.periodEnd) || item.periodEnd < item.periodStart ||
    !isEnumValue(item.mode, MODES) || !isEnumValue(item.slot, MISSION_SLOTS) ||
    !isEnumValue(item.category, AFFINITIES) || !isEnumValue(item.source, MISSION_SOURCES) ||
    !isEnumValue(item.metric, MISSION_METRICS) || !isEnumValue(item.operator, MISSION_OPERATORS) ||
    !isNonNegativeSafeNumber(item.progress, MAX_MISSION_METRIC_VALUE) || !isEnumValue(item.status, MISSION_STATUSES) ||
    !isEnumValue(item.reward, RESOURCES) || !isTimestamp(item.createdAt)) return false

  if (item.reward !== RESOURCE_BY_AFFINITY[item.category]) return false

  if (!optionalField(item, 'targetMin', (entry) => isNonNegativeSafeNumber(entry, MAX_MISSION_METRIC_VALUE)) ||
    !optionalField(item, 'targetMax', (entry) => isNonNegativeSafeNumber(entry, MAX_MISSION_METRIC_VALUE)) ||
    !optionalField(item, 'planId', (entry) => isBoundedString(entry, MAX_ID_LENGTH)) ||
    !optionalField(item, 'planVersionId', (entry) => isBoundedString(entry, MAX_ID_LENGTH)) ||
    !optionalField(item, 'safetyAlternativeId', (entry) => isBoundedString(entry, MAX_ID_LENGTH)) ||
    !optionalField(item, 'supersedesMissionId', (entry) => isBoundedString(entry, MAX_ID_LENGTH)) ||
    !optionalField(item, 'evaluatedAt', isTimestamp) ||
    !optionalField(item, 'evaluationReason', (entry) => isEnumValue(entry, EVALUATION_REASONS))) return false

  return !hasOwn(item, 'targetMin') || !hasOwn(item, 'targetMax') || Number(item.targetMin) <= Number(item.targetMax)
}

const isRewardEntry = (value: unknown): value is GrowthSnapshot['rewardLedger'][number] => {
  const item = asExactRecord(value, [
    'id',
    'taskId',
    'cadence',
    'periodKey',
    'xpDelta',
    'category',
    'affinityDelta',
    'createdAt'
  ])
  if (!item) return false
  if (!isBoundedString(item.id, MAX_ID_LENGTH) || !isBoundedString(item.taskId, MAX_ID_LENGTH) ||
    !isEnumValue(item.cadence, CADENCES) || !isDate(item.periodKey) ||
    !isNonNegativeSafeInteger(item.xpDelta) || !isEnumValue(item.category, AFFINITIES) ||
    !isNonNegativeSafeInteger(item.affinityDelta) || !isTimestamp(item.createdAt)) return false
  if (item.id !== `task:${item.taskId}`) return false
  return item.cadence === 'daily'
    ? item.xpDelta === 10 && (item.affinityDelta === 0 || item.affinityDelta === 1)
    : item.xpDelta === 20 && item.affinityDelta === 2
}

const isAchievement = (value: unknown): value is GrowthSnapshot['achievements'][number] => {
  const item = asExactRecord(value, ['id', 'achievementId', 'unlockedAt', 'evidenceIds', 'assetId'])
  if (!item) return false
  if (!isEnumValue(item.id, ACHIEVEMENT_IDS) || !isEnumValue(item.achievementId, ACHIEVEMENT_IDS) ||
    !isTimestamp(item.unlockedAt) || !isUniqueStringArray(item.evidenceIds, MAX_EVIDENCE_IDS) ||
    !isBoundedString(item.assetId)) return false
  return item.id === item.achievementId && ACHIEVEMENT_ASSET_BY_ID.get(item.achievementId) === item.assetId
}

const isUniqueRecordArray = <T>(
  value: unknown,
  maximumItems: number,
  validator: (item: unknown) => item is T,
  idOf: (item: T) => string
): value is T[] => {
  if (!Array.isArray(value) || value.length > maximumItems) return false
  const ids = new Set<string>()
  for (const entry of value) {
    if (!validator(entry)) return false
    const id = idOf(entry)
    if (ids.has(id)) return false
    ids.add(id)
  }
  return true
}

const validateGrowthSnapshotInternal = (value: unknown): value is GrowthSnapshot => {
  const item = asExactRecord(value, ['companion', 'missions', 'rewardLedger', 'achievements'])
  return Boolean(item &&
    isCompanion(item.companion) &&
    isUniqueRecordArray(item.missions, MAX_GROWTH_RECORDS, isMission, (mission) => mission.id) &&
    isUniqueRecordArray(item.rewardLedger, MAX_GROWTH_RECORDS, isRewardEntry, (entry) => entry.id) &&
    isUniqueRecordArray(item.achievements, ACHIEVEMENT_DEFINITIONS.length, isAchievement, (achievement) => achievement.id))
}

/** Fail-closed validator for parsed or otherwise untrusted Growth backup data. */
export const validateGrowthSnapshot = (value: unknown): value is GrowthSnapshot => {
  try {
    return validateGrowthSnapshotInternal(value)
  } catch {
    return false
  }
}

export const isValidGrowthSnapshot = validateGrowthSnapshot
