import type { UserProfile } from '../../planner/types'

const number = (value: string) => value === '' ? 0 : Number(value)

export function ProfileStep({ profile, calculationSexConfirmed = true, onConfirmCalculationSex, onChange }: { profile: UserProfile; calculationSexConfirmed?: boolean; onConfirmCalculationSex?: () => void; onChange: (profile: UserProfile) => void }) {
  const set = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => onChange({ ...profile, [key]: value, updatedAt: new Date().toISOString() })
  return <div className="planner-form-grid">
    <label>年齡<input required type="number" inputMode="numeric" min="1" max="100" value={profile.age || ''} onChange={(event) => set('age', number(event.target.value))} /></label>
    <label>能量估算公式<select required value={calculationSexConfirmed ? profile.calculationSex : ''} onChange={(event) => { set('calculationSex', event.target.value as UserProfile['calculationSex']); onConfirmCalculationSex?.() }}><option value="" disabled>請選擇</option><option value="male">男性生理公式</option><option value="female">女性生理公式</option></select><small>僅用於 BMR／TDEE 公式，不代表性別認同。</small></label>
    <label>身高<span className="planner-input-unit"><input required type="number" inputMode="decimal" min="120" max="230" value={profile.heightCm || ''} onChange={(event) => set('heightCm', number(event.target.value))} /><small>cm</small></span></label>
    <label>目前體重<span className="planner-input-unit"><input required type="number" inputMode="decimal" step="0.1" min="35" max="300" value={profile.currentWeightKg || ''} onChange={(event) => set('currentWeightKg', number(event.target.value))} /><small>kg</small></span></label>
    <label>目標體重<span className="planner-input-unit"><input required type="number" inputMode="decimal" step="0.1" min="35" max="300" value={profile.goalWeightKg || ''} onChange={(event) => set('goalWeightKg', number(event.target.value))} /><small>kg</small></span></label>
  </div>
}
