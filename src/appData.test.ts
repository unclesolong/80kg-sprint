import { describe, expect, it } from 'vitest'
import { loadApplicationData } from './appData'

describe('loadApplicationData Planner failure isolation', () => {
  it('always returns a truthy safety error when Planner loading rejects', async () => {
    const result = await loadApplicationData(
      async () => ({ core: 'loaded' }),
      async () => { throw new Error('') }
    )

    expect(result.legacy).toEqual({ core: 'loaded' })
    expect(result.plannerError).toBe('Planner DB 無法開啟')
    expect(Boolean(result.plannerError)).toBe(true)
    expect(result.planner).toMatchObject({ plans: [], planVersions: [], weeklyReviews: [] })
  })
})
