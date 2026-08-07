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
    return { legacy, planner: emptyPlannerSnapshot(), plannerError: error instanceof Error ? error.message : 'Planner DB 無法開啟' }
  }
}
