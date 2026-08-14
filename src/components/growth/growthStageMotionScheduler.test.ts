import { describe, expect, it } from 'vitest'
import {
  advanceGrowthStageMotionSchedule,
  createGrowthStageMotionSchedule,
  getGrowthStagePrimaryCycleTarget,
  permitsGrowthStageSecondaryPrewarm
} from './growthStageMotionScheduler'
import type { GrowthNode } from './types'

describe('growth stage secondary-motion scheduler', () => {
  it('chooses deterministic first and subsequent cadence windows', () => {
    for (let node = 1 as GrowthNode; node <= 12; node = (node + 1) as GrowthNode) {
      const firstPass = Array.from({ length: 24 }, (_, run) => getGrowthStagePrimaryCycleTarget(node, run))
      const secondPass = Array.from({ length: 24 }, (_, run) => getGrowthStagePrimaryCycleTarget(node, run))
      expect(secondPass).toEqual(firstPass)
      expect(firstPass[0]).toBeGreaterThanOrEqual(8)
      expect(firstPass[0]).toBeLessThanOrEqual(14)
      expect(firstPass.slice(1).every((target) => target >= 11 && target <= 22)).toBe(true)
    }
  })

  it('plays one secondary after the target primary cycles, then returns to primary', () => {
    const node = 2
    let schedule = createGrowthStageMotionSchedule(node)
    expect(schedule.primaryCycleTarget).toBe(13)

    for (let cycle = 0; cycle < 12; cycle += 1) {
      schedule = advanceGrowthStageMotionSchedule(node, schedule)
    }
    expect(schedule).toMatchObject({ motion: 'primary', primaryCyclesCompleted: 12 })

    schedule = advanceGrowthStageMotionSchedule(node, schedule)
    expect(schedule).toMatchObject({ motion: 'secondary', primaryCyclesCompleted: 0 })

    schedule = advanceGrowthStageMotionSchedule(node, schedule)
    expect(schedule).toMatchObject({
      motion: 'primary',
      primaryCyclesCompleted: 0,
      primaryCycleTarget: 18,
      secondaryPlaysCompleted: 1
    })
  })

  it('holds at the due primary seam until the secondary response is fully ready', () => {
    const node = 2
    let schedule = createGrowthStageMotionSchedule(node)
    for (let cycle = 0; cycle < 13; cycle += 1) {
      schedule = advanceGrowthStageMotionSchedule(node, schedule, false)
    }
    expect(schedule).toMatchObject({ motion: 'primary', primaryCyclesCompleted: 13 })

    schedule = advanceGrowthStageMotionSchedule(node, schedule, false)
    expect(schedule).toMatchObject({ motion: 'primary', primaryCyclesCompleted: 13 })

    schedule = advanceGrowthStageMotionSchedule(node, schedule, true)
    expect(schedule).toMatchObject({ motion: 'secondary', primaryCyclesCompleted: 0 })
  })

  it('blocks prewarming for every reduced-data network signal', () => {
    expect(permitsGrowthStageSecondaryPrewarm({})).toBe(true)
    expect(permitsGrowthStageSecondaryPrewarm({ effectiveType: '3g' })).toBe(true)
    expect(permitsGrowthStageSecondaryPrewarm({ effectiveType: '4g' })).toBe(true)
    expect(permitsGrowthStageSecondaryPrewarm({ saveData: true })).toBe(false)
    expect(permitsGrowthStageSecondaryPrewarm({ effectiveType: 'slow-2g' })).toBe(false)
    expect(permitsGrowthStageSecondaryPrewarm({ effectiveType: '2g' })).toBe(false)
    expect(permitsGrowthStageSecondaryPrewarm({ prefersReducedData: true })).toBe(false)
  })
})
