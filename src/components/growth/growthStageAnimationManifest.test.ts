import { describe, expect, it } from 'vitest'
import {
  GROWTH_STAGE_ANIMATION_PROFILES,
  resolveGrowthAmbientEffectSpriteUrl,
  resolveGrowthStageAnimationPosterUrl,
  resolveGrowthStageSecondaryAnimationUrl,
  resolveGrowthStageAnimationUrl
} from './growthStageAnimationManifest'

describe('growth stage animation manifest', () => {
  it('exposes authored video profiles only for the approved stages', () => {
    const profiles = Object.values(GROWTH_STAGE_ANIMATION_PROFILES)
    expect(profiles).toHaveLength(5)
    expect(profiles.map((profile) => profile.node)).toEqual([2, 3, 4, 5, 6])
    expect(profiles.every((profile) => profile.format === 'video')).toBe(true)
    expect(GROWTH_STAGE_ANIMATION_PROFILES[2]).toMatchObject({
      format: 'video',
      frameRate: 50,
      secondaryAssetPath: 'art/growth/motion/stage-02/luminous-stage-02-idle-secondary-50fps-v1.mp4',
      sceneComposition: 'embedded_habitat',
      habitatAssetPath: 'art/growth/luminous-habitat-star-tide.webp',
      ambientEffect: 'star_tide_perimeter_v1'
    })
    expect(GROWTH_STAGE_ANIMATION_PROFILES[3]).toMatchObject({
      format: 'video',
      frameRate: 50,
      secondaryAssetPath: 'art/growth/motion/stage-03/luminous-stage-03-idle-secondary-50fps-v1.mp4',
      sceneComposition: 'embedded_habitat',
      habitatAssetPath: 'art/growth/luminous-habitat-star-tide.webp',
      ambientEffect: 'star_tide_perimeter_v1'
    })
    expect(GROWTH_STAGE_ANIMATION_PROFILES[4]).toMatchObject({
      format: 'video',
      frameRate: 50,
      secondaryAssetPath: 'art/growth/motion/stage-04/luminous-stage-04-idle-secondary-50fps-v1.mp4',
      sceneComposition: 'embedded_habitat',
      habitatAssetPath: 'art/growth/luminous-habitat-star-tide.webp',
      ambientEffect: 'star_tide_perimeter_v1'
    })
    expect(GROWTH_STAGE_ANIMATION_PROFILES[5]).toMatchObject({
      format: 'video',
      frameRate: 50,
      secondaryAssetPath: 'art/growth/motion/stage-05/luminous-stage-05-idle-secondary-50fps-v1.mp4',
      sceneComposition: 'embedded_habitat',
      habitatAssetPath: 'art/growth/luminous-habitat-star-tide.webp',
      ambientEffect: 'star_tide_perimeter_v1'
    })
    expect(GROWTH_STAGE_ANIMATION_PROFILES[6]).toMatchObject({
      format: 'video',
      frameRate: 50,
      secondaryAssetPath: 'art/growth/motion/stage-06/luminous-stage-06-idle-secondary-50fps-v1.mp4',
      sceneComposition: 'embedded_habitat',
      habitatAssetPath: 'art/growth/luminous-habitat-star-tide.webp',
      ambientEffect: 'star_tide_perimeter_v1'
    })
  })

  it('keeps unapproved stages on their static posters', () => {
    expect(resolveGrowthStageAnimationUrl(1, '/80kg-sprint/')).toBeUndefined()
    expect(resolveGrowthStageAnimationUrl(12, '/80kg-sprint/')).toBeUndefined()
    expect(resolveGrowthStageAnimationPosterUrl(12, '/80kg-sprint/')).toBeUndefined()
    expect(resolveGrowthStageSecondaryAnimationUrl(12, '/80kg-sprint/')).toBeUndefined()
  })

  it('resolves only approved secondary motion and leaves unfinished stages dormant', () => {
    expect(resolveGrowthStageSecondaryAnimationUrl(2, '/80kg-sprint')).toBe(
      '/80kg-sprint/art/growth/motion/stage-02/luminous-stage-02-idle-secondary-50fps-v1.mp4'
    )
    expect(resolveGrowthStageSecondaryAnimationUrl(3, '/80kg-sprint/')).toBe(
      '/80kg-sprint/art/growth/motion/stage-03/luminous-stage-03-idle-secondary-50fps-v1.mp4'
    )
    expect(resolveGrowthStageSecondaryAnimationUrl(4, '/80kg-sprint/')).toBe(
      '/80kg-sprint/art/growth/motion/stage-04/luminous-stage-04-idle-secondary-50fps-v1.mp4'
    )
    expect(resolveGrowthStageSecondaryAnimationUrl(5, '/80kg-sprint/')).toBe(
      '/80kg-sprint/art/growth/motion/stage-05/luminous-stage-05-idle-secondary-50fps-v1.mp4'
    )
    expect(resolveGrowthStageSecondaryAnimationUrl(6, '/80kg-sprint/')).toBe(
      '/80kg-sprint/art/growth/motion/stage-06/luminous-stage-06-idle-secondary-50fps-v1.mp4'
    )
  })

  it('resolves the approved authored 50fps videos', () => {
    expect(resolveGrowthStageAnimationUrl(2, '/80kg-sprint')).toBe(
      '/80kg-sprint/art/growth/motion/stage-02/luminous-stage-02-idle-primary-50fps-v1.mp4'
    )
    expect(resolveGrowthStageAnimationUrl(3, '/80kg-sprint')).toBe(
      '/80kg-sprint/art/growth/motion/stage-03/luminous-stage-03-idle-primary-50fps-v1.mp4'
    )
    expect(resolveGrowthStageAnimationUrl(4, '/80kg-sprint')).toBe(
      '/80kg-sprint/art/growth/motion/stage-04/luminous-stage-04-idle-primary-50fps-v1.mp4'
    )
    expect(resolveGrowthStageAnimationUrl(5, '/80kg-sprint')).toBe(
      '/80kg-sprint/art/growth/motion/stage-05/luminous-stage-05-idle-primary-50fps-v4.mp4'
    )
    expect(resolveGrowthStageAnimationUrl(6, '/80kg-sprint')).toBe(
      '/80kg-sprint/art/growth/motion/stage-06/luminous-stage-06-idle-primary-50fps-v3.mp4'
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
    expect(resolveGrowthStageAnimationPosterUrl(5, '/80kg-sprint/')).toBe(
      '/80kg-sprint/art/growth/motion/stage-05/luminous-stage-05-idle-primary-habitat-poster-v4.webp'
    )
    expect(resolveGrowthStageAnimationPosterUrl(6, '/80kg-sprint/')).toBe(
      '/80kg-sprint/art/growth/motion/stage-06/luminous-stage-06-idle-primary-habitat-poster-v3.webp'
    )
  })

  it('resolves the authored ambient sprite under the application base path', () => {
    expect(resolveGrowthAmbientEffectSpriteUrl('/80kg-sprint')).toBe(
      '/80kg-sprint/art/growth/effects/luminous-star-particles-v1.webp'
    )
  })
})
