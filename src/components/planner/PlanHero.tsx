import { Activity, CalendarRange, Droplets, Footprints, Target, Utensils } from 'lucide-react'
import { activityTotals, daysBetween } from '../../calculations'
import { ensureMealDetails } from '../../mealOperations'
import { dinnerMainBudget } from '../../planner/planCalculations'
import type { FatLossPlan, PlanVersion, UserProfile } from '../../planner/types'
import type { DailyLog } from '../../types'
import { AICommentCard } from './AICommentCard'

const amount = (value?: number, digits = 0) => value == null ? '—' : value.toLocaleString('zh-TW', { minimumFractionDigits: digits, maximumFractionDigits: digits })

export function PlanHero({ today, log, plan, version, profile, currentWeight, onOpenPlan, onOpenWeeklyReview }: { today: string; log: DailyLog; plan: FatLossPlan; version: PlanVersion; profile?: UserProfile; currentWeight?: number; onOpenPlan: () => void; onOpenWeeklyReview: () => void }) {
  const startWeight = profile?.currentWeightKg ?? currentWeight ?? plan.goalWeightKg
  const totalChange = Math.max(0.1, startWeight - plan.goalWeightKg)
  const progress = currentWeight == null ? 0 : Math.max(0, Math.min(100, (startWeight - currentWeight) / totalChange * 100))
  const week = Math.max(1, Math.floor(daysBetween(plan.startDate, today) / 7) + 1)
  const details = ensureMealDetails(log)
  const reserveLogged = [...details.breakfast, ...details.lunch, ...details.dinner, ...details.evening].some((line) => line.templateId && version.reservedTemplateIds.includes(line.templateId))
  const dinnerBudget = dinnerMainBudget(version.calorieTargetKcal, log.intakeKcal, version.eveningReserveKcal, reserveLogged)
  const activity = activityTotals(log).effectiveActiveKcal
  return <>
    <header className="plan-hero health-card"><div className="plan-hero__glow" /><div className="plan-hero__top"><span>第 {week} 週 · 長期計畫</span><button type="button" onClick={onOpenPlan}>查看計畫</button></div><div className="plan-hero__weight"><div><small>目前</small><strong>{amount(currentWeight, 1)}<span>kg</span></strong></div><Target aria-hidden="true" /><div><small>目標</small><strong>{amount(plan.goalWeightKg, 1)}<span>kg</span></strong></div></div><p>距離目標 {currentWeight == null ? '—' : amount(Math.max(0, currentWeight - plan.goalWeightKg), 1)} kg</p><div className="plan-hero__progress" aria-label={`計畫進度 ${Math.round(progress)}%`}><i style={{ width: `${progress}%` }} /></div><div className="plan-hero__meta"><span><CalendarRange />預計至 {version.goalDate}</span><span>{Math.round(progress)}%</span></div></header>
    <div className="plan-metric-grid">
      <article className="metric-progress-card health-card"><Utensils /><span>熱量</span><strong>{amount(log.intakeKcal)} <small>/ {amount(version.calorieTargetKcal)} kcal</small></strong></article>
      <article className="metric-progress-card health-card"><Activity /><span>蛋白質</span><strong>{amount(log.proteinG)} <small>/ {amount(version.proteinMinG)} g</small></strong></article>
      <article className="metric-progress-card health-card"><Droplets /><span>白開水</span><strong>{amount(log.waterMl)} <small>/ {amount(version.waterTargetMl)} ml</small></strong></article>
      <article className="metric-progress-card health-card"><Footprints /><span>活動</span><strong>{amount(activity)} <small>kcal</small></strong></article>
    </div>
    <article className="planner-dinner-card health-card"><div><Utensils aria-hidden="true" /><span>晚餐主餐預算</span></div><strong>{amount(dinnerBudget)} <small>kcal</small></strong><p>{dinnerBudget > 0 ? reserveLogged ? '預留項目已記錄，不會重複扣除。' : `另預留晚間點心 ${version.eveningReserveKcal} kcal` : '今日原定預算已用完；晚餐照常以蛋白質與蔬菜為主，無需跳過正餐。'}</p></article>
    <AICommentCard comment={version.comment} />
    <button type="button" className="weekly-review-entry health-card" onClick={onOpenWeeklyReview}><span>本週檢討</span><strong>查看資料完整度與下週重點</strong><small>本地規則先彙整，不會自動修改設定。</small></button>
  </>
}
