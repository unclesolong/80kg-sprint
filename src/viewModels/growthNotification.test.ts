import { describe, expect, it } from 'vitest'
import { emptyGrowthSnapshot, mainFormForNode, type GrowthNode, type GrowthSnapshot, type RewardLedgerEntry } from '../growth'
import {
  dismissGrowthNotification,
  enqueueGrowthNotification,
  getGrowthNotificationArtworkUrl,
  mergeGrowthNotifications,
  selectGrowthNotification,
  type GrowthNotificationCause
} from './growthNotification'

const reward = (id: string, xpDelta = 10): RewardLedgerEntry => ({
  id,
  taskId: `task-${id}`,
  cadence: 'daily',
  periodKey: '2026-08-11',
  xpDelta,
  category: 'awareness',
  affinityDelta: 1,
  createdAt: '2026-08-11T08:00:00.000Z'
})

const atProgress = (
  xp: number,
  node: GrowthNode,
  rewardLedger: RewardLedgerEntry[] = []
): GrowthSnapshot => {
  const snapshot = emptyGrowthSnapshot('test-cycle')
  return {
    ...snapshot,
    companion: { ...snapshot.companion, xp, growthNode: node, mainForm: mainFormForNode(node) },
    rewardLedger
  }
}

describe('selectGrowthNotification', () => {
  it('returns one XP notice and uses newly added reward IDs as its stable identity', () => {
    const previous = atProgress(20, 1, [reward('reward-1')])
    const next = atProgress(40, 1, [reward('reward-1'), reward('reward / 2'), reward('reward-3')])

    const notice = selectGrowthNotification(previous, next, 'user_write', { artworkBaseUrl: '/80kg-sprint' })

    expect(notice).toMatchObject({
      id: 'growth-reward:reward%20%2F%202+reward-3',
      kind: 'xp',
      cause: 'user_write',
      xpDelta: 20,
      fromNode: 1,
      toNode: 1,
      fromNodeLabel: '初醒',
      toFormLabel: '光滴',
      newlyAddedRewardLedgerIds: ['reward / 2', 'reward-3'],
      previousArtworkUrl: '/80kg-sprint/art/growth/luminous-stage-01.webp',
      artworkUrl: '/80kg-sprint/art/growth/luminous-stage-01.webp'
    })
  })

  it('prioritizes a level-up over XP and reports only the final node of a multi-level jump', () => {
    const notice = selectGrowthNotification(
      atProgress(10, 1),
      atProgress(170, 3, [reward('multi', 160)]),
      'backfill',
      { artworkBaseUrl: '/' }
    )

    expect(notice).toMatchObject({
      kind: 'level',
      xpDelta: 160,
      fromNode: 1,
      toNode: 3,
      fromNodeLabel: '初醒',
      toNodeLabel: '浮珠',
      fromFormLabel: '光滴',
      toFormLabel: '光滴',
      previousArtworkUrl: '/art/growth/luminous-stage-01.webp',
      artworkUrl: '/art/growth/luminous-stage-03.webp'
    })
    expect(notice?.title).toBe('潤光升至 Lv3')
  })

  it('prioritizes the final main-form change over crossed levels', () => {
    const notice = selectGrowthNotification(
      atProgress(150, 2),
      atProgress(850, 7, [reward('form-jump', 700)]),
      'retry',
      { artworkBaseUrl: '/app/' }
    )

    expect(notice).toMatchObject({
      kind: 'form',
      fromNode: 2,
      toNode: 7,
      fromForm: 'light_drop',
      toForm: 'flow_ring',
      fromFormLabel: '光滴',
      toFormLabel: '流環',
      previousArtworkUrl: '/app/art/growth/luminous-stage-02.webp',
      artworkUrl: '/app/art/growth/luminous-stage-07.webp'
    })
    expect(notice?.title).toBe('潤光蛻變為流環')
    expect(notice?.message).toContain('Lv7 展尾')
  })

  it.each<GrowthNotificationCause>(['startup', 'import', 'clear'])(
    'suppresses %s transitions even when XP increased',
    (cause) => {
      expect(selectGrowthNotification(atProgress(0, 1), atProgress(60, 2, [reward('restored')]), cause)).toBeUndefined()
    }
  )

  it('does not notify for unchanged or corrected-down XP', () => {
    expect(selectGrowthNotification(atProgress(60, 2), atProgress(60, 2), 'user_write')).toBeUndefined()
    expect(selectGrowthNotification(atProgress(60, 2), atProgress(50, 2), 'retry')).toBeUndefined()
  })

  it('falls back to a deterministic transition identity when no ledger row was added', () => {
    const notice = selectGrowthNotification(atProgress(20, 1), atProgress(30, 1), 'user_write')
    expect(notice?.id).toBe('growth-progress:user_write:test-cycle:20-30:lv1-lv1:ledger0')
  })
})

describe('getGrowthNotificationArtworkUrl', () => {
  it('normalizes an explicit deployment base without duplicating slashes', () => {
    expect(getGrowthNotificationArtworkUrl(12, '/80kg-sprint')).toBe('/80kg-sprint/art/growth/luminous-stage-12.webp')
    expect(getGrowthNotificationArtworkUrl(4, '')).toBe('art/growth/luminous-stage-04.webp')
  })
})

describe('mergeGrowthNotifications', () => {
  it('keeps the highest-priority transition and combines sequential XP', () => {
    const first = selectGrowthNotification(atProgress(280, 3), atProgress(300, 4, [reward('level', 20)]), 'user_write')!
    const second = selectGrowthNotification(atProgress(300, 4, [reward('level', 20)]), atProgress(310, 4, [reward('level', 20), reward('after')]), 'user_write')!

    expect(mergeGrowthNotifications(first, second)).toMatchObject({
      kind: 'form',
      xpDelta: 30,
      fromNode: 3,
      toNode: 4,
      previousArtworkUrl: expect.stringContaining('luminous-stage-03.webp'),
      artworkUrl: expect.stringContaining('luminous-stage-04.webp'),
      newlyAddedRewardLedgerIds: ['level', 'after']
    })
  })

  it('does not combine unrelated replacement snapshots', () => {
    const current = selectGrowthNotification(atProgress(0, 1), atProgress(10, 1, [reward('old')]), 'user_write')!
    const incoming = selectGrowthNotification(atProgress(300, 4), atProgress(310, 4, [reward('new')]), 'user_write')!

    expect(mergeGrowthNotifications(current, incoming)).toBe(incoming)
  })
})

describe('growth notification queue', () => {
  it('merges only inside the short batching window', () => {
    const form = selectGrowthNotification(atProgress(290, 3), atProgress(300, 4, [reward('form')]), 'user_write')!
    const laterXp = selectGrowthNotification(atProgress(300, 4, [reward('form')]), atProgress(310, 4, [reward('form'), reward('later')]), 'user_write')!
    const first = enqueueGrowthNotification({}, form, 1_000)

    const batched = enqueueGrowthNotification(first, laterXp, 1_500)
    expect(batched.visible).toMatchObject({ kind: 'form', xpDelta: 20 })
    expect(batched.queued).toBeUndefined()

    const queued = enqueueGrowthNotification(first, laterXp, 1_601)
    expect(queued.visible).toBe(form)
    expect(queued.queued).toBe(laterXp)
  })

  it('promotes one coalesced unread notice after the current card is dismissed', () => {
    const current = selectGrowthNotification(atProgress(290, 3), atProgress(300, 4, [reward('form')]), 'user_write')!
    const next = selectGrowthNotification(atProgress(300, 4, [reward('form')]), atProgress(310, 4, [reward('form'), reward('next')]), 'user_write')!
    const state = enqueueGrowthNotification({ visible: current, shownAtMs: 1_000 }, next, 2_000)

    expect(dismissGrowthNotification(state, 3_000)).toEqual({ visible: next, shownAtMs: 3_000 })
    expect(dismissGrowthNotification({ visible: current, shownAtMs: 1_000 }, 3_000)).toEqual({})
  })
})
