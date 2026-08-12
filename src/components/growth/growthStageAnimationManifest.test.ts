import { describe, expect, it } from 'vitest'
import {
  GROWTH_STAGE_ANIMATION_PROFILES,
  resolveGrowthStageAnimationPosterUrl,
  resolveGrowthStageAnimationUrl
} from './growthStageAnimationManifest'

describe('growth stage animation manifest', () => {
  it('exposes authored video profiles only for the approved stages', () => {
    const profiles = Object.values(GROWTH_STAGE_ANIMATION_PROFILES)
    expect(profiles).toHaveLength(3)
    expect(profiles.map((profile) => profile.node)).toEqual([2, 3, 4])
    expect(profiles.every((profile) => profile.format === 'video')).toBe(true)
    expect(GROWTH_STAGE_ANIMATION_PROFILES[2]).toMatchObject({
      format: 'video',
      frameRate: 50,
      sceneComposition: 'embedded_habitat',
      habitatAssetPath: 'art/growth/luminous-habitat-star-tide.webp'
    })
    expect(GROWTH_STAGE_ANIMATION_PROFILES[3]).toMatchObject({
      format: 'video',
      frameRate: 50,
      sceneComposition: 'embedded_habitat',
      habitatAssetPath: 'art/growth/luminous-habitat-star-tide.webp'
    })
    expect(GROWTH_STAGE_ANIMATION_PROFILES[4]).toMatchObject({
      format: 'video',
      frameRate: 50,
      sceneComposition: 'embedded_habitat',
      habitatAssetPath: 'art/growth/luminous-habitat-star-tide.webp'
    })
  })

  it('keeps unapproved stages on their static posters', () => {
    expect(resolveGrowthStageAnimationUrl(1, '/80kg-sprint/')).toBeUndefined()
    expect(resolveGrowthStageAnimationUrl(5, '/80kg-sprint/')).toBeUndefined()
    expect(resolveGrowthStageAnimationUrl(12, '/80kg-sprint/')).toBeUndefined()
    expect(resolveGrowthStageAnimationPosterUrl(5, '/80kg-sprint/')).toBeUndefined()
  })

  it('resolves the authored 50fps videos for stages two through four', () => {
    expect(resolveGrowthStageAnimationUrl(2, '/80kg-sprint')).toBe(
      '/80kg-sprint/art/growth/motion/stage-02/luminous-stage-02-idle-primary-50fps-v1.mp4'
    )
    expect(resolveGrowthStageAnimationUrl(3, '/80kg-sprint')).toBe(
      '/80kg-sprint/art/growth/motion/stage-03/luminous-stage-03-idle-primary-50fps-v1.mp4'
    )
    expect(resolveGrowthStageAnimationUrl(4, '/80kg-sprint')).toBe(
      '/80kg-sprint/art/growth/motion/stage-04/luminous-stage-04-idle-primary-50fps-v1.mp4'
    )
  })

  it('resolves first-frame habitat posters for loading and reduced-motion playback', () => {
    expect(resolveGrowthStageAnimationPosterUrl(2, '/80kg-sprint')).toBe(
      '/80kg-sprint/art/growth/motion/stage-02/luminous-stage-02-idle-primary-habitat-poster-v1.webp'
    )
    expect(resolveGrowthStageAnimationPosterUrl(3, '/80kg-sprint/')).toBe(
      '/80kg-sprint/art/growth/motion/stage-03/luminous-stage-03-idle-primary-habitat-poster-v1.webp'
    )
    expect(resolveGrowthStageAnimationPosterUrl(4, '/80kg-sprint/')).toBe(
      '/80kg-sprint/art/growth/motion/stage-04/luminous-stage-04-idle-primary-habitat-poster-v1.webp'
    )
  })
})
