import type {
  GrowthAchievementView,
  GrowthAffinity,
  GrowthCompanionView,
  GrowthHabitatView,
  GrowthImprintChoiceView,
  GrowthMissionStatus as GrowthMissionViewStatus,
  GrowthMissionView,
  GrowthXpBreakdownView,
  GrowthXpEntryView,
  GrowthXpSummaryView
} from '../components/growth'
import { DAILY_MISSION_XP, WEEKLY_MISSION_XP } from '../growth/engine'
import { selectCompanionProgress } from '../growth/progression'
import type {
  AchievementGroup,
  AchievementId,
  AllowedMissionMetric,
  GrowthMission,
  GrowthSnapshot
} from '../growth/types'
import { addGrowthDays } from '../growth/dates'
import type { PlannerSnapshot } from '../planner/types'
import type { DailyLog } from '../types'

export interface GrowthSyncResult<TSnapshot> {
  snapshot: TSnapshot
  error?: string
}

export interface GrowthPageViewModel {
  companion: GrowthCompanionView
  missions: GrowthMissionView[]
  xpBreakdown: GrowthXpBreakdownView
  imprintChoice?: GrowthImprintChoiceView
  achievements: GrowthAchievementView[]
  habitat: GrowthHabitatView
}

export interface GrowthSettlementDateInput {
  today: string
  logs: readonly DailyLog[]
  planner: PlannerSnapshot
  snapshot: GrowthSnapshot
  modifiedDate?: string
}

interface AchievementCopy {
  title: string
  description: string
  category: AchievementGroup
}

const GROWTH_SYNC_ERROR = '潤光進度暫時無法同步；健康紀錄仍可照常使用。'
export const GROWTH_BACKFILL_LOOKBACK_DAYS = 14

const missionCopy: Readonly<Record<AllowedMissionMetric, { title: string; description: string; actionLabel: string }>> = {
  food_logged: { title: '完成今日飲食紀錄', description: '留下今天實際吃下的內容即可。', actionLabel: '去記錄' },
  daily_reflection: { title: '記下今日身體感受', description: '記錄飢餓、疲勞與不適，讓下一步更適合你。', actionLabel: '去回顧' },
  daily_finalized: { title: '完成今日結算', description: '確認今天的紀錄已經完整。', actionLabel: '去結算' },
  balanced_intake: { title: '維持安全攝取範圍', description: '落在目前計畫範圍即可，不是吃得越少越好。', actionLabel: '看飲食' },
  protein_range: { title: '完成蛋白質節奏', description: '依目前計畫的安全範圍完成今日安排。', actionLabel: '看飲食' },
  water_target: { title: '完成今日飲水節奏', description: '依照今天的飲水目標逐步補充。', actionLabel: '記飲水' },
  sleep_target: { title: '完成睡眠照顧', description: '睡眠與休息和活動任務具有相同培育價值。', actionLabel: '記睡眠' },
  meal_action: { title: '完成一項餐點行動', description: '完成目前計畫安排的餐點行動。', actionLabel: '看飲食' },
  activity_summary: { title: '完成活動摘要', description: '記下已完成的活動；超過目標不會重複加分。', actionLabel: '記活動' },
  recovery_checkin: { title: '聽見今天的身體', description: '疲勞或不適時，恢復任務可等值取代活動。', actionLabel: '去回顧' },
  weekly_stable_recording: { title: '整理本週生活紀錄', description: '不需要連續全勤，留下足夠資料即可。', actionLabel: '看紀錄' },
  weekly_body_observation: { title: '完成本週身體觀察', description: '回顧身體感受，不以體重下降判定成功。', actionLabel: '看回顧' },
  weekly_aerobic: { title: '完成本週有氧節奏', description: '達到計畫範圍即可，超額不會增加獎勵。', actionLabel: '看活動' },
  weekly_strength: { title: '完成本週肌力節奏', description: '依照目前計畫完成安排的肌力天數。', actionLabel: '看活動' },
  weekly_recovery: { title: '完成本週恢復節奏', description: '休息與照顧不適也是正式任務。', actionLabel: '看回顧' },
  weekly_review: { title: '完成每週回顧', description: '整理這週的節奏並決定下一步。', actionLabel: '去回顧' }
}

const achievementCopy: Readonly<Record<AchievementId, AchievementCopy>> = {
  first_complete_day: { title: '第一道完整微光', description: '完成第一次完整日結。', category: 'awareness' },
  seven_reflections: { title: '七次聽見自己', description: '累積七次身體感受紀錄。', category: 'awareness' },
  first_nourishment: { title: '第一顆養分果實', description: '完成第一項安全滋養任務。', category: 'nourishment' },
  custom_food_created: { title: '自己的食物筆記', description: '建立第一筆自訂食物。', category: 'nourishment' },
  varied_foods: { title: '多彩滋養', description: '留下多樣化的飲食紀錄。', category: 'nourishment' },
  first_activity: { title: '第一道流風', description: '完成第一項計畫活動任務。', category: 'activity' },
  weekly_activity_rhythm: { title: '一週活力節奏', description: '完成一週安全活動安排。', category: 'activity' },
  body_listened: { title: '聽見身體', description: '需要時完成等值恢復替代。', category: 'recovery' },
  sleep_observer: { title: '月幕觀察者', description: '穩定留下睡眠與恢復紀錄。', category: 'recovery' },
  comeback: { title: '回來就好', description: '中斷後再次回來照顧自己。', category: 'resilience' },
  first_weekly_review: { title: '第一圈週光', description: '完成第一次每週回顧。', category: 'resilience' },
  cycle_matured: { title: '完全共鳴', description: '陪伴潤光抵達第十二成長節點。', category: 'resilience' }
}

const achievementOrder = Object.keys(achievementCopy) as AchievementId[]
const visibleTodayMissionStatuses = new Set<GrowthMission['status']>(['available', 'in_progress', 'completed'])
const dailySlotOrder: Readonly<Record<GrowthMission['slot'], number>> = { core: 0, behavior: 1, care: 2, weekly: 3 }

const habitatNames = {
  light_drop: '泉眼棲境',
  soft_cluster: '淺灣棲境',
  flow_ring: '流環潟湖',
  star_tide: '星潮棲境'
} as const

const unitForMetric = (metric: AllowedMissionMetric): string => {
  if (metric === 'balanced_intake') return ' kcal'
  if (metric === 'protein_range') return ' g'
  if (metric === 'water_target') return ' ml'
  if (metric === 'sleep_target') return ' 小時'
  if (metric === 'activity_summary' || metric === 'weekly_aerobic') return ' 分鐘'
  return ''
}

const viewStatusForMission = (mission: GrowthMission): GrowthMissionViewStatus => {
  if (mission.evaluationReason === 'waiting_for_data') return 'waiting_record'
  return mission.status
}

const targetForMission = (mission: GrowthMission): number => {
  if (mission.operator === 'within_range') return mission.targetMax ?? mission.targetMin ?? 1
  return mission.targetMin ?? mission.targetMax ?? 1
}

const progressLabelForMission = (mission: GrowthMission): string => {
  const unit = unitForMetric(mission.metric)
  if (mission.operator === 'within_range' && mission.targetMin != null && mission.targetMax != null) {
    return `${mission.progress.toLocaleString('zh-TW')}${unit}／${mission.targetMin.toLocaleString('zh-TW')}–${mission.targetMax.toLocaleString('zh-TW')}${unit}`
  }
  return `${mission.progress.toLocaleString('zh-TW')}／${targetForMission(mission).toLocaleString('zh-TW')}${unit}`
}

const emptyXpSummary = (): GrowthXpSummaryView => ({ count: 0, xp: 0 })

/**
 * Explains the currently displayed XP from persisted reward rows. The earned
 * periodKey is the only date classification used here: creditedAt may be much
 * later after an ordinary replay and is not treated as provenance.
 */
export const buildGrowthXpBreakdown = (
  snapshot: GrowthSnapshot,
  today: string
): GrowthXpBreakdownView => {
  const missionsById = new Map(snapshot.missions.map((mission) => [mission.id, mission]))
  const daily = emptyXpSummary()
  const weekly = emptyXpSummary()
  const byCategory: GrowthXpBreakdownView['byCategory'] = {
    awareness: emptyXpSummary(),
    nourishment: emptyXpSummary(),
    activity: emptyXpSummary(),
    recovery: emptyXpSummary()
  }
  let attributedXp = 0
  let todayPeriodXp = 0

  const entries = snapshot.rewardLedger.map<GrowthXpEntryView>((reward) => {
    const mission = missionsById.get(reward.taskId)
    const cadenceSummary = reward.cadence === 'daily' ? daily : weekly
    cadenceSummary.count += 1
    cadenceSummary.xp += reward.xpDelta
    byCategory[reward.category].count += 1
    byCategory[reward.category].xp += reward.xpDelta
    attributedXp += reward.xpDelta
    if (reward.periodKey === today) todayPeriodXp += reward.xpDelta

    return {
      id: reward.id,
      taskId: reward.taskId,
      cadence: reward.cadence,
      periodKey: reward.periodKey,
      xp: reward.xpDelta,
      category: reward.category,
      affinityDelta: reward.affinityDelta,
      creditedAt: reward.createdAt,
      title: mission
        ? missionCopy[mission.metric].title
        : reward.cadence === 'daily' ? '每日培育任務' : '每週培育任務',
      ...(mission ? { metric: mission.metric, missionStatus: mission.status } : {}),
      attribution: mission ? 'mission' : 'orphan'
    }
  }).sort((left, right) =>
    right.periodKey.localeCompare(left.periodKey) ||
    right.creditedAt.localeCompare(left.creditedAt) ||
    left.id.localeCompare(right.id))

  const displayedXp = snapshot.companion.xp
  const residualXp = displayedXp - attributedXp
  const integrity = residualXp === 0 ? 'exact' : residualXp > 0 ? 'residual' : 'over_attributed'
  return {
    displayedXp,
    attributedXp,
    residualXp,
    integrity,
    daily,
    weekly,
    todayPeriodXp,
    byCategory,
    entries
  }
}

/**
 * Chooses a bounded set of evidence-bearing dates to replay before today.
 * Today is always last so historical settlement can never become the visible
 * page snapshot. Blank historical days are deliberately not materialized.
 */
export const selectGrowthSettlementDates = ({
  today,
  logs,
  planner,
  snapshot,
  modifiedDate
}: GrowthSettlementDateInput): string[] => {
  const firstAllowedDate = addGrowthDays(today, -(GROWTH_BACKFILL_LOOKBACK_DAYS - 1))
  const inWindow = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= firstAllowedDate && date <= today
  const logsByDate = new Map(logs.filter((log) => inWindow(log.date)).map((log) => [log.date, log]))
  const dailyMissions = new Map<string, GrowthMission[]>()
  for (const mission of snapshot.missions) {
    if (mission.cadence !== 'daily' || !inWindow(mission.periodStart)) continue
    const current = dailyMissions.get(mission.periodStart) ?? []
    current.push(mission)
    dailyMissions.set(mission.periodStart, current)
  }

  const dates = new Set<string>()
  for (const [date, log] of logsByDate) {
    const missions = dailyMissions.get(date)
    const latestEvaluation = missions
      ?.map((mission) => mission.evaluatedAt)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1)
    const evidenceChangedAfterSettlement = Boolean(latestEvaluation && log.updatedAt > latestEvaluation)
    const needsSettlement = !missions?.length || evidenceChangedAfterSettlement || missions.some((mission) =>
      mission.status === 'available' || mission.status === 'in_progress' || mission.status === 'expired')
    if (needsSettlement || date === modifiedDate) dates.add(date)
  }

  if (modifiedDate && logsByDate.has(modifiedDate)) dates.add(modifiedDate)

  for (const review of planner.weeklyReviews) {
    if (review.status === 'draft') continue
    const evidenceDate = review.weekEnd > today ? today : review.weekEnd
    if (inWindow(evidenceDate)) dates.add(evidenceDate)
  }

  dates.add(today)
  return [...dates].sort((left, right) => left.localeCompare(right))
}

const normalizeBaseUrl = (baseUrl: string): string => `${baseUrl || '/'}${baseUrl?.endsWith('/') ? '' : '/'}`

export const resolveGrowthArtworkUrl = (
  node: number,
  baseUrl = import.meta.env.BASE_URL
): string => `${normalizeBaseUrl(baseUrl)}art/growth/luminous-stage-${String(node).padStart(2, '0')}.webp`

export const resolveGrowthAchievementArtworkUrl = (
  id: AchievementId,
  baseUrl = import.meta.env.BASE_URL
): string => `${normalizeBaseUrl(baseUrl)}art/growth/achievements/${id}.webp`

export const resolveGrowthHabitatArtworkUrl = (
  baseUrl = import.meta.env.BASE_URL
): string => `${normalizeBaseUrl(baseUrl)}art/growth/luminous-habitat-star-tide.webp`

export const buildGrowthPageView = (
  snapshot: GrowthSnapshot,
  today: string,
  selectedImprint?: GrowthAffinity
): GrowthPageViewModel => {
  const companionState = snapshot.companion
  const progress = selectCompanionProgress(companionState)
  const rewardedTaskIds = new Set(snapshot.rewardLedger.map((entry) => entry.taskId))
  const unlockedById = new Map(snapshot.achievements.map((achievement) => [achievement.achievementId, achievement]))
  const equippedAssets = new Set(companionState.equippedAchievementAssetIds)
  const companion: GrowthCompanionView = {
    displayName: '潤光',
    xp: companionState.xp,
    growthNode: companionState.growthNode,
    affinities: { ...companionState.affinities },
    firstImprint: companionState.firstImprint,
    secondImprint: companionState.secondImprint,
    artworkUrl: resolveGrowthArtworkUrl(companionState.growthNode),
    artworkLabel: `潤光 Lv${companionState.growthNode}`
  }

  const missions = snapshot.missions
    .filter((mission) => mission.cadence === 'daily' && mission.dateOrWeek === today && visibleTodayMissionStatuses.has(mission.status))
    .sort((left, right) => dailySlotOrder[left.slot] - dailySlotOrder[right.slot] || left.id.localeCompare(right.id))
    .slice(0, 3)
    .map<GrowthMissionView>((mission) => ({
      id: mission.id,
      ...missionCopy[mission.metric],
      category: mission.category,
      progress: mission.progress,
      target: targetForMission(mission),
      progressLabel: progressLabelForMission(mission),
      status: viewStatusForMission(mission),
      xpReward: mission.cadence === 'daily' ? DAILY_MISSION_XP : WEEKLY_MISSION_XP,
      rewarded: rewardedTaskIds.has(mission.id)
    }))

  const xpBreakdown = buildGrowthXpBreakdown(snapshot, today)

  const achievements = achievementOrder.map<GrowthAchievementView>((id) => {
    const unlock = unlockedById.get(id)
    const copy = achievementCopy[id]
    return {
      id,
      ...copy,
      status: unlock ? (equippedAssets.has(unlock.assetId) ? 'equipped' : 'earned') : 'locked',
      artworkUrl: resolveGrowthAchievementArtworkUrl(id)
    }
  })

  const imprintNames = [companionState.firstImprint, companionState.secondImprint]
    .filter((affinity): affinity is GrowthAffinity => Boolean(affinity))
    .map((affinity) => ({ awareness: '星絡', nourishment: '珊芽', activity: '疾潮', recovery: '月幕' })[affinity])
  const residents = companionState.growthNode === 12
    ? [{
        id: companionState.cycleId,
        name: '星潮・完全共鳴',
        description: imprintNames.length > 0 ? `${imprintNames.join(' × ')}歷程的成熟潤光。` : '已完成一個培育週期的成熟潤光。',
        status: 'resident' as const,
        artworkUrl: resolveGrowthArtworkUrl(12)
      }]
    : []
  const habitat: GrowthHabitatView = {
    name: habitatNames[companionState.mainForm],
    description: '任務完成後，棲境會留下收藏物與來訪居民；暫停使用不會讓它倒退。',
    artworkLayers: [{ id: 'star-tide-habitat', slot: 'habitat', url: resolveGrowthHabitatArtworkUrl() }],
    residents,
    collection: achievements.map((achievement) => ({
      id: `collection-${achievement.id}`,
      name: achievement.title,
      description: achievement.description,
      unlocked: achievement.status !== 'locked',
      artworkUrl: achievement.artworkUrl
    }))
  }

  const imprintChoice = progress.pendingImprint
    ? {
        milestone: (progress.pendingImprint === 1 ? 4 : 7) as 4 | 7,
        recommendations: progress.recommendedImprints.map((affinity) => ({
          affinity,
          score: companionState.affinities[affinity]
        })),
        ...(selectedImprint && progress.recommendedImprints.includes(selectedImprint) ? { selected: selectedImprint } : {})
      }
    : undefined

  return { companion, missions, xpBreakdown, ...(imprintChoice ? { imprintChoice } : {}), achievements, habitat }
}

/**
 * Keeps the last readable companion state when the optional Growth database or
 * rules fail. Core health writes must never depend on this promise succeeding.
 */
export async function runGrowthSync<TSnapshot>(
  currentSnapshot: TSnapshot,
  operation: () => Promise<TSnapshot>
): Promise<GrowthSyncResult<TSnapshot>> {
  try {
    return { snapshot: await operation() }
  } catch {
    return { snapshot: currentSnapshot, error: GROWTH_SYNC_ERROR }
  }
}
