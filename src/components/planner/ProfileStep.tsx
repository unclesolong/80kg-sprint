import type { UserProfile } from '../../planner/types'

const number = (value: string) => value === '' ? 0 : Number(value)

export function ProfileStep({ profile, onChange }: { profile: UserProfile; onChange: (profile: UserProfile) => void }) {
  const set = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => onChange({ ...profile, [key]: value, updatedAt: new Date().toISOString() })
  return <div className="planner-form-grid">
    <label>年齡<input required type="number" inputMode="numeric" min="1" max="100" value={profile.age} onChange={(event) => set('age', number(event.target.value))} /></label>
    <label>計算用生理性別<select value={profile.calculationSex} onChange={(event) => set('calculationSex', event.target.value as UserProfile['calculationSex'])}><option value="male">男性公式</option><option value="female">女性公式</option></select></label>
    <label>身高<span className="planner-input-unit"><input required type="number" inputMode="decimal" min="120" max="230" value={profile.heightCm} onChange={(event) => set('heightCm', number(event.target.value))} /><small>cm</small></span></label>
    <label>目前體重<span className="planner-input-unit"><input required type="number" inputMode="decimal" step="0.1" min="35" max="300" value={profile.currentWeightKg} onChange={(event) => set('currentWeightKg', number(event.target.value))} /><small>kg</small></span></label>
    <label>目標體重<span className="planner-input-unit"><input required type="number" inputMode="decimal" step="0.1" min="35" max="300" value={profile.goalWeightKg} onChange={(event) => set('goalWeightKg', number(event.target.value))} /><small>kg</small></span></label>
  </div>
}
