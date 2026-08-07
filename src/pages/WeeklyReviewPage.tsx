import { useMemo, useRef, useState } from 'react'
import { ArrowLeft, Bot, Check, ClipboardList, Scale, ShieldCheck } from 'lucide-react'
import { AIConsentDialog } from '../components/planner/AIConsentDialog'
import { AICommentCard } from '../components/planner/AICommentCard'
import { validateWeeklyAIOutput } from '../planner/aiSchemas'
import { validatePlanVersionAgainstDecision } from '../planner/safetyEngine'
import { aggregateWeek, buildLocalWeeklyComment, buildNextWeekVersion } from '../planner/weeklyAggregation'
import type { FatLossPlan, PlanVersion, WeeklyReview } from '../planner/types'
import { buildWeeklyReviewAIRequest, createAIClient } from '../services/aiClient'
import type { WeeklyReviewAIOutput } from '../services/aiSchemas'
import type { DailyLog } from '../types'

const dateShift = (date: string, days: number) => { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10) }
const startOfWeek = (date: string) => { const value = new Date(`${date}T12:00:00Z`); const day = value.getUTCDay() || 7; return dateShift(date, 1 - day) }
const display = (value: number | undefined, unit: string, digits = 0) => value == null ? '—' : `${value.toLocaleString('zh-TW', { maximumFractionDigits: digits })} ${unit}`

type AcceptedFields = { calories: boolean; aerobic: boolean; strength: boolean; focus: boolean }

export function WeeklyReviewPage({ today, logs, plan, version, online, aiEnabled, onEnableAI, onAIRun, onBack, onApply }: {
  today: string
  logs: DailyLog[]
  plan: FatLossPlan
  version: PlanVersion
  online: boolean
  aiEnabled: boolean
  onEnableAI: () => Promise<void>
  onAIRun: (status: 'success' | 'fallback' | 'error', errorCode?: string) => void
  onBack: () => void
  onApply: (version: PlanVersion, review: WeeklyReview) => Promise<void>
}) {
  const currentWeekStart = startOfWeek(today)
  const weekStart = dateShift(currentWeekStart, -7)
  const weekEnd = dateShift(currentWeekStart, -1)
  const previousStart = dateShift(currentWeekStart, -14)
  const previousEnd = dateShift(currentWeekStart, -8)
  const previousLogs = logs.filter((log) => log.date >= previousStart && log.date <= previousEnd)
  const aiConsentRef = useRef(aiEnabled)
  aiConsentRef.current = aiEnabled
  const aiClient = useMemo(() => createAIClient({ hasConsent: () => aiConsentRef.current }), [])
  const { dataCompleteness, summary } = useMemo(() => aggregateWeek(logs, weekStart, weekEnd, previousLogs), [logs, previousLogs, weekEnd, weekStart])
  const local = useMemo(() => buildLocalWeeklyComment(summary, dataCompleteness), [dataCompleteness, summary])
  const insufficient = summary.morningWeightCount < 4 || summary.intakeDayCount < 4 || summary.finalizedDayCount < 4 || dataCompleteness < 55
  const [proposal, setProposal] = useState<WeeklyReviewAIOutput>()
  const [accepted, setAccepted] = useState<AcceptedFields>({ calories: true, aerobic: true, strength: true, focus: true })
  const [showConsent, setShowConsent] = useState(false)
  const [aiBusy, setAIBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(insufficient ? '資料不足，本週不會呼叫 AI，也不調整熱量。' : '')

  const requestAI = async () => {
    if (insufficient || aiBusy) return
    setAIBusy(true); setMessage('正在分析彙整資料…')
    const result = await aiClient.reviewWeekly(buildWeeklyReviewAIRequest(version, summary, dataCompleteness, plan.safetyDecisionSnapshot, weekStart, weekEnd, { currentInjuryOrPain: plan.safetyDecisionSnapshot.limitations.includes('current_injury'), painLevel: summary.averagePain }))
    if (!result.ok) {
      setProposal(undefined)
      setMessage(`${result.error.message} 已改用本地檢討，未修改任何設定。`)
      onAIRun('fallback', result.error.code)
      setAIBusy(false)
      return
    }
    const domain = validateWeeklyAIOutput(result.data, version, summary, dataCompleteness)
    if (!domain.valid) {
      setProposal(undefined)
      setMessage('AI 建議未通過安全檢查，已改用本地檢討。')
      onAIRun('fallback', 'domain_validation')
      setAIBusy(false)
      return
    }
    setProposal(result.data)
    setAccepted({ calories: true, aerobic: true, strength: true, focus: true })
    setMessage('AI 建議已準備好；每個調整都可個別接受或保留原值。')
    onAIRun('success')
    setAIBusy(false)
  }

  const startAI = () => {
    if (!aiEnabled) { setShowConsent(true); return }
    void requestAI()
  }

  const acceptConsent = async () => {
    setAIBusy(true)
    try { await onEnableAI(); aiConsentRef.current = true; setShowConsent(false); setAIBusy(false); window.setTimeout(() => void requestAI(), 0) }
    catch { setAIBusy(false); setMessage('AI 設定無法儲存；本地檢討仍可正常使用。') }
  }

  const nextStart = currentWeekStart
  const adjustments = proposal ? {
    calories: accepted.calories ? proposal.calorieAdjustmentKcal : 0,
    aerobic: accepted.aerobic ? proposal.activityAdjustment.aerobicMinutesDelta : 0,
    strength: accepted.strength ? proposal.activityAdjustment.strengthDaysDelta : 0,
    focusTasks: accepted.focus ? proposal.focusTasks : version.focusTasks
  } : { calories: 0, aerobic: 0, strength: 0, focusTasks: version.focusTasks }
  const comment = proposal?.comment ?? local.comment
  const nextVersion = {
    ...buildNextWeekVersion(version, nextStart, comment),
    calorieTargetKcal: version.calorieTargetKcal + adjustments.calories,
    aerobicMinutesPerWeek: version.aerobicMinutesPerWeek + adjustments.aerobic,
    strengthDaysPerWeek: version.strengthDaysPerWeek + adjustments.strength,
    focusTasks: [...adjustments.focusTasks],
    createdBy: proposal ? 'ai_assisted' as const : 'manual' as const
  }

  const apply = async () => {
    const validation = validatePlanVersionAgainstDecision(nextVersion, plan.safetyDecisionSnapshot)
    if (!validation.valid) { setMessage('下週草稿未通過完整安全檢查，因此沒有套用。'); return }
    setSaving(true)
    const now = new Date().toISOString()
    const review: WeeklyReview = {
      id: `review-${weekStart}`,
      planId: plan.id,
      weekStart,
      weekEnd,
      dataCompleteness,
      summary,
      currentVersionId: version.id,
      suggestedVersionDraft: { ...nextVersion },
      comment,
      warnings: proposal?.warnings ?? local.warnings,
      status: 'applied',
      createdAt: now
    }
    try { await onApply(nextVersion, review) }
    catch { setMessage('檢討儲存失敗；目前計畫沒有變更。'); setSaving(false) }
  }

  return <section className="planner-stack-page weekly-review-page">
    <header className="planner-stack-header weekly-review-header"><button aria-label="返回計畫" onClick={onBack}><ArrowLeft /></button><div><p className="eyebrow">WEEKLY REVIEW</p><h1>完整週檢討</h1></div><img src={`${import.meta.env.BASE_URL}art/weekly-review.webp`} alt="" aria-hidden="true" /></header>
    <article className="weekly-decision health-card"><div><ShieldCheck /><span>本週判定</span></div><strong>{proposal ? 'AI 建議待確認' : local.decision === 'maintain' ? '維持計畫' : local.decision === 'recovery_priority' ? '恢復優先' : '先改善資料'}</strong><p>{weekStart} 至 {weekEnd}</p></article>
    <div className="weekly-metrics"><article className="health-card"><Scale /><span>平均晨重</span><strong>{display(summary.averageMorningWeightKg, 'kg', 1)}</strong><small>{summary.morningWeightCount} 筆</small></article><article className="health-card"><ClipboardList /><span>資料完整度</span><strong>{dataCompleteness}%</strong><small>{summary.finalizedDayCount} 天已結算</small></article><article className="health-card"><span>平均攝取</span><strong>{display(summary.averageIntakeKcal, 'kcal')}</strong></article><article className="health-card"><span>平均活動</span><strong>{display(summary.averageActiveKcal, 'kcal')}</strong></article></div>
    <div className="weekly-ai-toolbar health-card"><div><strong>可選的 AI 檢討</strong><p>只傳送上方彙整數字，不傳原始每日紀錄。</p></div><button type="button" className="ai-action-button" disabled={insufficient || aiBusy || !online || !aiClient.configured} onClick={startAI}><Bot />{aiBusy ? '分析中…' : !aiClient.configured ? 'AI 尚未設定' : !online ? '需要網路' : insufficient ? '資料不足' : proposal ? '重新分析' : 'AI 協助檢討'}</button></div>
    {message && <p className="ai-status-message" role="status" aria-live="polite">{message}</p>}
    <AICommentCard comment={comment} source={proposal ? 'AI 每週建議' : '本地規則提醒'} />
    <article className="plan-adjustment-draft health-card"><header><span>目前設定 vs 下週草稿</span><strong>逐項確認</strong></header><div className="weekly-adjustment-list">
      <label><input type="checkbox" checked={Boolean(proposal && accepted.calories)} disabled={!proposal} onChange={(event) => setAccepted((value) => ({ ...value, calories: event.target.checked }))} /><span>每日熱量</span><strong>{version.calorieTargetKcal} → {nextVersion.calorieTargetKcal} kcal</strong></label>
      <label><input type="checkbox" checked={Boolean(proposal && accepted.aerobic)} disabled={!proposal} onChange={(event) => setAccepted((value) => ({ ...value, aerobic: event.target.checked }))} /><span>每週有氧</span><strong>{version.aerobicMinutesPerWeek} → {nextVersion.aerobicMinutesPerWeek} 分</strong></label>
      <label><input type="checkbox" checked={Boolean(proposal && accepted.strength)} disabled={!proposal} onChange={(event) => setAccepted((value) => ({ ...value, strength: event.target.checked }))} /><span>每週肌力</span><strong>{version.strengthDaysPerWeek} → {nextVersion.strengthDaysPerWeek} 次</strong></label>
      <label><input type="checkbox" checked={Boolean(proposal && accepted.focus)} disabled={!proposal} onChange={(event) => setAccepted((value) => ({ ...value, focus: event.target.checked }))} /><span>下週重點</span><strong>{nextVersion.focusTasks.join('、') || '沿用目前重點'}</strong></label>
    </div><p>{proposal?.warnings[0] ?? local.warnings[0] ?? '本地規則目前建議維持設定。'}</p></article>
    <button className="primary weekly-apply" disabled={saving} type="button" onClick={() => void apply()}><Check />{saving ? '正在套用…' : '套用為本週設定'}</button>
    {showConsent && <AIConsentDialog busy={aiBusy} onDecline={() => setShowConsent(false)} onAccept={() => void acceptConsent()} />}
  </section>
}
