import type { GrowthNode } from './types'

export type GrowthStageAuthoredMotion = 'primary' | 'secondary'
export type GrowthStagePrimaryCycleTarget = number

export interface GrowthStageMotionSchedule {
  motion: GrowthStageAuthoredMotion
  primaryCyclesCompleted: number
  primaryCycleTarget: GrowthStagePrimaryCycleTarget
  secondaryPlaysCompleted: number
}

export interface GrowthStageSecondaryPrewarmDataSignals {
  saveData?: boolean
  effectiveType?: string
  prefersReducedData?: boolean
}

export const permitsGrowthStageSecondaryPrewarm = ({
  saveData = false,
  effectiveType,
  prefersReducedData = false
}: GrowthStageSecondaryPrewarmDataSignals): boolean => !saveData
  && effectiveType !== 'slow-2g'
  && effectiveType !== '2g'
  && !prefersReducedData

/**
 * Produces a stable cadence without random timers. The first authored action
 * appears after 8-14 idle loops; later appearances vary between 11-22 loops so
 * the larger action remains special during a long stage.
 */
export const getGrowthStagePrimaryCycleTarget = (
  node: GrowthNode,
  secondaryPlaysCompleted: number
): GrowthStagePrimaryCycleTarget => secondaryPlaysCompleted === 0
  ? 8 + ((node * 5 + 2) % 7)
  : 11 + ((node * 7 + secondaryPlaysCompleted * 5) % 12)

export const createGrowthStageMotionSchedule = (node: GrowthNode): GrowthStageMotionSchedule => ({
  motion: 'primary',
  primaryCyclesCompleted: 0,
  primaryCycleTarget: getGrowthStagePrimaryCycleTarget(node, 0),
  secondaryPlaysCompleted: 0
})

/** Advances exactly one authored-video boundary. Both clips must share a neutral seam. */
export const advanceGrowthStageMotionSchedule = (
  node: GrowthNode,
  schedule: GrowthStageMotionSchedule,
  secondaryReady = true
): GrowthStageMotionSchedule => {
  if (schedule.motion === 'secondary') {
    const secondaryPlaysCompleted = schedule.secondaryPlaysCompleted + 1
    return {
      motion: 'primary',
      primaryCyclesCompleted: 0,
      primaryCycleTarget: getGrowthStagePrimaryCycleTarget(node, secondaryPlaysCompleted),
      secondaryPlaysCompleted
    }
  }

  const primaryCyclesCompleted = schedule.primaryCyclesCompleted + 1
  if (primaryCyclesCompleted < schedule.primaryCycleTarget) {
    return { ...schedule, primaryCyclesCompleted }
  }

  if (!secondaryReady) {
    return { ...schedule, primaryCyclesCompleted: schedule.primaryCycleTarget }
  }

  return {
    ...schedule,
    motion: 'secondary',
    primaryCyclesCompleted: 0
  }
}
