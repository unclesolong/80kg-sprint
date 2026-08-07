import { emptyPlannerSnapshot } from './planSelectors'
import type { PlannerSnapshot } from './types'

export interface PlannerBackupPayload {
  schemaVersion: 1
  exportedAt: string
  planner: PlannerSnapshot
}

export const makePlannerBackup = (planner: PlannerSnapshot): PlannerBackupPayload => ({
  schemaVersion: 1,
  exportedAt: new Date().toISOString(),
  planner: JSON.parse(JSON.stringify(planner)) as PlannerSnapshot
})

const array = (value: unknown): value is unknown[] => Array.isArray(value)

export const validatePlannerBackup = (value: unknown): value is PlannerBackupPayload => {
  if (!value || typeof value !== 'object') return false
  const payload = value as Partial<PlannerBackupPayload>
  const planner = payload.planner as Partial<PlannerSnapshot> | undefined
  return payload.schemaVersion === 1 && typeof payload.exportedAt === 'string' && Boolean(planner) &&
    array(planner?.plans) && array(planner?.planVersions) && array(planner?.weeklyReviews) && array(planner?.consents) && array(planner?.foodMetadata)
}

export const normalizePlannerBackup = (payload: PlannerBackupPayload): PlannerSnapshot => ({ ...emptyPlannerSnapshot(), ...payload.planner })
