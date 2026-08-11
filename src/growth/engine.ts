import { selectActivePlan, selectPlanVersionForDate } from '../planner/planSelectors'
import { evaluateAchievementUnlocks } from './achievements'
import { growthWeekBounds } from './dates'
import { buildDailyMissions, buildWeeklyMissions, evaluateMission } from './missions'
import {
  MATURITY_XP,
  createInitialCompanion,
  mainFormForNode,
  normalizeCompanionProgress,
  selectGrowthNode
} from './progression'
import {
  type GrowthDerivationInput,
  type GrowthMission,
  type GrowthSnapshot,
  type LuminousCompanionState,
  type RewardLedgerEntry
} from './types'

export const DAILY_MISSION_XP = 10
export const WEEKLY_MISSION_XP = 20
export const MAX_DAILY_REWARDS = 3
export const MAX_WEEKLY_REWARDS = 3

export const emptyGrowthSnapshot = (cycleId = 'luminous-current', birthMarkId?: string): GrowthSnapshot => ({
  companion: createInitialCompanion(cycleId, birthMarkId),
  missions: [],
  rewardLedger: [],
  achievements: []
})

export const deriveGrowthMissions = (input: GrowthDerivationInput): GrowthMission[] => {
  const plan = selectActivePlan(input.planner)
  const planVersion = plan ? selectPlanVersionForDate(input.planner.planVersions, plan.id, input.today) : undefined
  const shared = {
    date: input.today,
    guidanceMode: input.settings.guidanceMode,
    logs: input.logs,
    plan,
    planVersion
  }
  const { weekStart, weekEnd } = growthWeekBounds(input.today)
  return [
    ...buildDailyMissions(shared),
    ...buildWeeklyMissions({ ...shared, weekStart, weekEnd })
  ]
}

const expirePastMissions = (missions: readonly GrowthMission[], today: string, now: string): GrowthMission[] => missions.map((mission) =>
  mission.status !== 'completed' && mission.status !== 'superseded' && mission.periodEnd < today
    ? { ...mission, status: 'expired', evaluationReason: 'expired', evaluatedAt: now }
    : mission
)

const missionScopeKey = (mission: Pick<GrowthMission, 'cadence' | 'periodStart' | 'periodEnd'>): string =>
  `${mission.cadence}:${mission.periodStart}:${mission.periodEnd}`

interface MissionMergeResult {
  missions: GrowthMission[]
  /** Only rewards in scopes evaluated by this settlement may be reconciled. */
  reconciledMissionIds: Set<string>
}

const mergeMissions = (
  existingMissions: readonly GrowthMission[],
  incomingMissions: readonly GrowthMission[],
  today: string,
  now: string
): MissionMergeResult => {
  const merged = new Map(expirePastMissions(existingMissions, today, now).map((mission) => [mission.id, mission]))
  const incomingIds = new Set(incomingMissions.map((mission) => mission.id))
  const activeScopes = new Set(incomingMissions.map(missionScopeKey))
  const reconciledMissionIds = new Set<string>()

  // The generated task set is authoritative only for the periods being
  // evaluated now. Historical periods remain untouched so a missed day never
  // claws back a previously earned reward.
  for (const existing of merged.values()) {
    if (!activeScopes.has(missionScopeKey(existing))) continue
    reconciledMissionIds.add(existing.id)
    if (incomingIds.has(existing.id) || existing.status === 'superseded' || existing.status === 'expired') continue
    merged.set(existing.id, {
      ...existing,
      status: 'superseded',
      evaluationReason: 'superseded',
      evaluatedAt: now
    })
  }

  for (const incoming of incomingMissions) {
    reconciledMissionIds.add(incoming.id)
    if (incoming.supersedesMissionId) {
      const original = merged.get(incoming.supersedesMissionId)
      if (original) merged.set(original.id, {
          ...original,
          status: 'superseded',
          safetyAlternativeId: incoming.id,
          evaluationReason: 'superseded',
          evaluatedAt: now
        })
    }

    // Incoming missions are freshly evaluated from the current persisted
    // evidence. This intentionally allows completed tasks to return to
    // in-progress when the user corrects today's data.
    merged.set(incoming.id, incoming)
  }
  return {
    missions: [...merged.values()].sort((left, right) => left.periodStart.localeCompare(right.periodStart) || left.id.localeCompare(right.id)),
    reconciledMissionIds
  }
}

const reconcileRewardLedger = (
  missions: readonly GrowthMission[],
  ledger: readonly RewardLedgerEntry[],
  reconciledMissionIds: ReadonlySet<string>
): { retained: RewardLedgerEntry[]; revoked: RewardLedgerEntry[] } => {
  const missionById = new Map(missions.map((mission) => [mission.id, mission]))
  const retained: RewardLedgerEntry[] = []
  const revoked: RewardLedgerEntry[] = []
  for (const entry of ledger) {
    const current = missionById.get(entry.taskId)
    if (reconciledMissionIds.has(entry.taskId) && current?.status !== 'completed') revoked.push(entry)
    else retained.push(entry)
  }
  return { retained, revoked }
}

const newRewardEntries = (
  missions: readonly GrowthMission[],
  ledger: readonly RewardLedgerEntry[],
  now: string
): RewardLedgerEntry[] => {
  const rewarded = new Set(ledger.map((entry) => entry.id))
  const periodCounts = new Map<string, number>()
  const dailyAffinity = new Set<string>()
  for (const entry of ledger) {
    const key = `${entry.cadence}:${entry.periodKey}`
    periodCounts.set(key, (periodCounts.get(key) ?? 0) + 1)
    if (entry.cadence === 'daily' && entry.affinityDelta > 0) dailyAffinity.add(`${entry.periodKey}:${entry.category}`)
  }

  const additions: RewardLedgerEntry[] = []
  const completed = missions.filter((mission) => mission.status === 'completed').sort((left, right) => left.id.localeCompare(right.id))
  for (const mission of completed) {
    const id = `task:${mission.id}`
    if (rewarded.has(id)) continue
    const periodKey = mission.periodStart
    const countKey = `${mission.cadence}:${periodKey}`
    const maximum = mission.cadence === 'daily' ? MAX_DAILY_REWARDS : MAX_WEEKLY_REWARDS
    if ((periodCounts.get(countKey) ?? 0) >= maximum) continue
    const affinityKey = `${periodKey}:${mission.category}`
    const affinityDelta = mission.cadence === 'daily'
      ? dailyAffinity.has(affinityKey) ? 0 : 1
      : 2
    const entry: RewardLedgerEntry = {
      id,
      taskId: mission.id,
      cadence: mission.cadence,
      periodKey,
      xpDelta: mission.cadence === 'daily' ? DAILY_MISSION_XP : WEEKLY_MISSION_XP,
      category: mission.category,
      affinityDelta,
      createdAt: now
    }
    additions.push(entry)
    rewarded.add(id)
    periodCounts.set(countKey, (periodCounts.get(countKey) ?? 0) + 1)
    if (mission.cadence === 'daily' && affinityDelta > 0) dailyAffinity.add(affinityKey)
  }
  return additions
}

const normalizeDailyAffinityRewards = (
  ledger: readonly RewardLedgerEntry[],
  missions: readonly GrowthMission[],
  reconciledMissionIds: ReadonlySet<string>
): RewardLedgerEntry[] => {
  const reconciledDailyPeriods = new Set(missions
    .filter((mission) => reconciledMissionIds.has(mission.id) && mission.cadence === 'daily')
    .map((mission) => mission.periodStart))
  const groups = new Map<string, RewardLedgerEntry[]>()
  for (const entry of ledger) {
    if (entry.cadence !== 'daily' || !reconciledDailyPeriods.has(entry.periodKey)) continue
    const key = `${entry.periodKey}:${entry.category}`
    const entries = groups.get(key) ?? []
    entries.push(entry)
    groups.set(key, entries)
  }

  const desiredAffinity = new Map<string, number>()
  for (const entries of groups.values()) {
    entries.sort((left, right) => left.id.localeCompare(right.id))
    entries.forEach((entry, index) => desiredAffinity.set(entry.id, index === 0 ? 1 : 0))
  }
  return ledger.map((entry) => {
    const affinityDelta = desiredAffinity.get(entry.id)
    return affinityDelta == null || affinityDelta === entry.affinityDelta ? entry : { ...entry, affinityDelta }
  })
}

const rewardTotals = (entries: readonly RewardLedgerEntry[]) => {
  const affinities: LuminousCompanionState['affinities'] = { awareness: 0, nourishment: 0, activity: 0, recovery: 0 }
  let xp = 0
  for (const entry of entries) {
    xp += Math.max(0, entry.xpDelta)
    affinities[entry.category] += Math.max(0, entry.affinityDelta)
  }
  return { xp, affinities }
}

const applyRewardLedgerDiff = (
  companion: LuminousCompanionState,
  previousLedger: readonly RewardLedgerEntry[],
  nextLedger: readonly RewardLedgerEntry[],
  now: string
): LuminousCompanionState => {
  const previous = rewardTotals(previousLedger)
  const next = rewardTotals(nextLedger)
  const xpDelta = next.xp - previous.xp
  const affinityDeltas = {
    awareness: next.affinities.awareness - previous.affinities.awareness,
    nourishment: next.affinities.nourishment - previous.affinities.nourishment,
    activity: next.affinities.activity - previous.affinities.activity,
    recovery: next.affinities.recovery - previous.affinities.recovery
  }
  if (xpDelta === 0 && Object.values(affinityDeltas).every((delta) => delta === 0)) return companion

  const affinities = { ...companion.affinities }
  const xp = Math.max(0, companion.xp + xpDelta)
  affinities.awareness = Math.max(0, affinities.awareness + affinityDeltas.awareness)
  affinities.nourishment = Math.max(0, affinities.nourishment + affinityDeltas.nourishment)
  affinities.activity = Math.max(0, affinities.activity + affinityDeltas.activity)
  affinities.recovery = Math.max(0, affinities.recovery + affinityDeltas.recovery)

  const updated = { ...companion, xp, affinities }
  if (xpDelta >= 0) return normalizeCompanionProgress(updated, now)

  // Reward reversal is the one intentional exception to monotonic visual
  // progression. Recompute persisted level/form so level thresholds and
  // post-maturity star-tide rings match the corrected XP exactly.
  const growthNode = selectGrowthNode(xp)
  const { maturedAt, ...withoutMaturity } = updated
  return {
    ...withoutMaturity,
    growthNode,
    mainForm: mainFormForNode(growthNode),
    ...(xp >= MATURITY_XP ? { maturedAt: maturedAt ?? now } : {})
  }
}

export const settleGrowthSnapshot = (
  snapshot: GrowthSnapshot,
  input: GrowthDerivationInput,
  options: { preserveExistingRewards?: boolean } = {}
): GrowthSnapshot => {
  const now = input.now ?? new Date().toISOString()
  const generated = deriveGrowthMissions(input).map((mission) => evaluateMission(mission, {
    today: input.today,
    logs: input.logs,
    weeklyReviews: input.planner.weeklyReviews,
    reviewedWeekKeys: input.reviewedWeekKeys,
    now
  }))
  const { missions, reconciledMissionIds } = mergeMissions(snapshot.missions, generated, input.today, now)
  const { retained } = options.preserveExistingRewards
    ? { retained: [...snapshot.rewardLedger] }
    : reconcileRewardLedger(missions, snapshot.rewardLedger, reconciledMissionIds)
  const additions = newRewardEntries(missions, retained, now)
  const combinedLedger = [...retained, ...additions]
  const rewardLedger = options.preserveExistingRewards
    ? combinedLedger
    : normalizeDailyAffinityRewards(combinedLedger, missions, reconciledMissionIds)
  const companion = applyRewardLedgerDiff(snapshot.companion, snapshot.rewardLedger, rewardLedger, now)
  const intermediate: GrowthSnapshot = { ...snapshot, companion, missions, rewardLedger }
  const achievementAdditions = evaluateAchievementUnlocks(intermediate, input, now)
  return {
    ...intermediate,
    achievements: [...snapshot.achievements, ...achievementAdditions]
  }
}
