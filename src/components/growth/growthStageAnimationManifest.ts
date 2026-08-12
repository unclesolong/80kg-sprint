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
    frameRate: 50
  },
  3: {
    node: 3,
    format: 'video',
    assetPath: 'art/growth/motion/stage-03/luminous-stage-03-idle-primary-50fps-v1.mp4',
    frameRate: 50
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
