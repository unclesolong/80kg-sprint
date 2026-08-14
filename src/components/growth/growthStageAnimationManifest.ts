import type { GrowthNode } from './types'

interface GrowthStageAnimationProfileBase {
  node: GrowthNode
  assetPath: string
}

export interface GrowthStageAtlasAnimationProfile extends GrowthStageAnimationProfileBase {
  format: 'atlas'
  durationMs: number
  phaseOffset: number
}

export interface GrowthStageVideoAnimationProfile extends GrowthStageAnimationProfileBase {
  format: 'video'
  frameRate: 50
  /** A first-frame still from the approved runtime, including the exact same fixed habitat plate. */
  posterAssetPath: string
  /** The runtime already contains this habitat; the player must never add a second background layer. */
  sceneComposition: 'embedded_habitat'
  habitatAssetPath: string
  ambientEffect?: 'star_tide_perimeter_v1'
  /**
   * Optional second authored action. It must use the same embedded habitat and
   * begin/end on the primary clip's neutral seam. Its versioned URL must remain
   * covered by the existing PWA runtime-cache route. Secondary motion is fetched
   * on demand and must not be added to the precache list.
   */
  secondaryAssetPath?: string
}

export type GrowthStageAnimationProfile =
  | GrowthStageAtlasAnimationProfile
  | GrowthStageVideoAnimationProfile

/** Anatomy and appendage motion lives in authored frames; this only schedules playback. */
export const GROWTH_STAGE_ANIMATION_PROFILES: Readonly<Partial<Record<GrowthNode, GrowthStageAnimationProfile>>> = {
  2: {
    node: 2,
    format: 'video',
    assetPath: 'art/growth/motion/stage-02/luminous-stage-02-idle-primary-50fps-v1.mp4',
    frameRate: 50,
    secondaryAssetPath: 'art/growth/motion/stage-02/luminous-stage-02-idle-secondary-50fps-v1.mp4',
    posterAssetPath: 'art/growth/motion/stage-02/luminous-stage-02-idle-primary-habitat-poster-v1.webp',
    sceneComposition: 'embedded_habitat',
    habitatAssetPath: 'art/growth/luminous-habitat-star-tide.webp',
    ambientEffect: 'star_tide_perimeter_v1'
  },
  3: {
    node: 3,
    format: 'video',
    assetPath: 'art/growth/motion/stage-03/luminous-stage-03-idle-primary-50fps-v1.mp4',
    frameRate: 50,
    secondaryAssetPath: 'art/growth/motion/stage-03/luminous-stage-03-idle-secondary-50fps-v1.mp4',
    posterAssetPath: 'art/growth/motion/stage-03/luminous-stage-03-idle-primary-habitat-poster-v1.webp',
    sceneComposition: 'embedded_habitat',
    habitatAssetPath: 'art/growth/luminous-habitat-star-tide.webp',
    ambientEffect: 'star_tide_perimeter_v1'
  },
  4: {
    node: 4,
    format: 'video',
    assetPath: 'art/growth/motion/stage-04/luminous-stage-04-idle-primary-50fps-v1.mp4',
    frameRate: 50,
    secondaryAssetPath: 'art/growth/motion/stage-04/luminous-stage-04-idle-secondary-50fps-v1.mp4',
    posterAssetPath: 'art/growth/motion/stage-04/luminous-stage-04-idle-primary-habitat-poster-v1.webp',
    sceneComposition: 'embedded_habitat',
    habitatAssetPath: 'art/growth/luminous-habitat-star-tide.webp',
    ambientEffect: 'star_tide_perimeter_v1'
  },
  5: {
    node: 5,
    format: 'video',
    assetPath: 'art/growth/motion/stage-05/luminous-stage-05-idle-primary-50fps-v4.mp4',
    frameRate: 50,
    secondaryAssetPath: 'art/growth/motion/stage-05/luminous-stage-05-idle-secondary-50fps-v1.mp4',
    posterAssetPath: 'art/growth/motion/stage-05/luminous-stage-05-idle-primary-habitat-poster-v4.webp',
    sceneComposition: 'embedded_habitat',
    habitatAssetPath: 'art/growth/luminous-habitat-star-tide.webp',
    ambientEffect: 'star_tide_perimeter_v1'
  },
  6: {
    node: 6,
    format: 'video',
    assetPath: 'art/growth/motion/stage-06/luminous-stage-06-idle-primary-50fps-v3.mp4',
    frameRate: 50,
    secondaryAssetPath: 'art/growth/motion/stage-06/luminous-stage-06-idle-secondary-50fps-v1.mp4',
    posterAssetPath: 'art/growth/motion/stage-06/luminous-stage-06-idle-primary-habitat-poster-v3.webp',
    sceneComposition: 'embedded_habitat',
    habitatAssetPath: 'art/growth/luminous-habitat-star-tide.webp',
    ambientEffect: 'star_tide_perimeter_v1'
  }
}

const withTrailingSlash = (baseUrl: string): string => baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`

export const resolveGrowthStageAnimationUrl = (
  node: GrowthNode,
  baseUrl = import.meta.env.BASE_URL
): string | undefined => {
  const profile = GROWTH_STAGE_ANIMATION_PROFILES[node]
  return profile ? `${withTrailingSlash(baseUrl)}${profile.assetPath}` : undefined
}

export const resolveGrowthStageAnimationPosterUrl = (
  node: GrowthNode,
  baseUrl = import.meta.env.BASE_URL
): string | undefined => {
  const profile = GROWTH_STAGE_ANIMATION_PROFILES[node]
  return profile?.format === 'video'
    ? `${withTrailingSlash(baseUrl)}${profile.posterAssetPath}`
    : undefined
}

export const resolveGrowthStageSecondaryAnimationUrl = (
  node: GrowthNode,
  baseUrl = import.meta.env.BASE_URL
): string | undefined => {
  const profile = GROWTH_STAGE_ANIMATION_PROFILES[node]
  return profile?.format === 'video' && profile.secondaryAssetPath
    ? `${withTrailingSlash(baseUrl)}${profile.secondaryAssetPath}`
    : undefined
}

export const resolveGrowthAmbientEffectSpriteUrl = (
  baseUrl = import.meta.env.BASE_URL
): string => `${withTrailingSlash(baseUrl)}art/growth/effects/luminous-star-particles-v1.webp`
