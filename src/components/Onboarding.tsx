import { useState, type FormEvent } from 'react'
import type { ChallengeSettings } from '../types'

export function Onboarding({ initial, onComplete }: { initial: ChallengeSettings; onComplete: (settings: ChallengeSettings) => void }) {
  const [form, setForm] = useState(initial)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (form.finalWeighInDate <= form.startDate) return
    onComplete({ ...form, onboarded: true })
  }
  return <main className="onboarding">
    <div className="onboarding-mark">80</div>
    <p className="eyebrow">7 DAY RESET</p>
    <h1>回到 80 公斤</h1>
    <p className="lede">先設定你的正式起點。所有趨勢與目標線都會依實際晨間體重重新計算。</p>
    <form className="panel onboarding-form" onSubmit={submit}>
      <label>正式起始晨間體重<input required inputMode="decimal" type="number" step="0.1" min="30" max="250" value={form.baselineWeightKg} onChange={(e) => setForm({ ...form, baselineWeightKg: Number(e.target.value) })} /><span>kg</span></label>
      <label>身高<input required inputMode="numeric" type="number" min="100" max="250" value={form.heightCm} onChange={(e) => setForm({ ...form, heightCm: Number(e.target.value) })} /><span>cm</span></label>
      <label>目標體重<input required inputMode="decimal" type="number" step="0.1" min="30" max="250" value={form.targetWeightKg} onChange={(e) => setForm({ ...form, targetWeightKg: Number(e.target.value) })} /><span>kg</span></label>
      <label>起始日期<input required type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
      <label>最終秤重日<input required type="date" min={form.startDate} value={form.finalWeighInDate} onChange={(e) => setForm({ ...form, finalWeighInDate: e.target.value })} /></label>
      {form.finalWeighInDate <= form.startDate && <p className="error">最終秤重日必須晚於起始日。</p>}
      <button className="primary" type="submit">開始 7 天計畫</button>
    </form>
    <p className="privacy-line">資料只儲存在這台裝置，不會上傳。</p>
  </main>
}
