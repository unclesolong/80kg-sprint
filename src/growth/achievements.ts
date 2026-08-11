import { growthDaysBetween } from './dates'
import { MATURITY_XP } from './progression'
import type { AchievementDefinition, AchievementId, AchievementUnlock, GrowthDerivationInput, GrowthSnapshot } from './types'

export const ACHIEVEMENT_DEFINITIONS = [
  { id: 'first_complete_day', group: 'awareness', assetId: 'achievement-first-complete-day' },
  { id: 'seven_reflections', group: 'awareness', assetId: 'achievement-seven-reflections' },
  { id: 'first_nourishment', group: 'nourishment', assetId: 'achievement-first-nourishment' },
  { id: 'custom_food_created', group: 'nourishment', assetId: 'achievement-custom-food' },
  { id: 'varied_foods', group: 'nourishment', assetId: 'achievement-varied-foods' },
  { id: 'first_activity', group: 'activity', assetId: 'achievement-first-activity' },
  { id: 'weekly_activity_rhythm', group: 'activity', assetId: 'achievement-weekly-activity' },
  { id: 'body_listened', group: 'recovery', assetId: 'achievement-body-listened' },
  { id: 'sleep_observer', group: 'recovery', assetId: 'achievement-sleep-observer' },
  { id: 'comeback', group: 'resilience', assetId: 'achievement-comeback-particles' },
  { id: 'first_weekly_review', group: 'resilience', assetId: 'achievement-second-orbit' },
  { id: 'cycle_matured', group: 'resilience', assetId: 'achievement-cycle-matured' }
] as const satisfies readonly AchievementDefinition[]

const definitionById = new Map<AchievementId, AchievementDefinition>(
  ACHIEVEMENT_DEFINITIONS.map((definition) => [definition.id, definition])
)

const bodyObservation = (input: GrowthDerivationInput): string[] => input.logs
  .filter((log) => log.dayFinalized && [log.fatigueLevel, log.hungerLevel, log.lowerLegTightness].some((value) => value != null))
  .map((log) => log.id)

const distinctFoodLabels = (input: GrowthDerivationInput): string[] => {
  const labels = new Set<string>()
  for (const log of input.logs) {
    const details = log.mealDetails
    if (!details) continue
    for (const meal of ['breakfast', 'lunch', 'dinner', 'evening'] as const) {
      for (const line of details[meal]) if (line.amount > 0) labels.add(line.label.trim().toLocaleLowerCase('zh-TW'))
    }
  }
  return [...labels].filter(Boolean)
}

const completedDailyDates = (snapshot: GrowthSnapshot): string[] => [...new Set(snapshot.missions
  .filter((mission) => mission.cadence === 'daily' && mission.status === 'completed')
  .map((mission) => mission.periodStart))].sort()

const comebackEvidence = (dates: readonly string[]): string[] => {
  for (let index = 1; index < dates.length; index += 1) {
    if (growthDaysBetween(dates[index - 1], dates[index]) >= 4) return [dates[index - 1], dates[index]]
  }
  return []
}

interface AchievementCandidate {
  id: AchievementId
  complete: boolean
  evidenceIds: string[]
}

export const evaluateAchievementUnlocks = (
  snapshot: GrowthSnapshot,
  input: GrowthDerivationInput,
  unlockedAt = input.now ?? new Date().toISOString()
): AchievementUnlock[] => {
  const completed = snapshot.missions.filter((mission) => mission.status === 'completed')
  const reflections = bodyObservation(input)
  const sleepLogs = input.logs.filter((log) => log.sleepHours != null).map((log) => log.id)
  const dailyDates = completedDailyDates(snapshot)
  const comebackDates = comebackEvidence(dailyDates)
  const foodLabels = distinctFoodLabels(input)
  const candidates: AchievementCandidate[] = [
    {
      id: 'first_complete_day',
      complete: input.logs.some((log) => log.dayFinalized) && completed.some((mission) => mission.cadence === 'daily'),
      evidenceIds: completed.filter((mission) => mission.cadence === 'daily').slice(0, 1).map((mission) => mission.id)
    },
    { id: 'seven_reflections', complete: reflections.length >= 7, evidenceIds: reflections.slice(0, 7) },
    {
      id: 'first_nourishment',
      complete: snapshot.rewardLedger.some((entry) => entry.category === 'nourishment'),
      evidenceIds: snapshot.rewardLedger.filter((entry) => entry.category === 'nourishment').slice(0, 1).map((entry) => entry.id)
    },
    { id: 'custom_food_created', complete: (input.customFoodCount ?? 0) > 0, evidenceIds: (input.customFoodCount ?? 0) > 0 ? ['custom-food'] : [] },
    { id: 'varied_foods', complete: foodLabels.length >= 10, evidenceIds: foodLabels.slice(0, 10) },
    {
      id: 'first_activity',
      complete: snapshot.rewardLedger.some((entry) => entry.category === 'activity'),
      evidenceIds: snapshot.rewardLedger.filter((entry) => entry.category === 'activity').slice(0, 1).map((entry) => entry.id)
    },
    {
      id: 'weekly_activity_rhythm',
      complete: completed.some((mission) => mission.cadence === 'weekly' && ['weekly_aerobic', 'weekly_strength'].includes(mission.metric)),
      evidenceIds: completed.filter((mission) => mission.cadence === 'weekly' && ['weekly_aerobic', 'weekly_strength'].includes(mission.metric)).slice(0, 1).map((mission) => mission.id)
    },
    {
      id: 'body_listened',
      complete: completed.some((mission) => mission.metric === 'recovery_checkin' && mission.supersedesMissionId != null),
      evidenceIds: completed.filter((mission) => mission.metric === 'recovery_checkin' && mission.supersedesMissionId != null).slice(0, 1).map((mission) => mission.id)
    },
    { id: 'sleep_observer', complete: sleepLogs.length >= 7, evidenceIds: sleepLogs.slice(0, 7) },
    { id: 'comeback', complete: comebackDates.length === 2, evidenceIds: comebackDates },
    {
      id: 'first_weekly_review',
      complete: completed.some((mission) => mission.metric === 'weekly_review'),
      evidenceIds: completed.filter((mission) => mission.metric === 'weekly_review').slice(0, 1).map((mission) => mission.id)
    },
    { id: 'cycle_matured', complete: snapshot.companion.xp >= MATURITY_XP, evidenceIds: snapshot.companion.xp >= MATURITY_XP ? [snapshot.companion.cycleId] : [] }
  ]

  const existing = new Set(snapshot.achievements.map((unlock) => unlock.achievementId))
  return candidates.flatMap((candidate) => {
    if (!candidate.complete || existing.has(candidate.id)) return []
    const definition = definitionById.get(candidate.id)
    if (!definition) return []
    return [{
      id: candidate.id,
      achievementId: candidate.id,
      unlockedAt,
      evidenceIds: candidate.evidenceIds,
      assetId: definition.assetId
    } satisfies AchievementUnlock]
  })
}

export const isAchievementId = (value: string): value is AchievementId => definitionById.has(value as AchievementId)
