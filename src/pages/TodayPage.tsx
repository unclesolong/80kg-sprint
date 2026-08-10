import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, Droplets, Footprints, Moon, Utensils } from 'lucide-react'
import { buildAdvice } from '../advice'
import { achievementRate, activityTotals, dailyCompletion, finalizedCumulativeDeficit, finalizedDeficit, nutritionCoverageDisplay } from '../calculations'
import { CompactMetricsPanel } from '../components/home/CompactMetricsPanel'
import { DailyStageRail } from '../components/home/DailyStageRail'
import { PlanDashboardHero } from '../components/home/PlanDashboardHero'
import { PlanInsights } from '../components/home/PlanInsights'
import { PrimaryActionCard } from '../components/home/PrimaryActionCard'
import { PlanHero } from '../components/planner/PlanHero'
import { ensureMealDetails } from '../mealOperations'
import type { FatLossPlan, PlanVersion, UserProfile, WeeklyReview } from '../planner/types'
import type { ChallengeSettings, DailyLog, FoodTemplate, RecordStage } from '../types'
import { settingsWithDailyTargets } from '../viewModels/dailyTargetContext'
import { buildTodayDashboardModel } from '../viewModels/todayDashboard'

const rounded = (value?: number) => value == null ? '—' : Math.round(value).toLocaleString('zh-TW')

export function TodayPage({ today, log, logs, settings, plan, planVersion, latestWeeklyReview, plannerProfile, plannerError, onOpenPlanner, onOpenWeeklyReview, onQuickAdd, onOpenRecord, onOpenFoodTemplate }: {
  today: string
  log: DailyLog
  logs: DailyLog[]
  settings: ChallengeSettings
  plan?: FatLossPlan
  planVersion?: PlanVersion
  latestWeeklyReview?: WeeklyReview
  plannerProfile?: UserProfile
  plannerError?: string
  onOpenPlanner: () => void
  onOpenWeeklyReview: () => void
  onQuickAdd: (patch: Partial<DailyLog>) => void
  onOpenRecord: (stage: RecordStage) => void
  onOpenFoodTemplate: (template: FoodTemplate) => void
}) {
  const [waterToast, setWaterToast] = useState<{ amount: number; previous?: number }>()
  const waterTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => { if (waterTimer.current) window.clearTimeout(waterTimer.current) }, [])

  const dashboard = useMemo(() => buildTodayDashboardModel({
    today,
    log,
    logs,
    settings,
    plan,
    planVersion,
    plannerProfile
  }), [log, logs, plan, planVersion, plannerProfile, settings, today])
  const allLogs = [...logs.filter((item) => item.id !== log.id && item.date !== log.date), log]
  const targetSettings = settingsWithDailyTargets(settings, dashboard.targets, {
    startDate: dashboard.challenge.startDate,
    endDate: dashboard.challenge.endDate,
    targetWeightKg: dashboard.challenge.targetWeightKg
  })
  const details = ensureMealDetails(log)
  const activity = activityTotals(log)
  const completion = dailyCompletion(log, targetSettings)
  const advice = buildAdvice(log, allLogs, targetSettings)
  const deficit = finalizedDeficit(log)
  const cumulative = finalizedCumulativeDeficit(allLogs, targetSettings)
  const homeTemplateIds = ['fixed_breakfast', 'fage_250', 'chicken_rice', 'chicken_pasta', 'ramen_chicken', 'soy_chia']
  const templates = homeTemplateIds.flatMap((id) => (settings.foodTemplates ?? []).find((template) => template.id === id) ?? [])

  const addWater = (amount: number) => {
    const previousWater = log.waterMl
    onQuickAdd({ waterMl: (previousWater ?? 0) + amount })
    setWaterToast({ amount, previous: previousWater })
    if (waterTimer.current) window.clearTimeout(waterTimer.current)
    waterTimer.current = window.setTimeout(() => setWaterToast(undefined), 5000)
  }
  const nutrientRows = [
    { label: '熱量', value: log.intakeKcal == null ? '—' : `${Math.round(log.intakeKcal).toLocaleString('zh-TW')} kcal`, note: log.intakeKcal == null ? '尚未記錄' : '完整' },
    { label: '蛋白質', value: log.proteinG == null ? '—' : `${log.proteinG.toFixed(1)} g`, note: log.proteinG == null ? '尚未記錄' : '完整' },
    { label: '碳水', ...nutritionCoverageDisplay(details, 'carbs', log.carbsG) },
    { label: '脂肪', ...nutritionCoverageDisplay(details, 'fat', log.fatG) },
    { label: '纖維', ...nutritionCoverageDisplay(details, 'fiber', log.fiberG) },
    { label: '鈉', ...nutritionCoverageDisplay(details, 'sodium', log.sodiumMg) }
  ]

  return <section className="page today-page sprint-home v6-home">
    {plan && planVersion
      ? <PlanHero today={today} log={log} plan={plan} version={planVersion} latestReview={latestWeeklyReview} profile={plannerProfile} currentWeight={dashboard.weight.currentKg} dashboard={dashboard} onOpenPlan={onOpenPlanner} onOpenWeeklyReview={onOpenWeeklyReview} />
      : <PlanDashboardHero model={dashboard} />}

    {plannerError && <p className="planner-load-warning">長期計畫暫時無法載入；每日紀錄仍可正常使用。</p>}

    <PrimaryActionCard action={dashboard.primaryAction} onOpen={onOpenRecord} />
    <CompactMetricsPanel model={dashboard} />
    <DailyStageRail stages={dashboard.stages} onOpen={onOpenRecord} />

    <section className="quick-sprint v6-quick-add flat-section"><div className="flat-heading"><h2>快速加入</h2><span>白天隨吃隨記</span></div><div className="quick-water"><button type="button" onClick={() => addWater(250)}><Droplets size={18} />＋250 ml</button><button type="button" onClick={() => addWater(500)}><Droplets size={18} />＋500 ml</button></div><div className="food-shortcuts" aria-label="食物快捷模板">{templates.map((template) => <button type="button" key={template.id} onClick={() => onOpenFoodTemplate(template)}><strong>{template.name}</strong><small>約 {Math.round(template.kcal)} kcal · P {Math.round(template.proteinG)}g</small></button>)}</div></section>

    <details className="more-data v6-more-data standard-card"><summary><span>更多資料</span><strong>{log.dayFinalized ? `達成率 ${achievementRate(log, targetSettings)}%` : `完成 ${completion.completed}／${completion.total}`}</strong></summary><div className="more-data-body">
      {!log.dayFinalized && <p className="not-finalized-note">尚未完成晚間結算，不顯示最終赤字。</p>}
      {log.dayFinalized && <div className="final-energy-grid"><article><span>今日消耗</span><strong>{rounded((log.restingKcal ?? 0) + (activity.effectiveActiveKcal ?? 0))}</strong><small>kcal</small></article><article><span>今日赤字</span><strong>{rounded(deficit)}</strong><small>kcal</small></article><article><span>期間累積</span><strong>{rounded(cumulative)}</strong><small>kcal</small></article></div>}
      <div className="more-metrics"><div><Utensils /><span>蛋白質</span><strong>{log.proteinG == null ? '—' : `${log.proteinG.toFixed(1)} g`}</strong></div><div><Droplets /><span>白開水</span><strong>{rounded(log.waterMl)} ml</strong></div><div><Moon /><span>前一晚睡眠</span><strong>{log.sleepHours == null ? '—' : `${log.sleepHours.toFixed(1)} 小時`}</strong></div><div><Footprints /><span>步數</span><strong>{rounded(log.steps)}</strong></div><div><span className="status-dot" /> <span>排便</span><strong>{log.bowelMovement === 'yes' ? '有' : log.bowelMovement === 'none' ? '沒有' : '未記錄'}</strong></div><div><span className="status-dot" /><span>下肢／足底狀態</span><strong>{log.lowerLegTightness ?? '—'}／5</strong></div></div>
      <div className="nutrient-coverage-grid">{nutrientRows.map((row) => <div key={row.label}><span>{row.label}</span><strong>{row.value}</strong><small>{row.note}</small></div>)}</div>
      <div className="completion-list">{completion.items.map((item) => <span className={item.complete ? 'done' : ''} key={item.key}><i />{item.label}</span>)}</div>
      <div className="advice-list secondary-advice">{advice.slice(0, 2).map((item, index) => <article className={`advice ${item.level}`} key={`${item.text}-${index}`}><i /><p>{item.text}</p></article>)}</div>
    </div></details>

    {!plan && !plannerError && <button type="button" className="planner-entry-card health-card" onClick={onOpenPlanner}><span>新增功能</span><strong>建立長期減脂計畫</strong><small>以既有設定與最近晨重預填；確認前不會寫入新資料庫。</small><ChevronRight /></button>}
    {planVersion && <PlanInsights version={planVersion} latestReview={latestWeeklyReview} onOpenWeeklyReview={onOpenWeeklyReview} />}

    {waterToast && <div className="undo-toast" role="status"><span>已加入 {waterToast.amount} ml 白開水</span><button type="button" onClick={() => { onQuickAdd({ waterMl: waterToast.previous }); setWaterToast(undefined) }}>復原</button></div>}
  </section>
}
