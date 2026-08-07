import type { PlannerDraft, SafetyBounds } from '../../planner/types'

export function PlanDraftForm({ draft, bounds, onChange }: { draft: PlannerDraft; bounds: SafetyBounds; onChange: (draft: PlannerDraft) => void }) {
  const set = <K extends keyof PlannerDraft>(key: K, value: PlannerDraft[K]) => onChange({ ...draft, [key]: value })
  return <div className="plan-draft-form">
    <div className="plan-draft-summary"><span>建議完成期間</span><strong>{bounds.earliestGoalDate} 至 {bounds.latestSuggestedGoalDate}</strong><small>依目前體重與每週安全速度估算，不是保證日期。</small></div>
    <div className="planner-form-grid">
      <label>計畫目標日<input type="date" min={bounds.earliestGoalDate} max={bounds.latestSuggestedGoalDate} value={draft.goalDate} onChange={(event) => set('goalDate', event.target.value)} /></label>
      <label>每日熱量目標<span className="planner-input-unit"><input type="number" step="50" min={bounds.dailyCalories.min} max={bounds.dailyCalories.max} value={draft.calorieTargetKcal} onChange={(event) => set('calorieTargetKcal', Number(event.target.value))} /><small>kcal</small></span></label>
      <label>蛋白質下限<span className="planner-input-unit"><input type="number" step="5" min={bounds.proteinG.min} max={bounds.proteinG.max} value={draft.proteinMinG} onChange={(event) => set('proteinMinG', Number(event.target.value))} /><small>g</small></span></label>
      <label>蛋白質上限<span className="planner-input-unit"><input type="number" step="5" min={draft.proteinMinG} max={bounds.proteinG.max} value={draft.proteinMaxG} onChange={(event) => set('proteinMaxG', Number(event.target.value))} /><small>g</small></span></label>
      <label>飲水目標<span className="planner-input-unit"><input type="number" step="100" min={bounds.waterMl.min} max={bounds.waterMl.max} value={draft.waterTargetMl} onChange={(event) => set('waterTargetMl', Number(event.target.value))} /><small>ml</small></span></label>
      <label>每週有氧分鐘<input type="number" step="5" min={bounds.aerobicMinutesPerWeek.min} max={bounds.aerobicMinutesPerWeek.max} value={draft.aerobicMinutesPerWeek} onChange={(event) => set('aerobicMinutesPerWeek', Number(event.target.value))} /></label>
      <label>每週肌力次數<input type="number" min={bounds.strengthDaysPerWeek.min} max={bounds.strengthDaysPerWeek.max} value={draft.strengthDaysPerWeek} onChange={(event) => set('strengthDaysPerWeek', Number(event.target.value))} /></label>
      <label>每週預期減重<span className="planner-input-unit"><input type="number" step="0.05" min={bounds.weeklyLossKg.min} max={bounds.weeklyLossKg.max} value={draft.expectedWeeklyLossKg} onChange={(event) => set('expectedWeeklyLossKg', Number(event.target.value))} /><small>kg</small></span></label>
      <label>晚間預留<span className="planner-input-unit"><input type="number" step="10" min="0" max="400" value={draft.eveningReserveKcal} onChange={(event) => set('eveningReserveKcal', Number(event.target.value))} /><small>kcal</small></span></label>
    </div>
    <label className="planner-focus-field">本週重點（每行一項，最多 4 項）<textarea rows={3} value={draft.focusTasks.join('\n')} onChange={(event) => set('focusTasks', event.target.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, 4))} /></label>
  </div>
}
