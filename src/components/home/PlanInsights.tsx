import { ChevronRight } from 'lucide-react'
import type { PlanVersion, WeeklyReview } from '../../planner/types'
import { AICommentCard } from '../planner/AICommentCard'

export function PlanInsights({ version, latestReview, onOpenWeeklyReview }: {
  version: PlanVersion
  latestReview?: WeeklyReview
  onOpenWeeklyReview: () => void
}) {
  return <details className="v6-home-insights standard-card">
    <summary>計畫建議與本週檢討</summary>
    <div className="v6-home-insights__body">
      <AICommentCard comment={latestReview?.comment ?? version.comment} source={latestReview?.suggestedVersionDraft?.createdBy === 'ai_assisted' ? 'AI 每週建議' : '本地規則提醒'} />
      <button type="button" className="weekly-review-entry" onClick={onOpenWeeklyReview}><span>本週檢討</span><strong>查看資料完整度與下週重點</strong><small>{latestReview ? `最近已檢討：${latestReview.weekStart} 至 ${latestReview.weekEnd}` : '本地規則先彙整，不會自動修改設定。'}</small><ChevronRight aria-hidden="true" /></button>
    </div>
  </details>
}
