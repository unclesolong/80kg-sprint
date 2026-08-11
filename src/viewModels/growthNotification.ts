import type { GrowthNode, GrowthSnapshot, LuminousMainForm } from '../growth'

export type GrowthNotificationCause =
  | 'startup'
  | 'user_write'
  | 'backfill'
  | 'import'
  | 'clear'
  | 'retry'

export type GrowthNotificationKind = 'xp' | 'level' | 'form'

export interface GrowthNotification {
  /** Stable enough for React keys and de-duplication; newly credited ledger IDs take precedence. */
  id: string
  kind: GrowthNotificationKind
  cause: GrowthNotificationCause
  xpDelta: number
  fromNode: GrowthNode
  toNode: GrowthNode
  fromForm: LuminousMainForm
  toForm: LuminousMainForm
  fromNodeLabel: string
  toNodeLabel: string
  fromFormLabel: string
  toFormLabel: string
  newlyAddedRewardLedgerIds: string[]
  previousArtworkUrl: string
  artworkUrl: string
  title: string
  message: string
  announcement: string
}

export interface GrowthNotificationOptions {
  /** Defaults to Vite's deployment base; pass a value explicitly in non-Vite consumers and tests. */
  artworkBaseUrl?: string
}

export interface GrowthNotificationQueueState {
  visible?: GrowthNotification
  queued?: GrowthNotification
  shownAtMs?: number
}

export const GROWTH_NOTIFICATION_MERGE_WINDOW_MS = 600

export const GROWTH_NODE_LABELS: Readonly<Record<GrowthNode, string>> = {
  1: '初醒',
  2: '凝核',
  3: '浮珠',
  4: '萌翼',
  5: '生環',
  6: '顯紋',
  7: '展尾',
  8: '織星',
  9: '雙鳴',
  10: '化潮',
  11: '棲境',
  12: '完全共鳴'
}

export const GROWTH_FORM_LABELS: Readonly<Record<LuminousMainForm, string>> = {
  light_drop: '光滴',
  soft_cluster: '潤團',
  flow_ring: '流環',
  star_tide: '星潮'
}

const SUPPRESSED_CAUSES = new Set<GrowthNotificationCause>(['startup', 'import', 'clear'])

const withTrailingSlash = (baseUrl: string): string => {
  if (!baseUrl) return ''
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
}

export const getGrowthNotificationArtworkUrl = (
  node: GrowthNode,
  baseUrl = import.meta.env.BASE_URL
): string => `${withTrailingSlash(baseUrl)}art/growth/luminous-stage-${String(node).padStart(2, '0')}.webp`

const newlyAddedRewardIds = (previous: GrowthSnapshot, next: GrowthSnapshot): string[] => {
  const previousIds = new Set(previous.rewardLedger.map((entry) => entry.id))
  return [...new Set(next.rewardLedger
    .filter((entry) => !previousIds.has(entry.id))
    .map((entry) => entry.id))]
}

const fallbackEventId = (
  previous: GrowthSnapshot,
  next: GrowthSnapshot,
  cause: GrowthNotificationCause
): string => [
  'growth-progress',
  cause,
  next.companion.cycleId,
  `${previous.companion.xp}-${next.companion.xp}`,
  `lv${previous.companion.growthNode}-lv${next.companion.growthNode}`,
  `ledger${next.rewardLedger.length}`
].map(encodeURIComponent).join(':')

const eventId = (
  previous: GrowthSnapshot,
  next: GrowthSnapshot,
  cause: GrowthNotificationCause,
  rewardIds: readonly string[]
): string => rewardIds.length > 0
  ? `growth-reward:${rewardIds.map(encodeURIComponent).join('+')}`
  : fallbackEventId(previous, next, cause)

const copyFor = (
  kind: GrowthNotificationKind,
  xpDelta: number,
  fromNode: GrowthNode,
  toNode: GrowthNode,
  fromForm: LuminousMainForm,
  toForm: LuminousMainForm
): Pick<GrowthNotification, 'title' | 'message' | 'announcement'> => {
  const fromNodeLabel = GROWTH_NODE_LABELS[fromNode]
  const toNodeLabel = GROWTH_NODE_LABELS[toNode]
  const fromFormLabel = GROWTH_FORM_LABELS[fromForm]
  const toFormLabel = GROWTH_FORM_LABELS[toForm]

  if (kind === 'form') {
    const title = `潤光蛻變為${toFormLabel}`
    const message = `${fromFormLabel}已成長至 Lv${toNode} ${toNodeLabel}，獲得 ${xpDelta} XP。`
    return { title, message, announcement: `${title}。${message}` }
  }

  if (kind === 'level') {
    const title = `潤光升至 Lv${toNode}`
    const message = `${fromNodeLabel}成長為${toNodeLabel}，獲得 ${xpDelta} XP。`
    return { title, message, announcement: `${title}。${message}` }
  }

  const title = `潤光獲得 ${xpDelta} XP`
  const message = `日常行動已轉化為成長能量，目前是 Lv${toNode} ${toNodeLabel}。`
  return { title, message, announcement: `${title}。${message}` }
}

/**
 * Selects at most one notification for an atomic snapshot transition.
 * Multi-level transitions intentionally report only their final state, with
 * main-form changes taking precedence over an ordinary level-up or XP gain.
 */
export const selectGrowthNotification = (
  previous: GrowthSnapshot,
  next: GrowthSnapshot,
  cause: GrowthNotificationCause,
  options: GrowthNotificationOptions = {}
): GrowthNotification | undefined => {
  if (SUPPRESSED_CAUSES.has(cause)) return undefined

  const xpDelta = next.companion.xp - previous.companion.xp
  if (!Number.isSafeInteger(xpDelta) || xpDelta <= 0) return undefined

  const fromNode = previous.companion.growthNode
  const toNode = next.companion.growthNode
  const fromForm = previous.companion.mainForm
  const toForm = next.companion.mainForm
  const kind: GrowthNotificationKind = fromForm !== toForm
    ? 'form'
    : toNode > fromNode ? 'level' : 'xp'
  const rewardIds = newlyAddedRewardIds(previous, next)
  const copy = copyFor(kind, xpDelta, fromNode, toNode, fromForm, toForm)

  return {
    id: eventId(previous, next, cause, rewardIds),
    kind,
    cause,
    xpDelta,
    fromNode,
    toNode,
    fromForm,
    toForm,
    fromNodeLabel: GROWTH_NODE_LABELS[fromNode],
    toNodeLabel: GROWTH_NODE_LABELS[toNode],
    fromFormLabel: GROWTH_FORM_LABELS[fromForm],
    toFormLabel: GROWTH_FORM_LABELS[toForm],
    newlyAddedRewardLedgerIds: rewardIds,
    previousArtworkUrl: getGrowthNotificationArtworkUrl(fromNode, options.artworkBaseUrl),
    artworkUrl: getGrowthNotificationArtworkUrl(toNode, options.artworkBaseUrl),
    ...copy
  }
}

/**
 * Coalesces sequential commits into one card. This keeps a form change or
 * level-up visible when another small reward arrives before the user has had
 * time to read it, while unrelated replacement snapshots start a new notice.
 */
export const mergeGrowthNotifications = (
  current: GrowthNotification | undefined,
  incoming: GrowthNotification
): GrowthNotification => {
  if (!current || current.id === incoming.id) return incoming
  if (current.toNode !== incoming.fromNode || current.toForm !== incoming.fromForm) return incoming

  const fromNode = current.fromNode
  const toNode = incoming.toNode
  const fromForm = current.fromForm
  const toForm = incoming.toForm
  const xpDelta = current.xpDelta + incoming.xpDelta
  const kind: GrowthNotificationKind = fromForm !== toForm
    ? 'form'
    : toNode > fromNode ? 'level' : 'xp'
  const newlyAddedRewardLedgerIds = [...new Set([
    ...current.newlyAddedRewardLedgerIds,
    ...incoming.newlyAddedRewardLedgerIds
  ])]
  const copy = copyFor(kind, xpDelta, fromNode, toNode, fromForm, toForm)
  const idParts = newlyAddedRewardLedgerIds.length > 0
    ? newlyAddedRewardLedgerIds.map(encodeURIComponent)
    : [encodeURIComponent(current.id), encodeURIComponent(incoming.id)]

  return {
    ...incoming,
    id: `growth-batch:${idParts.join('+')}`,
    kind,
    xpDelta,
    fromNode,
    toNode,
    fromForm,
    toForm,
    fromNodeLabel: GROWTH_NODE_LABELS[fromNode],
    toNodeLabel: GROWTH_NODE_LABELS[toNode],
    fromFormLabel: GROWTH_FORM_LABELS[fromForm],
    toFormLabel: GROWTH_FORM_LABELS[toForm],
    newlyAddedRewardLedgerIds,
    previousArtworkUrl: current.previousArtworkUrl,
    ...copy
  }
}

/**
 * Keeps one visible card and at most one coalesced unread card. Only rewards
 * arriving in the short visual batching window are folded into the card the
 * user is already reading; a persistent form-change card therefore cannot
 * accumulate unrelated rewards for hours or days.
 */
export const enqueueGrowthNotification = (
  state: GrowthNotificationQueueState,
  incoming: GrowthNotification,
  nowMs: number,
  mergeWindowMs = GROWTH_NOTIFICATION_MERGE_WINDOW_MS
): GrowthNotificationQueueState => {
  if (!state.visible) return { visible: incoming, shownAtMs: nowMs }
  if (state.shownAtMs != null && nowMs - state.shownAtMs <= mergeWindowMs) {
    return { ...state, visible: mergeGrowthNotifications(state.visible, incoming) }
  }
  return { ...state, queued: mergeGrowthNotifications(state.queued, incoming) }
}

export const dismissGrowthNotification = (
  state: GrowthNotificationQueueState,
  nowMs: number
): GrowthNotificationQueueState => state.queued
  ? { visible: state.queued, shownAtMs: nowMs }
  : {}
