import type { FatLossPlan, PlannerSnapshot, PlanVersion } from './types'

export interface DailyPlanTargetRow {
  key: 'intake' | 'active' | 'resting' | 'tdee'
  label: string
  valueKcal: number
  kind: 'target' | 'estimate'
}

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

/** Rows for Today/home. Legacy versions intentionally return intake only instead of inventing energy values. */
export const selectDailyPlanTargetRows = (version: PlanVersion | undefined): DailyPlanTargetRow[] => {
  if (!version) return []
  const rows: DailyPlanTargetRow[] = [{ key: 'intake', label: '攝取熱量目標', valueKcal: version.calorieTargetKcal, kind: 'target' }]
  if (!version.energyPlan) return rows
  return [
    ...rows,
    { key: 'active', label: '活動能量參考', valueKcal: version.energyPlan.activeEnergyKcal, kind: 'target' },
    { key: 'resting', label: '靜止能量估計', valueKcal: version.energyPlan.restingEnergyKcal, kind: 'estimate' },
    { key: 'tdee', label: '每日總消耗估計', valueKcal: version.energyPlan.estimatedTdeeKcal, kind: 'estimate' }
  ]
}
