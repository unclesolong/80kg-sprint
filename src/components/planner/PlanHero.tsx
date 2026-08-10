import { PlanDashboardHero } from '../home/PlanDashboardHero'
import type { FatLossPlan, PlanVersion, UserProfile, WeeklyReview } from '../../planner/types'
import type { DailyLog } from '../../types'
import type { TodayDashboardModel } from '../../viewModels/todayDashboard'

export interface PlanHeroProps {
  today: string
  log: DailyLog
  plan: FatLossPlan
  version: PlanVersion
  latestReview?: WeeklyReview
  profile?: UserProfile
  currentWeight?: number
  dashboard: TodayDashboardModel
  onOpenPlan: () => void
  onOpenWeeklyReview: () => void
}

/**
 * Compatibility boundary for the existing Planner home callback surface.
 * Secondary Planner insight/review content now renders below the daily sections.
 */
export function PlanHero({ dashboard, onOpenPlan }: PlanHeroProps) {
  return <PlanDashboardHero model={dashboard} onOpenPlan={onOpenPlan} />
}
