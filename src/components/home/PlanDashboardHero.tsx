import { CalendarRange, Check, RefreshCcw, Target } from 'lucide-react'
import type { TodayDashboardModel } from '../../viewModels/todayDashboard'

const weight = (value?: number) => value == null ? '—' : value.toFixed(1)
const compactDate = (value: string) => value.replaceAll('-', '/')

export function PlanDashboardHero({ model, onOpenPlan }: {
  model: TodayDashboardModel
  onOpenPlan?: () => void
}) {
  const status = model.finalization.needsRefinalization
    ? { label: '資料已更新，需重新結算', className: 'needs-refinalization', Icon: RefreshCcw }
    : model.finalization.finalized
      ? { label: '今日已結算', className: 'finalized', Icon: Check }
      : { label: '尚未結算', className: 'not-finalized', Icon: undefined }
  const StatusIcon = status.Icon
  const trend3 = model.weight.morningCount < 3
    ? `3 日趨勢蒐集中 ${Math.min(model.weight.morningCount, 3)}／3`
    : `3 日趨勢 ${weight(model.weight.trend3Kg)} kg`
  const trend7 = model.weight.morningCount < 7
    ? `7 日趨勢蒐集中 ${Math.min(model.weight.morningCount, 7)}／7`
    : `7 日趨勢 ${weight(model.weight.trend7Kg)} kg`

  return <header className={`v6-hero v6-plan-dashboard-hero plan-hero hero-card trend-${model.weight.trendStatus}`}>
    <div className="v6-hero__top plan-hero__top">
      <div className="v6-hero__heading"><span>今日計畫</span><h1>{model.challenge.title}</h1></div>
      <div className="v6-hero__controls"><strong>第 {model.challenge.dayNumber}／{model.challenge.totalDays} 天</strong>{onOpenPlan && <button type="button" onClick={onOpenPlan}>查看計畫</button>}</div>
    </div>
    <div className="v6-hero__weight plan-hero__weight">
      <div><small>{model.weight.currentKg == null ? '晨重' : '最新晨重'}</small><strong>{weight(model.weight.currentKg)}<span>kg</span></strong></div>
      <span className={`v6-hero__status ${status.className}`}>{StatusIcon && <StatusIcon aria-hidden="true" />}{status.label}</span>
    </div>
    <div className="v6-hero__trends" aria-label="晨間體重趨勢">
      <span>{model.weight.morningCount === 0 ? '先完成今天晨間紀錄' : trend3}</span>
      <span>{trend7}</span>
    </div>
    <div className="v6-hero__progress plan-hero__progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={model.challenge.progressPercent} aria-label={`計畫日程進度 ${model.challenge.progressPercent}%`}><i style={{ width: `${model.challenge.progressPercent}%` }} /></div>
    <div className="v6-hero__meta plan-hero__meta">
      {model.challenge.targetWeightKg != null && <span><Target aria-hidden="true" />目標 {weight(model.challenge.targetWeightKg)} kg</span>}
      <span><CalendarRange aria-hidden="true" />預計至 {compactDate(model.challenge.endDate)}</span>
    </div>
  </header>
}
