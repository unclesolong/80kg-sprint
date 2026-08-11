import type { FatLossPlan, PlanVersion, PlannerSnapshot, WeeklyReview } from '../planner/types'
import type { ChallengeSettings, DailyLog } from '../types'

export const AFFINITIES = ['awareness', 'nourishment', 'activity', 'recovery'] as const

export type GrowthAffinity = (typeof AFFINITIES)[number]
export type GrowthCadence = 'daily' | 'weekly'
export type GrowthMode = 'tracking' | 'planner'
export type GrowthMissionStatus = 'available' | 'in_progress' | 'completed' | 'superseded' | 'expired'
export type GrowthMissionSource = 'local_rule' | 'ai_suggested' | 'user_selected'
export type GrowthMissionOperator = 'complete' | 'at_least' | 'within_range' | 'count'
export type GrowthMissionSlot = 'core' | 'behavior' | 'care' | 'weekly'
export type GrowthResource = 'dew' | 'fruit' | 'wind_seed' | 'moonlight'

export type AllowedMissionMetric =
  | 'food_logged'
  | 'daily_reflection'
  | 'daily_finalized'
  | 'balanced_intake'
  | 'protein_range'
  | 'water_target'
  | 'sleep_target'
  | 'meal_action'
  | 'activity_summary'
  | 'recovery_checkin'
  | 'weekly_stable_recording'
  | 'weekly_body_observation'
  | 'weekly_aerobic'
  | 'weekly_strength'
  | 'weekly_recovery'
  | 'weekly_review'

export type FocusTaskTemplateId =
  | 'balanced_intake'
  | 'protein_range'
  | 'water_target'
  | 'sleep_target'
  | 'meal_action'
  | 'weekly_aerobic'
  | 'weekly_strength'
  | 'stable_recording'

export interface FocusTaskSpec {
  templateId: FocusTaskTemplateId
}

export interface GrowthMission {
  id: string
  ruleVersion: 1
  dateOrWeek: string
  cadence: GrowthCadence
  periodStart: string
  periodEnd: string
  mode: GrowthMode
  slot: GrowthMissionSlot
  category: GrowthAffinity
  source: GrowthMissionSource
  metric: AllowedMissionMetric
  operator: GrowthMissionOperator
  targetMin?: number
  targetMax?: number
  progress: number
  status: GrowthMissionStatus
  reward: GrowthResource
  planId?: string
  planVersionId?: string
  safetyAlternativeId?: string
  supersedesMissionId?: string
  createdAt: string
  evaluatedAt?: string
  evaluationReason?: MissionEvaluationReason
}

export type MissionEvaluationReason =
  | 'waiting_for_data'
  | 'in_progress'
  | 'completed'
  | 'outside_target'
  | 'expired'
  | 'superseded'

export interface RewardLedgerEntry {
  id: string
  taskId: string
  cadence: GrowthCadence
  periodKey: string
  xpDelta: number
  category: GrowthAffinity
  affinityDelta: number
  createdAt: string
}

export type LuminousMainForm = 'light_drop' | 'soft_cluster' | 'flow_ring' | 'star_tide'
export type GrowthNode = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12

export type AffinityTotals = Record<GrowthAffinity, number>

export interface LuminousCompanionState {
  cycleId: string
  xp: number
  mainForm: LuminousMainForm
  growthNode: GrowthNode
  affinities: AffinityTotals
  firstImprint?: GrowthAffinity
  secondImprint?: GrowthAffinity
  /** Snapshot used so Lv7 recommendations reflect the chapter after the first imprint. */
  firstImprintAffinityBaseline?: AffinityTotals
  firstImprintChosenAt?: string
  secondImprintChosenAt?: string
  birthMarkId: string
  recentAuraId?: string
  equippedAchievementAssetIds: string[]
  maturedAt?: string
}

export type AchievementId =
  | 'first_complete_day'
  | 'seven_reflections'
  | 'first_nourishment'
  | 'custom_food_created'
  | 'varied_foods'
  | 'first_activity'
  | 'weekly_activity_rhythm'
  | 'body_listened'
  | 'sleep_observer'
  | 'comeback'
  | 'first_weekly_review'
  | 'cycle_matured'

export type AchievementGroup = 'awareness' | 'nourishment' | 'activity' | 'recovery' | 'resilience'

export interface AchievementDefinition {
  id: AchievementId
  group: AchievementGroup
  assetId: string
}

export interface AchievementUnlock {
  id: AchievementId
  achievementId: AchievementId
  unlockedAt: string
  evidenceIds: string[]
  assetId: string
}

export interface GrowthSnapshot {
  companion: LuminousCompanionState
  missions: GrowthMission[]
  rewardLedger: RewardLedgerEntry[]
  achievements: AchievementUnlock[]
}

export interface GrowthDerivationInput {
  today: string
  logs: readonly DailyLog[]
  settings: ChallengeSettings
  planner: PlannerSnapshot
  now?: string
  cycleId?: string
  birthMarkId?: string
  customFoodCount?: number
  /** Tracking-only reviews have no Planner WeeklyReview row, so the UI can persist a week key here. */
  reviewedWeekKeys?: readonly string[]
}

export interface DailyMissionBuildInput {
  date: string
  guidanceMode?: ChallengeSettings['guidanceMode']
  logs: readonly DailyLog[]
  plan?: FatLossPlan
  planVersion?: PlanVersion
}

export interface WeeklyMissionBuildInput extends DailyMissionBuildInput {
  weekStart: string
  weekEnd: string
}

export interface MissionEvaluationContext {
  today: string
  logs: readonly DailyLog[]
  weeklyReviews?: readonly WeeklyReview[]
  reviewedWeekKeys?: readonly string[]
  now?: string
}

export interface GrowthSafetyState {
  activityUnsafe: boolean
  nutritionUnsafe: boolean
  recoveryPriority: boolean
  reasons: Array<'pain' | 'fatigue' | 'injury' | 'safety_status' | 'large_deficit' | 'high_hunger'>
}

export interface CompanionProgress {
  level: GrowthNode
  mainForm: LuminousMainForm
  xp: number
  currentLevelXp: number
  nextLevelXp?: number
  progressToNextLevel: number
  starTideXp: number
  starTideRings: number
  starTideRingProgress: number
  recommendedImprints: GrowthAffinity[]
  pendingImprint?: 1 | 2
}

export interface GrowthRepositorySettleInput extends GrowthDerivationInput {}
