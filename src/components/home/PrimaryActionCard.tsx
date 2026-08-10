import { ChevronRight } from 'lucide-react'
import type { TodayDashboardModel } from '../../viewModels/todayDashboard'

export function PrimaryActionCard({ action, onOpen }: {
  action: TodayDashboardModel['primaryAction']
  onOpen: (stage: TodayDashboardModel['primaryAction']['stage']) => void
}) {
  return <button type="button" className={`v6-home-primary-action next-action standard-card ${action.tone}`} onClick={() => onOpen(action.stage)}>
    <span>今日唯一行動</span>
    <strong>{action.title}</strong>
    <small>{action.detail}</small>
    <ChevronRight aria-hidden="true" />
  </button>
}
