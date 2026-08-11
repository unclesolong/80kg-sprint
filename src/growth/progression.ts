import { AFFINITIES, type AffinityTotals, type CompanionProgress, type GrowthAffinity, type GrowthNode, type LuminousCompanionState, type LuminousMainForm } from './types'

export const GROWTH_LEVEL_XP = [0, 60, 160, 300, 460, 640, 840, 1_060, 1_300, 1_560, 1_840, 2_140] as const
export const MATURITY_XP = GROWTH_LEVEL_XP[11]
/** Post-maturity XP is commemorative only; one ring deliberately matches the final 300 XP step. */
export const STAR_TIDE_RING_XP = 300

export const emptyAffinities = (): AffinityTotals => ({ awareness: 0, nourishment: 0, activity: 0, recovery: 0 })

export const selectGrowthNode = (xp: number): GrowthNode => {
  const safeXp = Math.max(0, Number.isFinite(xp) ? xp : 0)
  let level = 1
  for (let index = 1; index < GROWTH_LEVEL_XP.length; index += 1) {
    if (safeXp < GROWTH_LEVEL_XP[index]) break
    level = index + 1
  }
  return level as GrowthNode
}

export const mainFormForNode = (node: GrowthNode): LuminousMainForm => {
  if (node >= 10) return 'star_tide'
  if (node >= 7) return 'flow_ring'
  if (node >= 4) return 'soft_cluster'
  return 'light_drop'
}

const stableHash = (value: string): number => {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0
  return Math.abs(hash)
}

export const createInitialCompanion = (
  cycleId = 'luminous-current',
  birthMarkId = `birth-mark-${stableHash(cycleId) % 4 + 1}`
): LuminousCompanionState => ({
  cycleId,
  xp: 0,
  mainForm: 'light_drop',
  growthNode: 1,
  affinities: emptyAffinities(),
  birthMarkId,
  equippedAchievementAssetIds: []
})

const chapterAffinities = (state: LuminousCompanionState, slot: 1 | 2): AffinityTotals => {
  if (slot === 1 || !state.firstImprintAffinityBaseline) return { ...state.affinities }
  return Object.fromEntries(AFFINITIES.map((affinity) => [
    affinity,
    Math.max(0, state.affinities[affinity] - state.firstImprintAffinityBaseline![affinity])
  ])) as AffinityTotals
}

export const recommendImprints = (state: LuminousCompanionState, slot: 1 | 2): GrowthAffinity[] => {
  const values = chapterAffinities(state, slot)
  return [...AFFINITIES]
    .sort((left, right) => values[right] - values[left] || AFFINITIES.indexOf(left) - AFFINITIES.indexOf(right))
    .slice(0, 2)
}

export const chooseImprint = (
  state: LuminousCompanionState,
  slot: 1 | 2,
  affinity: GrowthAffinity,
  chosenAt = new Date().toISOString()
): LuminousCompanionState => {
  const minimumLevel = slot === 1 ? 4 : 7
  if (state.growthNode < minimumLevel) throw new Error(`Imprint ${slot} requires Lv${minimumLevel}`)
  if (!recommendImprints(state, slot).includes(affinity)) throw new Error('Imprint must be one of the two recommended affinities')
  if (slot === 1) {
    if (state.firstImprint && state.firstImprint !== affinity) throw new Error('The first imprint is permanent')
    if (state.firstImprint === affinity) return state
    return {
      ...state,
      firstImprint: affinity,
      firstImprintAffinityBaseline: { ...state.affinities },
      firstImprintChosenAt: chosenAt
    }
  }
  if (!state.firstImprint) throw new Error('Choose the first imprint before the second')
  if (state.secondImprint && state.secondImprint !== affinity) throw new Error('The second imprint is permanent')
  if (state.secondImprint === affinity) return state
  return { ...state, secondImprint: affinity, secondImprintChosenAt: chosenAt }
}

export const normalizeCompanionProgress = (state: LuminousCompanionState, maturedAt?: string): LuminousCompanionState => {
  const growthNode = Math.max(state.growthNode, selectGrowthNode(state.xp)) as GrowthNode
  return {
    ...state,
    growthNode,
    mainForm: mainFormForNode(growthNode),
    ...(state.xp >= MATURITY_XP && !state.maturedAt ? { maturedAt: maturedAt ?? new Date().toISOString() } : {})
  }
}

export const selectCompanionProgress = (state: LuminousCompanionState): CompanionProgress => {
  const level = Math.max(state.growthNode, selectGrowthNode(state.xp)) as GrowthNode
  const currentLevelXp = GROWTH_LEVEL_XP[level - 1]
  const nextLevelXp = level < 12 ? (GROWTH_LEVEL_XP as readonly number[])[level] : undefined
  const progressToNextLevel = nextLevelXp == null
    ? 1
    : Math.max(0, Math.min(1, (state.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)))
  const starTideXp = Math.max(0, state.xp - MATURITY_XP)
  const pendingImprint = level >= 4 && !state.firstImprint ? 1 : level >= 7 && !state.secondImprint ? 2 : undefined
  return {
    level,
    mainForm: mainFormForNode(level),
    xp: state.xp,
    currentLevelXp,
    nextLevelXp,
    progressToNextLevel,
    starTideXp,
    starTideRings: Math.floor(starTideXp / STAR_TIDE_RING_XP),
    starTideRingProgress: (starTideXp % STAR_TIDE_RING_XP) / STAR_TIDE_RING_XP,
    recommendedImprints: pendingImprint ? recommendImprints(state, pendingImprint) : [],
    ...(pendingImprint ? { pendingImprint } : {})
  }
}
