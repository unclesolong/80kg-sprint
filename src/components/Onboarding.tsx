import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import type { ChallengeSettings } from '../types'
import { AppMark } from './AppMark'

export interface OnboardingDraft {
  baselineWeightKg: string
  heightCm: string
  targetWeightKg: string
  startDate: string
  finalWeighInDate: string
}

export interface OnboardingProps {
  initial: ChallengeSettings
  initialDraft?: Partial<OnboardingDraft>
  onComplete: (settings: ChallengeSettings) => boolean | void | Promise<boolean | void>
  onImportBackup?: (file: File) => void | Promise<void>
}

export const emptyOnboardingDraft = (): OnboardingDraft => ({
  baselineWeightKg: '',
  heightCm: '',
  targetWeightKg: '',
  startDate: '',
  finalWeighInDate: ''
})

const inRange = (value: string, min: number, max: number) => {
  const parsed = Number(value)
  return value.trim() !== '' && Number.isFinite(parsed) && parsed >= min && parsed <= max
}

export const settingsFromOnboardingDraft = (
  initial: ChallengeSettings,
  draft: OnboardingDraft
): ChallengeSettings | undefined => {
  if (!inRange(draft.baselineWeightKg, 30, 250)) return undefined
  if (!inRange(draft.heightCm, 100, 250)) return undefined
  if (!inRange(draft.targetWeightKg, 30, 250)) return undefined
  if (!draft.startDate || !draft.finalWeighInDate || draft.finalWeighInDate <= draft.startDate) return undefined

  return {
    ...initial,
    baselineWeightKg: Number(draft.baselineWeightKg),
    heightCm: Number(draft.heightCm),
    targetWeightKg: Number(draft.targetWeightKg),
    startDate: draft.startDate,
    finalWeighInDate: draft.finalWeighInDate,
    guidanceMode: 'tracking_only',
    onboarded: true
  }
}

export function Onboarding({ initial, initialDraft, onComplete, onImportBackup }: OnboardingProps) {
  const importInput = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<OnboardingDraft>(() => ({ ...emptyOnboardingDraft(), ...initialDraft }))
  const [attempted, setAttempted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState(false)
  const invalidDateRange = Boolean(form.startDate && form.finalWeighInDate && form.finalWeighInDate <= form.startDate)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setAttempted(true)
    setSaveError(false)
    const completed = settingsFromOnboardingDraft(initial, form)
    if (!completed) return

    setSaving(true)
    try {
      const result = await onComplete(completed)
      if (result === false) setSaveError(true)
    } catch {
      setSaveError(true)
    } finally {
      setSaving(false)
    }
  }

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!onImportBackup || !file) return
    setImporting(true)
    setImportError(false)
    try {
      await onImportBackup(file)
    } catch {
      setImportError(true)
    } finally {
      input.value = ''
      setImporting(false)
    }
  }

  return <main className="onboarding v6-onboarding">
    <div className="onboarding-mark onboarding-mark-neutral"><AppMark size={64} decorative /></div>
    <p className="eyebrow onboarding-brand__english">FAT LOSS JOURNAL</p>
    <h1 className="onboarding-brand__title">減脂追蹤</h1>
    <p className="onboarding-brand__subtitle">建立你的基本追蹤設定</p>
    <p className="lede onboarding-intro">先設定正式起點與目前目標。<br />之後可建立完整長期減脂計畫，也可以先使用每日紀錄。</p>
    <form className="panel onboarding-form" onSubmit={submit}>
      <label>正式起始晨重<input required inputMode="decimal" type="number" step="0.1" min="30" max="250" value={form.baselineWeightKg} onChange={(event) => setForm({ ...form, baselineWeightKg: event.target.value })} /><span>kg</span></label>
      <label>身高<input required inputMode="numeric" type="number" min="100" max="250" value={form.heightCm} onChange={(event) => setForm({ ...form, heightCm: event.target.value })} /><span>cm</span></label>
      <label>目前目標體重<input required inputMode="decimal" type="number" step="0.1" min="30" max="250" value={form.targetWeightKg} onChange={(event) => setForm({ ...form, targetWeightKg: event.target.value })} /><span>kg</span></label>
      <label>開始追蹤日期<input required type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></label>
      <label>階段檢視日期<input required type="date" min={form.startDate || undefined} value={form.finalWeighInDate} onChange={(event) => setForm({ ...form, finalWeighInDate: event.target.value })} /></label>
      {invalidDateRange && <p className="error">階段檢視日期必須晚於開始追蹤日期。</p>}
      {attempted && !invalidDateRange && !settingsFromOnboardingDraft(initial, form) && <p className="error">請確認所有基本設定都已完整填寫。</p>}
      {saveError && <p className="error" role="alert">基本設定尚未儲存，資料仍保留在表單中。請稍後再試。</p>}
      {importError && <p className="error" role="alert">備份匯入未完成；目前資料沒有被清除，請稍後再試。</p>}
      <button className="primary onboarding-submit" type="submit" disabled={saving || importing}>{saving ? '儲存中…' : '儲存基本設定並開始'}</button>
      {onImportBackup && <>
        <input ref={importInput} className="onboarding-import-input" hidden type="file" accept=".json,application/json" onChange={(event) => { void importBackup(event) }} />
        <button className="onboarding-import" type="button" disabled={saving || importing} onClick={() => importInput.current?.click()}>{importing ? '匯入備份中…' : '匯入追蹤與培育備份'}</button>
      </>}
    </form>
    <p className="privacy-line">資料預設只儲存在此裝置。</p>
  </main>
}
