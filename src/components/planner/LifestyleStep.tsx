import type { UserProfile } from '../../planner/types'

const optionalNumber = (value: string) => value === '' ? undefined : Number(value)

export function LifestyleStep({ profile, onChange }: { profile: UserProfile; onChange: (profile: UserProfile) => void }) {
  const set = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => onChange({ ...profile, [key]: value, updatedAt: new Date().toISOString() })
  return <div className="planner-form-grid">
    <label>平均每日步數<input type="number" inputMode="numeric" min="0" step="100" value={profile.averageSteps ?? ''} onChange={(event) => set('averageSteps', optionalNumber(event.target.value))} /></label>
    <label>工作型態<select value={profile.workActivity} onChange={(event) => set('workActivity', event.target.value as UserProfile['workActivity'])}><option value="sedentary">久坐為主</option><option value="mixed">坐站混合</option><option value="standing">站立走動</option><option value="physical">體力工作</option></select></label>
    <label>每週運動次數<input type="number" min="0" max="14" value={profile.exerciseSessionsPerWeek} onChange={(event) => set('exerciseSessionsPerWeek', Number(event.target.value))} /></label>
    <label>每週運動分鐘<input type="number" min="0" step="5" value={profile.exerciseMinutesPerWeek ?? ''} onChange={(event) => set('exerciseMinutesPerWeek', optionalNumber(event.target.value))} /></label>
    <label>穿戴裝置<select value={profile.wearable} onChange={(event) => set('wearable', event.target.value as UserProfile['wearable'])}><option value="apple_watch">Apple Watch</option><option value="other">其他</option><option value="none">沒有</option></select></label>
    {profile.wearable !== 'none' && <><label>平均靜態能量<input type="number" min="0" value={profile.averageRestingEnergyKcal ?? ''} onChange={(event) => set('averageRestingEnergyKcal', optionalNumber(event.target.value))} /></label><label>平均活動能量<input type="number" min="0" value={profile.averageActiveEnergyKcal ?? ''} onChange={(event) => set('averageActiveEnergyKcal', optionalNumber(event.target.value))} /></label></>}
    <label>飲食型態<select value={profile.dietaryPattern ?? 'omnivore'} onChange={(event) => set('dietaryPattern', event.target.value as UserProfile['dietaryPattern'])}><option value="omnivore">一般飲食</option><option value="vegetarian">蛋奶素</option><option value="vegan">純素</option><option value="other">其他</option></select></label>
    <label className="planner-form-grid__wide">過敏／不吃食物<input placeholder="以逗號分隔，可留空" value={profile.foodRestrictions.join('、')} onChange={(event) => set('foodRestrictions', event.target.value.split(/[、,，]/).map((item) => item.trim()).filter(Boolean))} /></label>
    <fieldset className="planner-pace planner-form-grid__wide"><legend>期望速度</legend><div className="segmented">{([['gentle', '溫和'], ['standard', '標準'], ['aggressive', '積極']] as const).map(([value, label]) => <button type="button" className={profile.goalPace === value ? 'selected' : ''} aria-pressed={profile.goalPace === value} onClick={() => set('goalPace', value)} key={value}>{label}</button>)}</div><p>積極模式仍受每週最多 1%／0.9 kg 與最低熱量保護限制。</p></fieldset>
  </div>
}
