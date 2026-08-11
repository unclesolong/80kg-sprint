import { describe, expect, it } from 'vitest'
import { chooseImprint, createInitialCompanion, normalizeCompanionProgress, selectCompanionProgress, selectGrowthNode } from './progression'

describe('luminous 12-node progression', () => {
  it('uses every specified XP threshold and never normalizes a saved node backwards', () => {
    expect([0, 60, 160, 300, 460, 640, 840, 1_060, 1_300, 1_560, 1_840, 2_140].map(selectGrowthNode))
      .toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    const saved = { ...createInitialCompanion(), growthNode: 7 as const, mainForm: 'flow_ring' as const, xp: 100 }
    expect(normalizeCompanionProgress(saved).growthNode).toBe(7)
  })

  it('offers the top two affinities at Lv4 and uses post-choice affinity deltas at Lv7', () => {
    const level4 = normalizeCompanionProgress({
      ...createInitialCompanion(), xp: 300,
      affinities: { awareness: 1, nourishment: 10, activity: 8, recovery: 2 }
    })
    expect(selectCompanionProgress(level4)).toMatchObject({ pendingImprint: 1, recommendedImprints: ['nourishment', 'activity'] })
    const first = chooseImprint(level4, 1, 'nourishment', '2026-08-01T00:00:00Z')
    const level7 = normalizeCompanionProgress({
      ...first, xp: 840,
      affinities: { awareness: 2, nourishment: 11, activity: 13, recovery: 22 }
    })
    expect(selectCompanionProgress(level7)).toMatchObject({ pendingImprint: 2, recommendedImprints: ['recovery', 'activity'] })
    expect(chooseImprint(level7, 2, 'recovery').secondImprint).toBe('recovery')
  })

  it('turns post-Lv12 XP into commemorative star-tide rings', () => {
    const progress = selectCompanionProgress({ ...createInitialCompanion(), xp: 2_790, growthNode: 12, mainForm: 'star_tide' })
    expect(progress).toMatchObject({ level: 12, starTideXp: 650, starTideRings: 2 })
    expect(progress.starTideRingProgress).toBeCloseTo(50 / 300)
  })
})
