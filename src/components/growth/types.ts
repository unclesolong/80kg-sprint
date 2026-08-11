export type GrowthAffinity = 'awareness' | 'nourishment' | 'activity' | 'recovery'

export type GrowthNode = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12

export type GrowthMainForm = 'light_drop' | 'soft_cluster' | 'flow_ring' | 'star_tide'

export type GrowthArtworkSlot =
  | 'habitat'
  | 'rear-fin'
  | 'body'
  | 'core'
  | 'front-fin'
  | 'orbit'
  | 'aura'

export interface GrowthArtworkLayer {
  id: string
  url: string
  slot: GrowthArtworkSlot
  loading?: 'eager' | 'lazy'
}
export interface GrowthNodeDefinition {
  node: GrowthNode
  name: string
  shortName: string
  minimumXp: number
  mainForm: GrowthMainForm
}

export const GROWTH_NODE_DEFINITIONS: readonly GrowthNodeDefinition[] = [
  { node: 1, name: '光滴・初醒', shortName: '初醒', minimumXp: 0, mainForm: 'light_drop' },
  { node: 2, name: '光滴・凝核', shortName: '凝核', minimumXp: 60, mainForm: 'light_drop' },
  { node: 3, name: '光滴・浮珠', shortName: '浮珠', minimumXp: 160, mainForm: 'light_drop' },
  { node: 4, name: '潤團・萌翼', shortName: '萌翼', minimumXp: 300, mainForm: 'soft_cluster' },
  { node: 5, name: '潤團・生環', shortName: '生環', minimumXp: 460, mainForm: 'soft_cluster' },
  { node: 6, name: '潤團・顯紋', shortName: '顯紋', minimumXp: 640, mainForm: 'soft_cluster' },
  { node: 7, name: '流環・展尾', shortName: '展尾', minimumXp: 840, mainForm: 'flow_ring' },
  { node: 8, name: '流環・織星', shortName: '織星', minimumXp: 1_060, mainForm: 'flow_ring' },
  { node: 9, name: '流環・雙鳴', shortName: '雙鳴', minimumXp: 1_300, mainForm: 'flow_ring' },
  { node: 10, name: '星潮・化潮', shortName: '化潮', minimumXp: 1_560, mainForm: 'star_tide' },
  { node: 11, name: '星潮・棲境', shortName: '棲境', minimumXp: 1_840, mainForm: 'star_tide' },
  { node: 12, name: '星潮・完全共鳴', shortName: '完全共鳴', minimumXp: 2_140, mainForm: 'star_tide' }
]

export const GROWTH_AFFINITIES: readonly GrowthAffinity[] = [
  'awareness',
  'nourishment',
  'activity',
  'recovery'
]

export interface GrowthAffinityDefinition {
  label: string
  imprintName: string
  resourceName: string
  description: string
}

export const GROWTH_AFFINITY_DEFINITIONS: Readonly<Record<GrowthAffinity, GrowthAffinityDefinition>> = {
  awareness: {
    label: '覺察',
    imprintName: '星絡',
    resourceName: '露水',
    description: '來自晨晚紀錄、日結與每週回顧'
  },
  nourishment: {
    label: '滋養',
    imprintName: '珊芽',
    resourceName: '養分果實',
    description: '來自安全攝取、蛋白質與飲水任務'
  },
  activity: {
    label: '活力',
    imprintName: '疾潮',
    resourceName: '風之種',
    description: '來自計畫活動、每週有氧與肌力任務'
  },
  recovery: {
    label: '恢復',
    imprintName: '月幕',
    resourceName: '月光',
    description: '來自睡眠、疲勞照顧與恢復替代任務'
  }
}

export interface GrowthCompanionView {
  displayName?: string
  xp: number
  growthNode: GrowthNode
  affinities: Record<GrowthAffinity, number>
  firstImprint?: GrowthAffinity
  secondImprint?: GrowthAffinity
  recentAuraLabel?: string
  artworkUrl?: string
  artworkLayers?: readonly GrowthArtworkLayer[]
  artworkLabel?: string
}

export type GrowthMissionStatus =
  | 'available'
  | 'in_progress'
  | 'waiting_record'
  | 'completed'
  | 'superseded'
  | 'expired'

export interface GrowthMissionView {
  id: string
  title: string
  description?: string
  category: GrowthAffinity
  progress: number
  target: number
  progressLabel?: string
  status: GrowthMissionStatus
  xpReward: number
  actionLabel?: string
}

export interface GrowthAffinityRecommendation {
  affinity: GrowthAffinity
  score: number
  reason?: string
}

export interface GrowthImprintChoiceView {
  milestone: 4 | 7
  recommendations: readonly GrowthAffinityRecommendation[]
  selected?: GrowthAffinity
  confirmed?: GrowthAffinity
}

export type GrowthAchievementStatus = 'locked' | 'earned' | 'equipped'

export interface GrowthAchievementView {
  id: string
  title: string
  description: string
  category: GrowthAffinity | 'resilience'
  status: GrowthAchievementStatus
  artworkUrl?: string
  unlockedLabel?: string
}

export type GrowthResidentStatus = 'resident' | 'visiting' | 'undiscovered'

export interface GrowthResidentView {
  id: string
  name: string
  description: string
  status: GrowthResidentStatus
  artworkUrl?: string
}

export interface GrowthCollectionEntryView {
  id: string
  name: string
  description: string
  unlocked: boolean
  artworkUrl?: string
}

export interface GrowthHabitatView {
  name: string
  description: string
  artworkLayers?: readonly GrowthArtworkLayer[]
  residents: readonly GrowthResidentView[]
  collection: readonly GrowthCollectionEntryView[]
}
