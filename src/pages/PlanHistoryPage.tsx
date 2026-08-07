import { ArrowLeft, Archive, CalendarRange } from 'lucide-react'
import type { ChallengeSettings } from '../types'
import type { FatLossPlan, PlanVersion } from '../planner/types'

export function PlanHistoryPage({ settings, plans, versions, onBack }: { settings: ChallengeSettings; plans: FatLossPlan[]; versions: PlanVersion[]; onBack: () => void }) {
  return <section className="planner-stack-page"><header className="planner-stack-header"><button aria-label="返回計畫" onClick={onBack}><ArrowLeft /></button><div><p className="eyebrow">PLAN HISTORY</p><h1>計畫歷史</h1></div></header><article className="history-card legacy health-card"><Archive /><div><span>歷史短期 Sprint</span><strong>{settings.startDate} 至 {settings.finalWeighInDate}</strong><p>{settings.baselineWeightKg.toFixed(1)} → {settings.targetWeightKg.toFixed(1)} kg；舊紀錄保持原樣。</p></div></article>{plans.map((plan) => { const planVersions = versions.filter((version) => version.planId === plan.id).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)); return <article className="history-card health-card" key={plan.id}><CalendarRange /><div><span>{plan.status === 'active' ? '進行中' : '歷史計畫'}</span><strong>{plan.name}</strong><p>{plan.startDate} 開始 · {planVersions.length} 個不可變版本</p></div></article> })}</section>
}
