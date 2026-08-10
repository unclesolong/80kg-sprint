import { emptyPlannerSnapshot } from './planner/planSelectors'
import type { PlannerSnapshot } from './planner/types'

type Loader<T> = () => Promise<T>

export const loadApplicationData = async <TLegacy>(
  loadLegacy: Loader<TLegacy>,
  loadPlanner: Loader<PlannerSnapshot>
) => {
  const legacy = await loadLegacy()
  try {
    return { legacy, planner: await loadPlanner(), plannerError: undefined }
  } catch (error) {
    const message = error instanceof Error ? error.message.trim() : ''
    return { legacy, planner: emptyPlannerSnapshot(), plannerError: message || 'Planner DB 無法開啟' }
  }
}
