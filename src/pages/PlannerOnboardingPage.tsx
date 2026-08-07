import { useMemo, useState } from 'react'
import { ArrowLeft, ShieldAlert, ShieldCheck, Sparkles } from 'lucide-react'
import { LifestyleStep } from '../components/planner/LifestyleStep'
import { OnboardingProgress } from '../components/planner/OnboardingProgress'
import { PlanDraftForm } from '../components/planner/PlanDraftForm'
import { ProfileStep } from '../components/planner/ProfileStep'
import { SafetyStep, safetyQuestions, type SafetyQuestionKey } from '../components/planner/SafetyStep'
import { createLocalPlanDraft } from '../planner/planCalculations'
import { evaluateSafety, validatePlanVersionAgainstDecision } from '../planner/safetyEngine'
import { buildInitialPlanBundle } from '../planner/plannerRepository'
import type { PlannerDraft, SafetyDecision, SafetyScreen, UserProfile } from '../planner/types'
import type { ChallengeSettings, DailyLog } from '../types'

const labels = ['基本資料', '生活活動', '安全篩檢', '計畫草稿']

export function PlannerOnboardingPage({ today, settings, logs, onCancel, onCreate }: { today: string; settings: ChallengeSettings; logs: DailyLog[]; onCancel: () => void; onCreate: (profile: UserProfile, screen: SafetyScreen, decision: SafetyDecision, draft: PlannerDraft) => Promise<void> }) {
  const latestWeight = [...logs].filter((log) => log.weightCondition === 'morning_fasted' && log.weightKg != null).sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.weightKg
  const [step, setStep] = useState(1)
  const [profile, setProfile] = useState<UserProfile>(() => { const now = new Date().toISOString(); return { id: 'current', age: 41, calculationSex: 'male', heightCm: settings.heightCm, currentWeightKg: latestWeight ?? settings.baselineWeightKg, goalWeightKg: Math.min(settings.targetWeightKg, latestWeight ?? settings.baselineWeightKg), workActivity: 'sedentary', exerciseSessionsPerWeek: 3, wearable: 'apple_watch', foodRestrictions: [], dietaryPattern: 'omnivore', goalPace: 'standard', locale: 'zh-TW', timezone: 'Europe/Berlin', createdAt: now, updatedAt: now } })
  const [screen, setScreen] = useState<SafetyScreen>({ id: 'current', under18: false, pregnantOrBreastfeeding: false, eatingDisorderHistory: false, diabetesOrGlucoseMedication: false, kidneyDisease: false, seriousCardiovascularDisease: false, weightLossMedication: false, currentInjuryOrPain: false, faintingChestPainOrSevereDizziness: false, purgingLaxativesDiureticsOrForcedExercise: false, answeredAt: '' })
  const [answered, setAnswered] = useState<Set<SafetyQuestionKey>>(new Set())
  const [decision, setDecision] = useState<SafetyDecision>()
  const [draft, setDraft] = useState<PlannerDraft>()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const profileValid = profile.age > 0 && profile.age <= 100 && profile.heightCm >= 120 && profile.currentWeightKg > profile.goalWeightKg && profile.goalWeightKg >= 35
  const allSafetyAnswered = answered.size === safetyQuestions.length
  const safetyIcon = decision?.status === 'approved' ? ShieldCheck : ShieldAlert
  const SafetyIcon = safetyIcon

  const sourceNote = useMemo(() => latestWeight == null ? '目前體重以既有 Sprint 基準值預填。' : `目前體重以最近晨重 ${latestWeight.toFixed(1)} kg 預填。`, [latestWeight])

  const next = () => {
    setError('')
    if (step === 1 && !profileValid) { setError('請確認年齡、身高與目前／目標體重；目標需低於目前體重。'); return }
    if (step === 3) {
      if (!allSafetyAnswered) { setError(`還有 ${safetyQuestions.length - answered.size} 題尚未回答。`); return }
      const nextScreen = { ...screen, under18: profile.age < 18, answeredAt: new Date().toISOString() }
      const nextDecision = evaluateSafety(profile, nextScreen, logs, today)
      setScreen(nextScreen); setDecision(nextDecision)
      setDraft(nextDecision.bounds ? createLocalPlanDraft(nextDecision.bounds, profile.goalPace) : undefined)
    }
    setStep((value) => Math.min(4, value + 1))
  }

  const submit = async () => {
    if (!decision || !draft || !decision.bounds) return
    const { version } = buildInitialPlanBundle(profile, decision, draft, today)
    const validation = validatePlanVersionAgainstDecision(version, decision)
    if (!validation.valid) { setError(`草稿超出安全範圍：${validation.violations.join('、')}`); return }
    setSaving(true); setError('')
    try { await onCreate(profile, screen, decision, draft) }
    catch { setError('計畫儲存失敗；原有健康紀錄未受影響，請稍後再試。'); setSaving(false) }
  }

  return <section className="planner-onboarding-page planner-stack-page">
    <header className="planner-stack-header"><button aria-label="返回紀錄" onClick={onCancel}><ArrowLeft /></button><div><p className="eyebrow">FAT LOSS PLANNER</p><h1>建立長期減脂計畫</h1></div></header>
    <OnboardingProgress step={step} labels={labels} />
    <article className="planner-step-card health-card"><header><span>步驟 {step}／4</span><h2>{labels[step - 1]}</h2>{step === 1 && <p>{sourceNote} 這只是唯讀預填，建立前不會寫入 Planner DB。</p>}{step === 2 && <p>活動量只作起始估算，不把單日 Watch 快照當成長期 TDEE。</p>}{step === 3 && <p>安全篩檢不作診斷；高風險狀況仍可繼續使用純紀錄功能。</p>}{step === 4 && <p>所有欄位都是草稿，按下「套用並建立計畫」後才會儲存。</p>}</header>
      {step === 1 && <ProfileStep profile={profile} onChange={setProfile} />}
      {step === 2 && <LifestyleStep profile={profile} onChange={setProfile} />}
      {step === 3 && <SafetyStep screen={screen} answered={answered} onAnswer={(key, value) => { setScreen((current) => ({ ...current, [key]: value })); setAnswered((current) => new Set(current).add(key)) }} />}
      {step === 4 && decision && <><div className={`safety-decision status-${decision.status}`}><SafetyIcon /><div><strong>{decision.status === 'approved' ? '安全篩檢完成' : decision.status === 'needs_confirmation' ? '需要保守限制' : '不建立一般自助減脂計畫'}</strong>{decision.userMessages.map((message) => <p key={message}>{message}</p>)}</div></div>{draft && decision.bounds ? <><PlanDraftForm draft={draft} bounds={decision.bounds} onChange={setDraft} /><div className="local-plan-comment"><Sparkles /><div><strong>{draft.comment.title}</strong><p>{draft.comment.summary}</p></div></div></> : <div className="planner-restricted-note"><p>你仍可使用每日紀錄、飲食、趨勢與匯出。Planner 不會產生積極熱量赤字。</p></div>}</>}
      {error && <p className="planner-error" role="alert">{error}</p>}
    </article>
    <footer className="planner-sticky-actions">{step > 1 && <button type="button" onClick={() => { setStep((value) => value - 1); setError('') }}>返回修改</button>}{step < 4 ? <button type="button" className="primary" onClick={next}>繼續</button> : draft ? <button type="button" className="primary" disabled={saving} onClick={() => void submit()}>{saving ? '正在建立…' : '套用並建立計畫'}</button> : <button type="button" className="primary" onClick={onCancel}>返回紀錄功能</button>}</footer>
  </section>
}
