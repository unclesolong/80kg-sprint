import { useMemo, useRef, useState } from 'react'
import { ArrowLeft, Bot, ShieldAlert, ShieldCheck, Sparkles } from 'lucide-react'
import { AIConsentDialog } from '../components/planner/AIConsentDialog'
import { LifestyleStep } from '../components/planner/LifestyleStep'
import { OnboardingProgress } from '../components/planner/OnboardingProgress'
import { PlanDraftForm } from '../components/planner/PlanDraftForm'
import { ProfileStep } from '../components/planner/ProfileStep'
import { SafetyStep, safetyQuestions, type SafetyQuestionKey } from '../components/planner/SafetyStep'
import { createLocalPlanDraft, deriveDailyEnergyPlan, hasValidWearableEnergyInput } from '../planner/planCalculations'
import { evaluateSafety, validatePlanVersionAgainstDecision } from '../planner/safetyEngine'
import { buildInitialPlanBundle } from '../planner/plannerRepository'
import { applyPlanAIOutput } from '../planner/aiSchemas'
import type { PlannerConsent, PlannerDraft, SafetyDecision, SafetyScreen, UserProfile } from '../planner/types'
import { buildPlanAIRequest, createAIClient, type AIHealthSummaries } from '../services/aiClient'
import type { ChallengeSettings, DailyLog } from '../types'

const labels = ['基本資料', '生活活動', '安全篩檢', '計畫草稿']
const average = (values: Array<number | undefined>) => {
  const valid = values.filter((value): value is number => value != null && Number.isFinite(value))
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : undefined
}

const summarizeForAI = (logs: DailyLog[]): AIHealthSummaries => {
  const recent = [...logs].sort((left, right) => left.date.localeCompare(right.date)).slice(-28)
  return {
    activity: { averageActiveKcal: average(recent.map((log) => log.activeKcal)), averageSteps: average(recent.map((log) => log.steps)), averageExerciseMinutes: average(recent.map((log) => log.exerciseMinutes)) },
    sleep: { averageHours: average(recent.map((log) => log.sleepHours)) },
    nutrition: { averageIntakeKcal: average(recent.map((log) => log.intakeKcal)), averageProteinG: average(recent.map((log) => log.proteinG)), averageWaterMl: average(recent.map((log) => log.waterMl)) },
    recovery: { averageFatigue: average(recent.map((log) => log.fatigueLevel)), averageHunger: average(recent.map((log) => log.hungerLevel)), averagePain: average(recent.map((log) => log.lowerLegTightness)) }
  }
}

export function PlannerOnboardingPage({ today, settings, logs, online, onCancel, onCreate }: { today: string; settings: ChallengeSettings; logs: DailyLog[]; online: boolean; onCancel: () => void; onCreate: (profile: UserProfile, screen: SafetyScreen, decision: SafetyDecision, draft: PlannerDraft, source: 'manual' | 'ai_assisted', consent?: PlannerConsent) => Promise<void> }) {
  const latestWeight = [...logs].filter((log) => log.weightCondition === 'morning_fasted' && log.weightKg != null).sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.weightKg
  const useLegacySettings = settings.onboarded && (settings.guidanceMode ?? 'legacy_targets') === 'legacy_targets'
  const [step, setStep] = useState(1)
  const [profile, setProfile] = useState<UserProfile>(() => { const now = new Date().toISOString(); const currentWeightKg = latestWeight ?? (useLegacySettings ? settings.baselineWeightKg : 0); const savedGoal = useLegacySettings ? settings.targetWeightKg : 0; return { id: 'current', age: 0, calculationSex: 'male', heightCm: useLegacySettings ? settings.heightCm : 0, currentWeightKg, goalWeightKg: savedGoal > 0 && currentWeightKg > 0 ? Math.min(savedGoal, currentWeightKg) : savedGoal, workActivity: 'sedentary', exerciseSessionsPerWeek: 0, wearable: 'none', foodRestrictions: [], dietaryPattern: 'omnivore', goalPace: 'standard', locale: 'zh-TW', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', createdAt: now, updatedAt: now } })
  const [calculationSexConfirmed, setCalculationSexConfirmed] = useState(false)
  const [screen, setScreen] = useState<SafetyScreen>({ id: 'current', under18: false, pregnantOrBreastfeeding: false, eatingDisorderHistory: false, diabetesOrGlucoseMedication: false, kidneyDisease: false, seriousCardiovascularDisease: false, weightLossMedication: false, currentInjuryOrPain: false, faintingChestPainOrSevereDizziness: false, purgingLaxativesDiureticsOrForcedExercise: false, answeredAt: '' })
  const [answered, setAnswered] = useState<Set<SafetyQuestionKey>>(new Set())
  const [decision, setDecision] = useState<SafetyDecision>()
  const [draft, setDraft] = useState<PlannerDraft>()
  const [saving, setSaving] = useState(false)
  const [aiBusy, setAIBusy] = useState(false)
  const [showConsent, setShowConsent] = useState(false)
  const [provisionalConsent, setProvisionalConsent] = useState<PlannerConsent>()
  const aiConsentRef = useRef(false)
  aiConsentRef.current = Boolean(provisionalConsent?.aiEnabled)
  const aiClient = useMemo(() => createAIClient({ hasConsent: () => aiConsentRef.current }), [])
  const [aiAssisted, setAIAssisted] = useState(false)
  const [aiDetails, setAIDetails] = useState<{ assumptions: string[]; warnings: string[] }>()
  const [aiMessage, setAIMessage] = useState('')
  const [error, setError] = useState('')
  const wearableEnergyValid = hasValidWearableEnergyInput(profile)
  const basicProfileValid = calculationSexConfirmed && profile.age > 0 && profile.age <= 100 && profile.heightCm >= 120 && profile.currentWeightKg > profile.goalWeightKg && profile.goalWeightKg >= 35
  const allSafetyAnswered = answered.size === safetyQuestions.length
  const safetyIcon = decision?.status === 'approved' ? ShieldCheck : ShieldAlert
  const SafetyIcon = safetyIcon

  const sourceNote = useMemo(() => latestWeight != null ? `目前體重以最近晨重 ${latestWeight.toFixed(1)} kg 預填。` : useLegacySettings ? '已從你既有的基本設定預填身高與體重；請在建立前確認。' : '這是新的個人計畫，請先填寫自己的基本資料。', [latestWeight, useLegacySettings])

  const next = () => {
    setError('')
    if (step === 1 && !basicProfileValid) { setError('請完成能量估算公式、年齡、身高與目前／目標體重；目標需低於目前體重。'); return }
    if (step === 2 && !wearableEnergyValid) { setError('裝置平均資料不完整或超出範圍；請完整填入靜止能量（500–5000）、活動能量（0–3000）與 1–30 天的觀察天數，或全部留空改用既有紀錄／公式估算。'); return }
    if (step === 3) {
      if (!allSafetyAnswered) { setError(`還有 ${safetyQuestions.length - answered.size} 題尚未回答。`); return }
      const nextScreen = { ...screen, under18: profile.age < 18, answeredAt: new Date().toISOString() }
      const nextDecision = evaluateSafety(profile, nextScreen, logs, today)
      setScreen(nextScreen); setDecision(nextDecision)
      setDraft(nextDecision.bounds ? createLocalPlanDraft(nextDecision.bounds, profile.goalPace, deriveDailyEnergyPlan(profile, logs)) : undefined)
    }
    setStep((value) => Math.min(4, value + 1))
  }

  const requestAI = async () => {
    if (!decision || !draft || !decision.bounds || aiBusy) return
    setAIBusy(true); setAIMessage('正在用安全範圍檢查 AI 草稿…')
    const summaries = summarizeForAI(logs)
    const result = await aiClient.generatePlan(buildPlanAIRequest(profile, decision, draft, summaries, { kidneyDisease: screen.kidneyDisease, currentInjuryOrPain: screen.currentInjuryOrPain, painLevel: summaries.recovery?.averagePain }))
    if (!result.ok) {
      setAIMessage(`${result.error.message} 已保留目前的本地安全草稿。`)
      setAIBusy(false)
      return
    }
    const applied = applyPlanAIOutput(draft, result.data, decision)
    if (!applied.valid) {
      setAIMessage('AI 草稿未通過安全檢查，已完整保留本地草稿。')
      setAIBusy(false)
      return
    }
    setDraft(applied.draft)
    setAIAssisted(true)
    setAIDetails({ assumptions: result.data.assumptions.map((item) => item.text), warnings: result.data.warnings.map((item) => item.text) })
    setAIMessage('AI 草稿已回填。你仍可逐欄修改，最後確認前不會寫入資料庫。')
    setAIBusy(false)
  }

  const startAI = () => {
    if (!provisionalConsent?.aiEnabled) { setShowConsent(true); return }
    void requestAI()
  }

  const acceptAI = () => {
    const consent: PlannerConsent = { id: 'ai-data-sharing-v1', aiEnabled: true, acceptedAt: new Date().toISOString() }
    aiConsentRef.current = true
    setProvisionalConsent(consent)
    setShowConsent(false)
    window.setTimeout(() => void requestAI(), 0)
  }

  const submit = async () => {
    if (!decision || !draft || !decision.bounds) return
    const { version } = buildInitialPlanBundle(profile, decision, draft, today)
    const validation = validatePlanVersionAgainstDecision(version, decision)
    if (!validation.valid) { setError(`草稿超出安全範圍：${validation.violations.join('、')}`); return }
    setSaving(true); setError('')
    try { await onCreate(profile, screen, decision, draft, aiAssisted ? 'ai_assisted' : 'manual', provisionalConsent) }
    catch { setError('計畫儲存失敗；原有健康紀錄未受影響，請稍後再試。'); setSaving(false) }
  }

  return <section className="planner-onboarding-page planner-stack-page">
    <header className="planner-stack-header planner-onboarding-header"><button aria-label="返回紀錄" onClick={onCancel}><ArrowLeft /></button><div><p className="eyebrow">FAT LOSS PLANNER</p><h1>建立長期減脂計畫</h1></div><img src={`${import.meta.env.BASE_URL}art/planner-hero.webp`} alt="" aria-hidden="true" /></header>
    <OnboardingProgress step={step} labels={labels} />
    <article className="planner-step-card health-card"><header><span>步驟 {step}／4</span><h2>{labels[step - 1]}</h2>{step === 1 && <p>{sourceNote} 這只是唯讀預填，建立前不會寫入長期計畫資料庫。</p>}{step === 2 && <p>活動量只作起始估算，不把單日穿戴裝置快照當成長期 TDEE。</p>}{step === 3 && <p>安全篩檢不作診斷；高風險狀況仍可繼續使用純紀錄功能。</p>}{step === 4 && <p>所有欄位都是草稿，按下「套用並建立計畫」後才會儲存。</p>}</header>
      {step === 1 && <ProfileStep profile={profile} calculationSexConfirmed={calculationSexConfirmed} onConfirmCalculationSex={() => setCalculationSexConfirmed(true)} onChange={setProfile} />}
      {step === 2 && <LifestyleStep profile={profile} onChange={setProfile} />}
      {step === 3 && <SafetyStep screen={screen} answered={answered} onAnswer={(key, value) => { setScreen((current) => ({ ...current, [key]: value })); setAnswered((current) => new Set(current).add(key)) }} />}
      {step === 4 && decision && <><div className={`safety-decision status-${decision.status}`}><SafetyIcon /><div><strong>{decision.status === 'approved' ? '安全篩檢完成' : decision.status === 'needs_confirmation' ? '需要保守限制' : '不建立一般自助減脂計畫'}</strong>{decision.userMessages.map((message) => <p key={message}>{message}</p>)}</div></div>{draft && decision.bounds ? <><div className="ai-plan-toolbar"><div><strong>{aiAssisted ? 'AI 協助草稿' : '本地安全草稿'}</strong><small>AI 只會優化草稿，不會自動建立或套用計畫。</small></div><button type="button" className="ai-action-button" disabled={aiBusy || !online || !aiClient.configured} onClick={startAI}><Bot />{aiBusy ? '正在產生…' : !aiClient.configured ? 'AI 尚未設定' : !online ? '需要網路' : aiAssisted ? '重新產生' : 'AI 協助優化'}</button></div><PlanDraftForm draft={draft} bounds={decision.bounds} onChange={setDraft} /><div className="local-plan-comment"><Sparkles /><div><strong>{draft.comment.title}</strong><p>{draft.comment.summary}</p></div></div>{aiDetails && <details className="ai-plan-details"><summary>AI 假設與提醒</summary>{aiDetails.assumptions.length > 0 && <><h3>採用的假設</h3><ul>{aiDetails.assumptions.map((item) => <li key={item}>{item}</li>)}</ul></>}{aiDetails.warnings.length > 0 && <><h3>提醒</h3><ul>{aiDetails.warnings.map((item) => <li key={item}>{item}</li>)}</ul></>}</details>}{aiMessage && <p className="ai-status-message" role="status" aria-live="polite">{aiMessage}</p>}</> : <div className="planner-restricted-note"><p>你仍可使用每日紀錄、飲食、趨勢與匯出。Planner 不會產生積極熱量赤字。</p></div>}</>}
      {error && <p className="planner-error" role="alert">{error}</p>}
    </article>
    <footer className="planner-sticky-actions">{step > 1 && <button type="button" onClick={() => { setStep((value) => value - 1); setError('') }}>返回修改</button>}{step < 4 ? <button type="button" className="primary" onClick={next}>繼續</button> : draft ? <button type="button" className="primary" disabled={saving} onClick={() => void submit()}>{saving ? '正在建立…' : '套用並建立計畫'}</button> : <button type="button" className="primary" onClick={onCancel}>返回紀錄功能</button>}</footer>
    {showConsent && <AIConsentDialog onDecline={() => setShowConsent(false)} onAccept={acceptAI} />}
  </section>
}
