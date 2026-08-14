import type { CSSProperties } from 'react'
import type { GrowthNode } from './types'

export type GrowthAmbientStarsNode = 2 | 3 | 4 | 5 | 6
export type GrowthAmbientStarTone = 'gold' | 'blue'

export interface GrowthAmbientStarPlacement {
  id: string
  lane: 'left' | 'right'
  tone: GrowthAmbientStarTone
  xPercent: number
  yPercent: number
  sizePx: number
  driftXPx: number
  driftYPx: number
  returnXPx: number
  returnYPx: number
  rotationDeg: number
  durationMs: number
  delayMs: number
  peakOpacity: number
}

export interface GrowthAmbientStarsProps {
  node: GrowthNode
  spriteUrl: string
}

type AmbientStarStyle = CSSProperties & Record<`--growth-ambient-${string}`, string>
type GrowthAmbientStarLane = GrowthAmbientStarPlacement['lane']

export const GROWTH_AMBIENT_LANE_WIDTH_PERCENT = 21

const LAYOUTS: Readonly<Record<GrowthAmbientStarsNode, readonly GrowthAmbientStarPlacement[]>> = {
  2: [
    { id: '2-l-a', lane: 'left', tone: 'blue', xPercent: 4.5, yPercent: 10, sizePx: 22, driftXPx: 4, driftYPx: -5, returnXPx: 1, returnYPx: 2, rotationDeg: 14, durationMs: 5_600, delayMs: -1_100, peakOpacity: 0.78 },
    { id: '2-l-b', lane: 'left', tone: 'gold', xPercent: 12.5, yPercent: 23, sizePx: 15, driftXPx: -3, driftYPx: 4, returnXPx: 2, returnYPx: -1, rotationDeg: -11, durationMs: 6_800, delayMs: -4_300, peakOpacity: 0.52 },
    { id: '2-l-c', lane: 'left', tone: 'blue', xPercent: 15.5, yPercent: 36, sizePx: 18, driftXPx: 3, driftYPx: -4, returnXPx: -1, returnYPx: 2, rotationDeg: 9, durationMs: 4_900, delayMs: -2_700, peakOpacity: 0.68 },
    { id: '2-l-d', lane: 'left', tone: 'gold', xPercent: 7, yPercent: 49, sizePx: 17, driftXPx: -2, driftYPx: -6, returnXPx: 2, returnYPx: -2, rotationDeg: -16, durationMs: 7_200, delayMs: -5_200, peakOpacity: 0.56 },
    { id: '2-l-e', lane: 'left', tone: 'blue', xPercent: 12, yPercent: 63, sizePx: 24, driftXPx: 5, driftYPx: 3, returnXPx: -2, returnYPx: -2, rotationDeg: 18, durationMs: 6_400, delayMs: -800, peakOpacity: 0.82 },
    { id: '2-l-f', lane: 'left', tone: 'gold', xPercent: 4, yPercent: 77, sizePx: 13, driftXPx: -4, driftYPx: -3, returnXPx: 1, returnYPx: 2, rotationDeg: -9, durationMs: 5_100, delayMs: -3_300, peakOpacity: 0.46 },
    { id: '2-l-g', lane: 'left', tone: 'blue', xPercent: 15, yPercent: 90, sizePx: 20, driftXPx: 2, driftYPx: -5, returnXPx: -2, returnYPx: 1, rotationDeg: 12, durationMs: 6_000, delayMs: -4_700, peakOpacity: 0.74 },
    { id: '2-r-a', lane: 'right', tone: 'blue', xPercent: 95, yPercent: 14, sizePx: 19, driftXPx: -4, driftYPx: 3, returnXPx: 1, returnYPx: -2, rotationDeg: -12, durationMs: 5_200, delayMs: -3_600, peakOpacity: 0.72 },
    { id: '2-r-b', lane: 'right', tone: 'gold', xPercent: 88, yPercent: 28, sizePx: 18, driftXPx: 3, driftYPx: -5, returnXPx: -2, returnYPx: 1, rotationDeg: 15, durationMs: 7_000, delayMs: -900, peakOpacity: 0.58 },
    { id: '2-r-c', lane: 'right', tone: 'blue', xPercent: 84.5, yPercent: 42, sizePx: 23, driftXPx: -2, driftYPx: 4, returnXPx: 1, returnYPx: -2, rotationDeg: -8, durationMs: 4_700, delayMs: -2_100, peakOpacity: 0.8 },
    { id: '2-r-d', lane: 'right', tone: 'gold', xPercent: 93, yPercent: 56, sizePx: 14, driftXPx: 4, driftYPx: -3, returnXPx: -2, returnYPx: 2, rotationDeg: 12, durationMs: 6_300, delayMs: -4_900, peakOpacity: 0.48 },
    { id: '2-r-e', lane: 'right', tone: 'blue', xPercent: 87, yPercent: 69, sizePx: 21, driftXPx: -5, driftYPx: -4, returnXPx: 2, returnYPx: 1, rotationDeg: -15, durationMs: 7_400, delayMs: -1_600, peakOpacity: 0.76 },
    { id: '2-r-f', lane: 'right', tone: 'gold', xPercent: 96, yPercent: 82, sizePx: 16, driftXPx: 3, driftYPx: 5, returnXPx: -1, returnYPx: -2, rotationDeg: 10, durationMs: 5_500, delayMs: -3_900, peakOpacity: 0.54 },
    { id: '2-r-g', lane: 'right', tone: 'blue', xPercent: 84.5, yPercent: 92, sizePx: 18, driftXPx: -3, driftYPx: -4, returnXPx: 2, returnYPx: 1, rotationDeg: -13, durationMs: 6_600, delayMs: -5_400, peakOpacity: 0.7 }
  ],
  3: [
    { id: '3-l-a', lane: 'left', tone: 'blue', xPercent: 6, yPercent: 9, sizePx: 20, driftXPx: 3, driftYPx: 5, returnXPx: -1, returnYPx: -2, rotationDeg: 13, durationMs: 6_400, delayMs: -2_200, peakOpacity: 0.74 },
    { id: '3-l-b', lane: 'left', tone: 'gold', xPercent: 14, yPercent: 22, sizePx: 13, driftXPx: -4, driftYPx: -3, returnXPx: 2, returnYPx: 1, rotationDeg: -9, durationMs: 5_100, delayMs: -4_600, peakOpacity: 0.46 },
    { id: '3-l-c', lane: 'left', tone: 'blue', xPercent: 8.5, yPercent: 35, sizePx: 24, driftXPx: 5, driftYPx: -4, returnXPx: -2, returnYPx: 2, rotationDeg: 16, durationMs: 7_100, delayMs: -1_300, peakOpacity: 0.82 },
    { id: '3-l-d', lane: 'left', tone: 'gold', xPercent: 15.5, yPercent: 49, sizePx: 17, driftXPx: -3, driftYPx: -5, returnXPx: 1, returnYPx: 2, rotationDeg: -14, durationMs: 5_800, delayMs: -3_700, peakOpacity: 0.56 },
    { id: '3-l-e', lane: 'left', tone: 'blue', xPercent: 4, yPercent: 64, sizePx: 18, driftXPx: 4, driftYPx: 3, returnXPx: -1, returnYPx: -2, rotationDeg: 10, durationMs: 5_300, delayMs: -900, peakOpacity: 0.68 },
    { id: '3-l-f', lane: 'left', tone: 'gold', xPercent: 11.5, yPercent: 78, sizePx: 15, driftXPx: -2, driftYPx: 5, returnXPx: 2, returnYPx: -1, rotationDeg: -12, durationMs: 6_700, delayMs: -5_100, peakOpacity: 0.52 },
    { id: '3-l-g', lane: 'left', tone: 'blue', xPercent: 15, yPercent: 91, sizePx: 22, driftXPx: 3, driftYPx: -6, returnXPx: -2, returnYPx: 2, rotationDeg: 15, durationMs: 7_500, delayMs: -3_000, peakOpacity: 0.78 },
    { id: '3-r-a', lane: 'right', tone: 'blue', xPercent: 85.5, yPercent: 12, sizePx: 18, driftXPx: -3, driftYPx: 4, returnXPx: 2, returnYPx: -1, rotationDeg: -10, durationMs: 5_500, delayMs: -4_100, peakOpacity: 0.7 },
    { id: '3-r-b', lane: 'right', tone: 'gold', xPercent: 93, yPercent: 26, sizePx: 18, driftXPx: 4, driftYPx: -5, returnXPx: -1, returnYPx: 2, rotationDeg: 14, durationMs: 6_900, delayMs: -2_500, peakOpacity: 0.58 },
    { id: '3-r-c', lane: 'right', tone: 'blue', xPercent: 86.5, yPercent: 40, sizePx: 21, driftXPx: -5, driftYPx: 3, returnXPx: 2, returnYPx: -2, rotationDeg: -15, durationMs: 4_800, delayMs: -800, peakOpacity: 0.76 },
    { id: '3-r-d', lane: 'right', tone: 'gold', xPercent: 96, yPercent: 54, sizePx: 14, driftXPx: 2, driftYPx: -6, returnXPx: -2, returnYPx: 1, rotationDeg: 11, durationMs: 6_100, delayMs: -5_000, peakOpacity: 0.48 },
    { id: '3-r-e', lane: 'right', tone: 'blue', xPercent: 84.5, yPercent: 68, sizePx: 23, driftXPx: 4, driftYPx: 4, returnXPx: -1, returnYPx: -2, rotationDeg: 17, durationMs: 7_300, delayMs: -1_700, peakOpacity: 0.8 },
    { id: '3-r-f', lane: 'right', tone: 'gold', xPercent: 92, yPercent: 82, sizePx: 16, driftXPx: -3, driftYPx: -4, returnXPx: 1, returnYPx: 2, rotationDeg: -11, durationMs: 5_700, delayMs: -3_400, peakOpacity: 0.54 },
    { id: '3-r-g', lane: 'right', tone: 'blue', xPercent: 97, yPercent: 92, sizePx: 19, driftXPx: -4, driftYPx: -5, returnXPx: 2, returnYPx: 1, rotationDeg: -14, durationMs: 6_500, delayMs: -5_300, peakOpacity: 0.72 }
  ],
  4: [
    { id: '4-l-a', lane: 'left', tone: 'blue', xPercent: 5, yPercent: 8, sizePx: 19, driftXPx: 4, driftYPx: 3, returnXPx: -2, returnYPx: -1, rotationDeg: 12, durationMs: 5_300, delayMs: -3_200, peakOpacity: 0.72 },
    { id: '4-l-b', lane: 'left', tone: 'gold', xPercent: 13.5, yPercent: 21, sizePx: 18, driftXPx: -5, driftYPx: -4, returnXPx: 2, returnYPx: 1, rotationDeg: -16, durationMs: 7_300, delayMs: -1_000, peakOpacity: 0.58 },
    { id: '4-l-c', lane: 'left', tone: 'blue', xPercent: 7.5, yPercent: 34, sizePx: 22, driftXPx: 3, driftYPx: -5, returnXPx: -1, returnYPx: 2, rotationDeg: 9, durationMs: 4_900, delayMs: -4_400, peakOpacity: 0.78 },
    { id: '4-l-d', lane: 'left', tone: 'gold', xPercent: 15.5, yPercent: 48, sizePx: 15, driftXPx: -2, driftYPx: 6, returnXPx: 1, returnYPx: -2, rotationDeg: -13, durationMs: 6_200, delayMs: -2_600, peakOpacity: 0.52 },
    { id: '4-l-e', lane: 'left', tone: 'blue', xPercent: 4, yPercent: 62, sizePx: 24, driftXPx: 5, driftYPx: -3, returnXPx: -2, returnYPx: 2, rotationDeg: 17, durationMs: 7_500, delayMs: -900, peakOpacity: 0.82 },
    { id: '4-l-f', lane: 'left', tone: 'gold', xPercent: 11.5, yPercent: 77, sizePx: 13, driftXPx: -4, driftYPx: 4, returnXPx: 2, returnYPx: -1, rotationDeg: -10, durationMs: 5_400, delayMs: -4_800, peakOpacity: 0.46 },
    { id: '4-l-g', lane: 'left', tone: 'blue', xPercent: 15, yPercent: 91, sizePx: 20, driftXPx: 2, driftYPx: -5, returnXPx: -1, returnYPx: 2, rotationDeg: 14, durationMs: 6_600, delayMs: -3_600, peakOpacity: 0.74 },
    { id: '4-r-a', lane: 'right', tone: 'blue', xPercent: 85.5, yPercent: 11, sizePx: 21, driftXPx: -4, driftYPx: 5, returnXPx: 2, returnYPx: -2, rotationDeg: -11, durationMs: 6_000, delayMs: -4_900, peakOpacity: 0.76 },
    { id: '4-r-b', lane: 'right', tone: 'gold', xPercent: 91.5, yPercent: 25, sizePx: 14, driftXPx: 5, driftYPx: -3, returnXPx: -2, returnYPx: 1, rotationDeg: 15, durationMs: 5_000, delayMs: -1_800, peakOpacity: 0.48 },
    { id: '4-r-c', lane: 'right', tone: 'blue', xPercent: 86, yPercent: 39, sizePx: 24, driftXPx: -3, driftYPx: -6, returnXPx: 1, returnYPx: 2, rotationDeg: -17, durationMs: 7_400, delayMs: -3_500, peakOpacity: 0.82 },
    { id: '4-r-d', lane: 'right', tone: 'gold', xPercent: 95, yPercent: 53, sizePx: 17, driftXPx: 2, driftYPx: -4, returnXPx: -1, returnYPx: 2, rotationDeg: 10, durationMs: 5_700, delayMs: -700, peakOpacity: 0.56 },
    { id: '4-r-e', lane: 'right', tone: 'blue', xPercent: 84.5, yPercent: 67, sizePx: 18, driftXPx: 4, driftYPx: 3, returnXPx: -2, returnYPx: -1, rotationDeg: 13, durationMs: 5_600, delayMs: -2_900, peakOpacity: 0.7 },
    { id: '4-r-f', lane: 'right', tone: 'gold', xPercent: 92.5, yPercent: 81, sizePx: 15, driftXPx: -5, driftYPx: -4, returnXPx: 2, returnYPx: 2, rotationDeg: -14, durationMs: 6_900, delayMs: -5_200, peakOpacity: 0.54 },
    { id: '4-r-g', lane: 'right', tone: 'blue', xPercent: 97, yPercent: 92, sizePx: 22, driftXPx: -3, driftYPx: -5, returnXPx: 1, returnYPx: 2, rotationDeg: -12, durationMs: 6_300, delayMs: -1_400, peakOpacity: 0.78 }
  ],
  5: [
    { id: '5-l-a', lane: 'left', tone: 'blue', xPercent: 5.5, yPercent: 8, sizePx: 22, driftXPx: 5, driftYPx: -4, returnXPx: -2, returnYPx: 1, rotationDeg: 16, durationMs: 6_200, delayMs: -2_100, peakOpacity: 0.8 },
    { id: '5-l-b', lane: 'left', tone: 'gold', xPercent: 14.5, yPercent: 22, sizePx: 16, driftXPx: -3, driftYPx: 5, returnXPx: 2, returnYPx: -2, rotationDeg: -13, durationMs: 5_500, delayMs: -4_700, peakOpacity: 0.54 },
    { id: '5-l-c', lane: 'left', tone: 'blue', xPercent: 7, yPercent: 35, sizePx: 24, driftXPx: 4, driftYPx: 3, returnXPx: -1, returnYPx: -2, rotationDeg: 12, durationMs: 7_300, delayMs: -3_000, peakOpacity: 0.82 },
    { id: '5-l-d', lane: 'left', tone: 'gold', xPercent: 15.5, yPercent: 49, sizePx: 14, driftXPx: -4, driftYPx: -5, returnXPx: 2, returnYPx: 2, rotationDeg: -15, durationMs: 6_400, delayMs: -800, peakOpacity: 0.48 },
    { id: '5-l-e', lane: 'left', tone: 'blue', xPercent: 4, yPercent: 64, sizePx: 20, driftXPx: 3, driftYPx: -6, returnXPx: -2, returnYPx: 1, rotationDeg: 18, durationMs: 5_200, delayMs: -4_000, peakOpacity: 0.74 },
    { id: '5-l-f', lane: 'left', tone: 'gold', xPercent: 12, yPercent: 78, sizePx: 17, driftXPx: -2, driftYPx: 4, returnXPx: 1, returnYPx: -2, rotationDeg: -10, durationMs: 6_900, delayMs: -5_200, peakOpacity: 0.58 },
    { id: '5-l-g', lane: 'left', tone: 'blue', xPercent: 15, yPercent: 92, sizePx: 23, driftXPx: 4, driftYPx: -3, returnXPx: -1, returnYPx: 2, rotationDeg: 14, durationMs: 5_900, delayMs: -2_500, peakOpacity: 0.78 },
    { id: '5-r-a', lane: 'right', tone: 'blue', xPercent: 85, yPercent: 10, sizePx: 23, driftXPx: -5, driftYPx: 4, returnXPx: 2, returnYPx: -1, rotationDeg: -15, durationMs: 7_100, delayMs: -4_900, peakOpacity: 0.8 },
    { id: '5-r-b', lane: 'right', tone: 'gold', xPercent: 93, yPercent: 24, sizePx: 15, driftXPx: 3, driftYPx: -5, returnXPx: -2, returnYPx: 2, rotationDeg: 13, durationMs: 5_700, delayMs: -1_300, peakOpacity: 0.52 },
    { id: '5-r-c', lane: 'right', tone: 'blue', xPercent: 86, yPercent: 38, sizePx: 20, driftXPx: -4, driftYPx: -4, returnXPx: 1, returnYPx: 2, rotationDeg: -17, durationMs: 6_500, delayMs: -3_600, peakOpacity: 0.74 },
    { id: '5-r-d', lane: 'right', tone: 'gold', xPercent: 96, yPercent: 52, sizePx: 18, driftXPx: 2, driftYPx: 5, returnXPx: -1, returnYPx: -2, rotationDeg: 11, durationMs: 7_500, delayMs: -5_400, peakOpacity: 0.58 },
    { id: '5-r-e', lane: 'right', tone: 'blue', xPercent: 84.5, yPercent: 67, sizePx: 24, driftXPx: 5, driftYPx: -3, returnXPx: -2, returnYPx: 1, rotationDeg: 17, durationMs: 5_400, delayMs: -900, peakOpacity: 0.82 },
    { id: '5-r-f', lane: 'right', tone: 'gold', xPercent: 92, yPercent: 81, sizePx: 13, driftXPx: -3, driftYPx: -6, returnXPx: 2, returnYPx: 2, rotationDeg: -12, durationMs: 6_800, delayMs: -2_800, peakOpacity: 0.46 },
    { id: '5-r-g', lane: 'right', tone: 'blue', xPercent: 97, yPercent: 92, sizePx: 21, driftXPx: -4, driftYPx: 4, returnXPx: 1, returnYPx: -2, rotationDeg: -12, durationMs: 6_100, delayMs: -4_300, peakOpacity: 0.76 }
  ],
  6: [
    { id: '6-l-a', lane: 'left', tone: 'blue', xPercent: 5.5, yPercent: 9, sizePx: 24, driftXPx: 4, driftYPx: -4, returnXPx: -2, returnYPx: 1, rotationDeg: 15, durationMs: 6_100, delayMs: -1_900, peakOpacity: 0.82 },
    { id: '6-l-b', lane: 'left', tone: 'gold', xPercent: 14, yPercent: 22, sizePx: 15, driftXPx: -3, driftYPx: 5, returnXPx: 2, returnYPx: -2, rotationDeg: -12, durationMs: 5_400, delayMs: -4_600, peakOpacity: 0.54 },
    { id: '6-l-c', lane: 'left', tone: 'blue', xPercent: 8, yPercent: 36, sizePx: 20, driftXPx: 5, driftYPx: 3, returnXPx: -1, returnYPx: -2, rotationDeg: 11, durationMs: 7_200, delayMs: -3_100, peakOpacity: 0.76 },
    { id: '6-l-d', lane: 'left', tone: 'gold', xPercent: 15.5, yPercent: 50, sizePx: 17, driftXPx: -4, driftYPx: -5, returnXPx: 2, returnYPx: 2, rotationDeg: -16, durationMs: 6_500, delayMs: -900, peakOpacity: 0.58 },
    { id: '6-l-e', lane: 'left', tone: 'blue', xPercent: 4, yPercent: 64, sizePx: 22, driftXPx: 3, driftYPx: -6, returnXPx: -2, returnYPx: 1, rotationDeg: 17, durationMs: 5_100, delayMs: -3_900, peakOpacity: 0.8 },
    { id: '6-l-f', lane: 'left', tone: 'gold', xPercent: 12, yPercent: 78, sizePx: 13, driftXPx: -2, driftYPx: 4, returnXPx: 1, returnYPx: -2, rotationDeg: -9, durationMs: 6_800, delayMs: -5_300, peakOpacity: 0.46 },
    { id: '6-l-g', lane: 'left', tone: 'blue', xPercent: 15, yPercent: 91, sizePx: 19, driftXPx: 4, driftYPx: -3, returnXPx: -1, returnYPx: 2, rotationDeg: 13, durationMs: 5_800, delayMs: -2_400, peakOpacity: 0.72 },
    { id: '6-r-a', lane: 'right', tone: 'blue', xPercent: 85, yPercent: 11, sizePx: 21, driftXPx: -5, driftYPx: 4, returnXPx: 2, returnYPx: -1, rotationDeg: -14, durationMs: 7_000, delayMs: -4_800, peakOpacity: 0.78 },
    { id: '6-r-b', lane: 'right', tone: 'gold', xPercent: 93, yPercent: 25, sizePx: 16, driftXPx: 3, driftYPx: -5, returnXPx: -2, returnYPx: 2, rotationDeg: 12, durationMs: 5_600, delayMs: -1_200, peakOpacity: 0.56 },
    { id: '6-r-c', lane: 'right', tone: 'blue', xPercent: 86.5, yPercent: 39, sizePx: 24, driftXPx: -4, driftYPx: -4, returnXPx: 1, returnYPx: 2, rotationDeg: -18, durationMs: 6_300, delayMs: -3_500, peakOpacity: 0.82 },
    { id: '6-r-d', lane: 'right', tone: 'gold', xPercent: 96, yPercent: 53, sizePx: 14, driftXPx: 2, driftYPx: 5, returnXPx: -1, returnYPx: -2, rotationDeg: 10, durationMs: 7_400, delayMs: -5_500, peakOpacity: 0.48 },
    { id: '6-r-e', lane: 'right', tone: 'blue', xPercent: 84.5, yPercent: 67, sizePx: 20, driftXPx: 5, driftYPx: -3, returnXPx: -2, returnYPx: 1, rotationDeg: 16, durationMs: 5_300, delayMs: -800, peakOpacity: 0.74 },
    { id: '6-r-f', lane: 'right', tone: 'gold', xPercent: 92, yPercent: 81, sizePx: 18, driftXPx: -3, driftYPx: -6, returnXPx: 2, returnYPx: 2, rotationDeg: -13, durationMs: 6_700, delayMs: -2_900, peakOpacity: 0.58 },
    { id: '6-r-g', lane: 'right', tone: 'blue', xPercent: 97, yPercent: 92, sizePx: 22, driftXPx: -4, driftYPx: 4, returnXPx: 1, returnYPx: -2, rotationDeg: -11, durationMs: 6_000, delayMs: -4_200, peakOpacity: 0.78 }
  ]
}

export const isGrowthAmbientStarsNode = (node: GrowthNode): node is GrowthAmbientStarsNode =>
  node === 2 || node === 3 || node === 4 || node === 5 || node === 6

export const getGrowthAmbientStarLayout = (node: GrowthAmbientStarsNode) => LAYOUTS[node]

const toLaneXPercent = (particle: GrowthAmbientStarPlacement): number => particle.lane === 'left'
  ? particle.xPercent / GROWTH_AMBIENT_LANE_WIDTH_PERCENT * 100
  : (particle.xPercent - (100 - GROWTH_AMBIENT_LANE_WIDTH_PERCENT)) / GROWTH_AMBIENT_LANE_WIDTH_PERCENT * 100

const toStyle = (particle: GrowthAmbientStarPlacement, spriteUrl: string): AmbientStarStyle => ({
  '--growth-ambient-x': `${toLaneXPercent(particle)}%`,
  '--growth-ambient-y': `${particle.yPercent}%`,
  '--growth-ambient-size': `${particle.sizePx}px`,
  '--growth-ambient-drift-x': `${particle.driftXPx}px`,
  '--growth-ambient-drift-y': `${particle.driftYPx}px`,
  '--growth-ambient-return-x': `${particle.returnXPx}px`,
  '--growth-ambient-return-y': `${particle.returnYPx}px`,
  '--growth-ambient-rotation': `${particle.rotationDeg}deg`,
  '--growth-ambient-return-rotation': `${particle.rotationDeg * -0.35}deg`,
  '--growth-ambient-duration': `${particle.durationMs}ms`,
  '--growth-ambient-delay': `${particle.delayMs}ms`,
  '--growth-ambient-base-opacity': String(particle.peakOpacity * (particle.tone === 'blue' ? 0.24 : 0.16)),
  '--growth-ambient-peak-opacity': String(particle.peakOpacity),
  '--growth-ambient-return-opacity': String(particle.peakOpacity * (particle.tone === 'blue' ? 0.7 : 0.58)),
  '--growth-ambient-star-sprite': `url("${spriteUrl.replaceAll('"', '%22')}")`
})

export function GrowthAmbientStars({ node, spriteUrl }: GrowthAmbientStarsProps) {
  if (!isGrowthAmbientStarsNode(node)) return null

  const particles = LAYOUTS[node]
  const lanes: readonly GrowthAmbientStarLane[] = ['left', 'right']

  return <span
    className="growth-ambient-stars"
    data-growth-ambient-effect="star_tide_perimeter_v1"
    data-growth-ambient-particle-count={particles.length}
    aria-hidden="true"
  >
    {lanes.map((lane) => <span
      className={`growth-ambient-stars__lane growth-ambient-stars__lane--${lane}`}
      data-growth-ambient-lane={lane}
      key={lane}
    >
      {particles.filter((particle) => particle.lane === lane).map((particle) => <span
        className="growth-ambient-stars__particle"
        data-growth-ambient-tone={particle.tone}
        key={particle.id}
        style={toStyle(particle, spriteUrl)}
      />)}
    </span>)}
  </span>
}
