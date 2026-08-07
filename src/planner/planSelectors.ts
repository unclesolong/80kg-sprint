import type { FatLossPlan, PlannerSnapshot, PlanVersion } from './types'

export const emptyPlannerSnapshot = (): PlannerSnapshot => ({ plans: [], planVersions: [], weeklyReviews: [], consents: [], foodMetadata: [] })

export const selectActivePlan = (snapshot: PlannerSnapshot): FatLossPlan | undefined =>
  [...snapshot.plans].filter((plan) => plan.status === 'active').sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1)

export const selectPlanVersionForDate = (versions: PlanVersion[], planId: string, date: string): PlanVersion | undefined =>
  [...versions].filter((version) => version.planId === planId && version.effectiveFrom <= date).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)).at(-1)

export const selectPlanVersionByEffectiveDate = (versions: PlanVersion[], planId: string, effectiveFrom: string): PlanVersion | undefined =>
  versions.find((version) => version.planId === planId && version.effectiveFrom === effectiveFrom)

export const appendPlanVersion = (snapshot: PlannerSnapshot, version: PlanVersion): PlannerSnapshot => ({
  ...snapshot,
  planVersions: [...snapshot.planVersions.filter((item) => item.id !== version.id), version]
})
