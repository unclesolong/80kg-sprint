import { ArrowLeft, Check, ClipboardList, Scale, ShieldCheck } from 'lucide-react'
import { AICommentCard } from '../components/planner/AICommentCard'
import { aggregateWeek, buildLocalWeeklyComment, buildNextWeekVersion } from '../planner/weeklyAggregation'
import type { FatLossPlan, PlanVersion, WeeklyReview } from '../planner/types'
import type { DailyLog } from '../types'

const dateShift = (date: string, days: number) => { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10) }
const startOfWeek = (date: string) => { const value = new Date(`${date}T12:00:00Z`); const day = value.getUTCDay() || 7; return dateShift(date, 1 - day) }
const display = (value: number | undefined, unit: string, digits = 0) => value == null ? '—' : `${value.toLocaleString('zh-TW', { maximumFractionDigits: digits })} ${unit}`

export function WeeklyReviewPage({ today, logs, plan, version, onBack, onApply }: { today: string; logs: DailyLog[]; plan: FatLossPlan; version: PlanVersion; onBack: () => void; onApply: (version: PlanVersion, review: WeeklyReview) => Promise<void> }) {
  const weekStart = startOfWeek(today)
  const weekEnd = dateShift(weekStart, 6)
  const previousStart = dateShift(weekStart, -7)
  const previousEnd = dateShift(weekStart, -1)
  const previousLogs = logs.filter((log) => log.date >= previousStart && log.date <= previousEnd)
  const { dataCompleteness, summary } = aggregateWeek(logs, weekStart, weekEnd, previousLogs)
  const local = buildLocalWeeklyComment(summary, dataCompleteness)
  const nextStart = dateShift(weekStart, 7)
  const nextVersion = buildNextWeekVersion(version, nextStart, local.comment)
  const apply = async () => {
    const now = new Date().toISOString()
    const review: WeeklyReview = { id: `review-${weekStart}`, planId: plan.id, weekStart, weekEnd, dataCompleteness, summary, currentVersionId: version.id, suggestedVersionDraft: { ...nextVersion }, comment: local.comment, warnings: local.warnings, status: 'applied', createdAt: now }
    await onApply(nextVersion, review)
  }
  return <section className="planner-stack-page weekly-review-page"><header className="planner-stack-header"><button aria-label="返回計畫" onClick={onBack}><ArrowLeft /></button><div><p className="eyebrow">WEEKLY REVIEW</p><h1>本週檢討</h1></div></header><article className="weekly-decision health-card"><div><ShieldCheck /><span>本週判定</span></div><strong>{local.decision === 'maintain' ? '維持計畫' : local.decision === 'recovery_priority' ? '恢復優先' : '先改善資料'}</strong><p>{weekStart} 至 {weekEnd}</p></article><div className="weekly-metrics"><article className="health-card"><Scale /><span>平均晨重</span><strong>{display(summary.averageMorningWeightKg, 'kg', 1)}</strong><small>{summary.morningWeightCount} 筆</small></article><article className="health-card"><ClipboardList /><span>資料完整度</span><strong>{dataCompleteness}%</strong><small>{summary.finalizedDayCount} 天已結算</small></article><article className="health-card"><span>平均攝取</span><strong>{display(summary.averageIntakeKcal, 'kcal')}</strong></article><article className="health-card"><span>平均活動</span><strong>{display(summary.averageActiveKcal, 'kcal')}</strong></article></div><AICommentCard comment={local.comment} />
    <article className="plan-adjustment-draft health-card"><header><span>目前設定 vs 下週草稿</span><strong>不自動修改</strong></header><dl><div><dt>每日熱量</dt><dd>{version.calorieTargetKcal} → {nextVersion.calorieTargetKcal} kcal</dd></div><div><dt>每週有氧</dt><dd>{version.aerobicMinutesPerWeek} → {nextVersion.aerobicMinutesPerWeek} 分</dd></div><div><dt>每週肌力</dt><dd>{version.strengthDaysPerWeek} → {nextVersion.strengthDaysPerWeek} 次</dd></div></dl><p>{local.warnings[0] ?? '本地規則目前建議維持設定。'}</p></article><button className="primary weekly-apply" type="button" onClick={() => void apply()}><Check />套用為下週設定</button>
  </section>
}
