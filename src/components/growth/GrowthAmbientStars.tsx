import type { CSSProperties } from 'react'
import type { GrowthNode } from './types'

export type GrowthAmbientStarsNode = 2 | 3 | 4

export interface GrowthAmbientStarPlacement {
  id: string
  lane: 'left' | 'right'
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
    { id: '2-l-a', lane: 'left', xPercent: 4.5, yPercent: 18, sizePx: 14, driftXPx: 4, driftYPx: -5, returnXPx: 1, returnYPx: 2, rotationDeg: 14, durationMs: 5_600, delayMs: -1_100, peakOpacity: 0.42 },
    { id: '2-l-b', lane: 'left', xPercent: 11, yPercent: 39, sizePx: 18, driftXPx: -3, driftYPx: 4, returnXPx: 2, returnYPx: -1, rotationDeg: -11, durationMs: 6_800, delayMs: -4_300, peakOpacity: 0.48 },
    { id: '2-l-c', lane: 'left', xPercent: 14, yPercent: 65, sizePx: 12, driftXPx: 3, driftYPx: -4, returnXPx: -1, returnYPx: 2, rotationDeg: 9, durationMs: 4_900, delayMs: -2_700, peakOpacity: 0.38 },
    { id: '2-l-d', lane: 'left', xPercent: 7, yPercent: 84, sizePx: 16, driftXPx: -2, driftYPx: -6, returnXPx: 2, returnYPx: -2, rotationDeg: -16, durationMs: 7_200, delayMs: -5_200, peakOpacity: 0.44 },
    { id: '2-r-a', lane: 'right', xPercent: 86, yPercent: 23, sizePx: 13, driftXPx: -4, driftYPx: 3, returnXPx: 1, returnYPx: -2, rotationDeg: -12, durationMs: 5_200, delayMs: -3_600, peakOpacity: 0.4 },
    { id: '2-r-b', lane: 'right', xPercent: 90, yPercent: 44, sizePx: 19, driftXPx: 3, driftYPx: -5, returnXPx: -2, returnYPx: 1, rotationDeg: 15, durationMs: 7_000, delayMs: -900, peakOpacity: 0.5 },
    { id: '2-r-c', lane: 'right', xPercent: 95, yPercent: 68, sizePx: 11, driftXPx: -2, driftYPx: 4, returnXPx: 1, returnYPx: -2, rotationDeg: -8, durationMs: 4_700, delayMs: -2_100, peakOpacity: 0.36 },
    { id: '2-r-d', lane: 'right', xPercent: 86, yPercent: 87, sizePx: 15, driftXPx: 4, driftYPx: -3, returnXPx: -2, returnYPx: 2, rotationDeg: 12, durationMs: 6_300, delayMs: -4_900, peakOpacity: 0.43 }
  ],
  3: [
    { id: '3-l-a', lane: 'left', xPercent: 6, yPercent: 14, sizePx: 16, driftXPx: 3, driftYPx: 5, returnXPx: -1, returnYPx: -2, rotationDeg: 13, durationMs: 6_400, delayMs: -2_200, peakOpacity: 0.45 },
    { id: '3-l-b', lane: 'left', xPercent: 14, yPercent: 34, sizePx: 12, driftXPx: -4, driftYPx: -3, returnXPx: 2, returnYPx: 1, rotationDeg: -9, durationMs: 5_100, delayMs: -4_600, peakOpacity: 0.37 },
    { id: '3-l-c', lane: 'left', xPercent: 8.5, yPercent: 61, sizePx: 19, driftXPx: 5, driftYPx: -4, returnXPx: -2, returnYPx: 2, rotationDeg: 16, durationMs: 7_100, delayMs: -1_300, peakOpacity: 0.5 },
    { id: '3-l-d', lane: 'left', xPercent: 14.5, yPercent: 86, sizePx: 13, driftXPx: -3, driftYPx: -5, returnXPx: 1, returnYPx: 2, rotationDeg: -14, durationMs: 5_800, delayMs: -3_700, peakOpacity: 0.4 },
    { id: '3-r-a', lane: 'right', xPercent: 85.5, yPercent: 17, sizePx: 14, driftXPx: -3, driftYPx: 4, returnXPx: 2, returnYPx: -1, rotationDeg: -10, durationMs: 5_500, delayMs: -4_100, peakOpacity: 0.42 },
    { id: '3-r-b', lane: 'right', xPercent: 93, yPercent: 38, sizePx: 18, driftXPx: 4, driftYPx: -5, returnXPx: -1, returnYPx: 2, rotationDeg: 14, durationMs: 6_900, delayMs: -2_500, peakOpacity: 0.49 },
    { id: '3-r-c', lane: 'right', xPercent: 86.5, yPercent: 66, sizePx: 11, driftXPx: -5, driftYPx: 3, returnXPx: 2, returnYPx: -2, rotationDeg: -15, durationMs: 4_800, delayMs: -800, peakOpacity: 0.35 },
    { id: '3-r-d', lane: 'right', xPercent: 96, yPercent: 83, sizePx: 15, driftXPx: 2, driftYPx: -6, returnXPx: -2, returnYPx: 1, rotationDeg: 11, durationMs: 6_100, delayMs: -5_000, peakOpacity: 0.43 }
  ],
  4: [
    { id: '4-l-a', lane: 'left', xPercent: 5, yPercent: 12, sizePx: 13, driftXPx: 4, driftYPx: 3, returnXPx: -2, returnYPx: -1, rotationDeg: 12, durationMs: 5_300, delayMs: -3_200, peakOpacity: 0.4 },
    { id: '4-l-b', lane: 'left', xPercent: 13.5, yPercent: 31, sizePx: 18, driftXPx: -5, driftYPx: -4, returnXPx: 2, returnYPx: 1, rotationDeg: -16, durationMs: 7_300, delayMs: -1_000, peakOpacity: 0.5 },
    { id: '4-l-c', lane: 'left', xPercent: 7.5, yPercent: 58, sizePx: 11, driftXPx: 3, driftYPx: -5, returnXPx: -1, returnYPx: 2, rotationDeg: 9, durationMs: 4_900, delayMs: -4_400, peakOpacity: 0.35 },
    { id: '4-l-d', lane: 'left', xPercent: 14.5, yPercent: 82, sizePx: 15, driftXPx: -2, driftYPx: 6, returnXPx: 1, returnYPx: -2, rotationDeg: -13, durationMs: 6_200, delayMs: -2_600, peakOpacity: 0.44 },
    { id: '4-r-a', lane: 'right', xPercent: 85.5, yPercent: 14, sizePx: 15, driftXPx: -4, driftYPx: 5, returnXPx: 2, returnYPx: -2, rotationDeg: -11, durationMs: 6_000, delayMs: -4_900, peakOpacity: 0.43 },
    { id: '4-r-b', lane: 'right', xPercent: 91.5, yPercent: 36, sizePx: 12, driftXPx: 5, driftYPx: -3, returnXPx: -2, returnYPx: 1, rotationDeg: 15, durationMs: 5_000, delayMs: -1_800, peakOpacity: 0.37 },
    { id: '4-r-c', lane: 'right', xPercent: 86, yPercent: 63, sizePx: 19, driftXPx: -3, driftYPx: -6, returnXPx: 1, returnYPx: 2, rotationDeg: -17, durationMs: 7_400, delayMs: -3_500, peakOpacity: 0.5 },
    { id: '4-r-d', lane: 'right', xPercent: 95, yPercent: 86, sizePx: 13, driftXPx: 2, driftYPx: -4, returnXPx: -1, returnYPx: 2, rotationDeg: 10, durationMs: 5_700, delayMs: -700, peakOpacity: 0.39 }
  ]
}

export const isGrowthAmbientStarsNode = (node: GrowthNode): node is GrowthAmbientStarsNode =>
  node === 2 || node === 3 || node === 4

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
  '--growth-ambient-peak-opacity': String(particle.peakOpacity),
  '--growth-ambient-return-opacity': String(particle.peakOpacity * 0.58),
  '--growth-ambient-star-sprite': `url("${spriteUrl.replaceAll('"', '%22')}")`
})

export function GrowthAmbientStars({ node, spriteUrl }: GrowthAmbientStarsProps) {
  if (!isGrowthAmbientStarsNode(node)) return null

  const particles = LAYOUTS[node]
  const lanes: readonly GrowthAmbientStarLane[] = ['left', 'right']

  return <span
    className="growth-ambient-stars"
    data-growth-ambient-effect="star_tide_perimeter_v1"
    data-growth-ambient-particle-count="8"
    aria-hidden="true"
  >
    {lanes.map((lane) => <span
      className={`growth-ambient-stars__lane growth-ambient-stars__lane--${lane}`}
      data-growth-ambient-lane={lane}
      key={lane}
    >
      {particles.filter((particle) => particle.lane === lane).map((particle) => <span
        className="growth-ambient-stars__particle"
        key={particle.id}
        style={toStyle(particle, spriteUrl)}
      />)}
    </span>)}
  </span>
}
