import { useEffect, useRef, useState } from 'react'
import { mealTotals, parseLocalDate, sleepDurationHours } from '../calculations'
import { defaultMealDetails } from '../defaults'
import type { CustomFood, DailyLog, MealDetails, MealLine, WorkoutEntry, WorkoutType } from '../types'
import { NumberField } from '../components/NumberField'

const Section = ({ title, missing, open = true, children }: { title: string; missing?: boolean; open?: boolean; children: React.ReactNode }) => <details className="form-section panel" open={open}>
  <summary><span>{title}</span>{missing && <em>尚未完成</em>}</summary><div className="section-body">{children}</div>
</details>

const SelectScale = ({ label, value, max = 5, onChange }: { label: string; value?: number; max?: number; onChange: (value: number) => void }) => <div className="field-block"><label>{label}</label><div className="scale">{Array.from({ length: max }, (_, i) => i + 1).map((number) => <button type="button" className={value === number ? 'selected' : ''} onClick={() => onChange(number)} key={number}>{number}</button>)}</div></div>

const lineTotals = (lines: MealLine[]) => lines.reduce((total, line) => ({
  kcal: total.kcal + line.amount * line.kcalPerUnit,
  protein: total.protein + line.amount * line.proteinPerUnit
}), { kcal: 0, protein: 0 })

const MealEditor = ({ title, lines, onChange }: { title: string; lines: MealLine[]; onChange: (lines: MealLine[]) => void }) => {
  const total = lineTotals(lines)
  return <details className="meal-editor panel-inner">
    <summary><span>{title}</span><strong>{Math.round(total.kcal)} kcal · {Math.round(total.protein)} g 蛋白質</strong></summary>
    <div>{lines.length === 0 ? <p className="empty">尚無食物，可從下方自訂食物加入。</p> : lines.map((line, index) => <div className="meal-line" key={`${line.key}-${index}`}>
      <NumberField label={line.label} value={line.amount} unit={line.key === 'sauce' || line.key === 'extra' ? 'kcal' : line.unit} step={line.unit === '份' || line.unit === '顆' ? 1 : 5} onChange={(amount) => onChange(lines.map((item, itemIndex) => itemIndex === index ? { ...item, amount: amount ?? 0 } : item))} />
      <button type="button" className="danger-text compact-button" aria-label={`刪除${line.label}`} onClick={() => onChange(lines.filter((_, itemIndex) => itemIndex !== index))}>移除</button>
    </div>)}</div>
  </details>
}

type RecordTab = 'morning' | 'activity' | 'food' | 'water' | 'condition'
const mealKeys = ['breakfast', 'lunch', 'dinner', 'evening'] as const
type MealKey = typeof mealKeys[number]

const workoutLabels: Record<WorkoutType, string> = {
  walk: '步行', slow_jog: '超慢跑', run: '跑步', strength: '重量訓練', cycling: '單車', other: '其他'
}

const blankWorkout = (): WorkoutEntry => ({
  id: crypto.randomUUID(), type: 'walk', title: '步行', durationMinutes: 0, source: 'apple_watch'
})

const blankFood = (): Omit<CustomFood, 'id'> => ({
  name: '', basis: '100g', kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sodiumMg: 0, defaultAmount: 100
})

export function RecordPage({ date, log, foods, saveState, onDate, onChange, onSaveFood, onDeleteFood, onDone }: {
  date: string; log: DailyLog; foods: CustomFood[]; onDate: (date: string) => void
  saveState: 'saved' | 'saving' | 'error'; onChange: (patch: Partial<DailyLog>) => void
  onSaveFood: (food: CustomFood) => void; onDeleteFood: (id: string) => void; onDone: () => void
}) {
  const sleepTimesRef = useRef({ startedAt: log.sleepStartedAt, endedAt: log.sleepEndedAt })
  useEffect(() => {
    sleepTimesRef.current = { startedAt: log.sleepStartedAt, endedAt: log.sleepEndedAt }
  }, [log.sleepStartedAt, log.sleepEndedAt])
  const [newFood, setNewFood] = useState<Omit<CustomFood, 'id'>>(blankFood)
  const [editingFoodId, setEditingFoodId] = useState<string>()
  const [workoutDraft, setWorkoutDraft] = useState<WorkoutEntry>(blankWorkout)
  const [editingWorkoutId, setEditingWorkoutId] = useState<string>()
  const [showWorkoutForm, setShowWorkoutForm] = useState(false)
  const [activeTab, setActiveTab] = useState<RecordTab>('morning')
  const details = log.mealDetails ?? defaultMealDetails()
  const workouts = log.workouts ?? []

  const updateDetails = (next: MealDetails) => {
    const totals = mealTotals(next)
    onChange({
      mealDetails: next, intakeKcal: totals.kcal, proteinG: totals.protein,
      carbsG: totals.carbs, fatG: totals.fat, fiberG: totals.fiber, sodiumMg: totals.sodium
    })
  }
  const setMeal = (key: MealKey, lines: MealLine[]) => updateDetails({ ...details, [key]: lines })
  const addCustom = (food: CustomFood, meal: MealKey) => {
    const divider = food.basis === '100g' ? 100 : food.defaultAmount || 1
    setMeal(meal, [...details[meal], {
      key: `${food.id}-${crypto.randomUUID()}`, label: food.name, amount: food.defaultAmount,
      unit: food.basis === '100g' ? 'g' : '份', kcalPerUnit: food.kcal / divider,
      proteinPerUnit: food.proteinG / divider, carbsPerUnit: (food.carbsG ?? 0) / divider,
      fatPerUnit: (food.fatG ?? 0) / divider, fiberPerUnit: (food.fiberG ?? 0) / divider,
      sodiumPerUnit: (food.sodiumMg ?? 0) / divider
    }])
  }
  const saveFoodEntry = () => {
    if (!newFood.name.trim()) return
    onSaveFood({ ...newFood, name: newFood.name.trim(), id: editingFoodId ?? crypto.randomUUID() })
    setNewFood(blankFood()); setEditingFoodId(undefined)
  }
  const editFood = (food: CustomFood) => {
    setEditingFoodId(food.id)
    setNewFood({ name: food.name, basis: food.basis, kcal: food.kcal, proteinG: food.proteinG, carbsG: food.carbsG ?? 0, fatG: food.fatG ?? 0, fiberG: food.fiberG ?? 0, sodiumMg: food.sodiumMg ?? 0, defaultAmount: food.defaultAmount })
  }
  const saveWorkout = () => {
    if (!workoutDraft.title.trim() || workoutDraft.durationMinutes <= 0) return
    const next = editingWorkoutId
      ? workouts.map((workout) => workout.id === editingWorkoutId ? workoutDraft : workout)
      : [...workouts, workoutDraft]
    onChange({ workouts: next })
    setWorkoutDraft(blankWorkout()); setEditingWorkoutId(undefined); setShowWorkoutForm(false)
  }
  const editWorkout = (workout: WorkoutEntry) => { setWorkoutDraft(workout); setEditingWorkoutId(workout.id); setShowWorkoutForm(true) }
  const updateSleepTime = (key: 'sleepStartedAt' | 'sleepEndedAt', value: string) => {
    const nextTimes = {
      ...sleepTimesRef.current,
      [key === 'sleepStartedAt' ? 'startedAt' : 'endedAt']: value || undefined,
    }
    sleepTimesRef.current = nextTimes
    const sleepHours = sleepDurationHours(nextTimes.startedAt, nextTimes.endedAt)
    onChange({ [key]: value || undefined, ...(sleepHours == null ? {} : { sleepHours }) })
  }

  const previousDate = parseLocalDate(date)
  previousDate.setDate(previousDate.getDate() - 1)
  const shortDate = (value: Date) => new Intl.DateTimeFormat('zh-TW', { month: 'numeric', day: 'numeric' }).format(value)
  const currentDate = parseLocalDate(date)
  const tabs: Array<{ id: RecordTab; label: string; incomplete: boolean }> = [
    { id: 'morning', label: '晨間', incomplete: log.weightKg == null || log.sleepHours == null },
    { id: 'activity', label: '活動', incomplete: log.activeKcal == null || log.restingKcal == null },
    { id: 'food', label: '飲食', incomplete: log.intakeKcal == null || log.proteinG == null },
    { id: 'water', label: '水分', incomplete: log.waterMl == null },
    { id: 'condition', label: '狀態', incomplete: log.hungerLevel == null || log.fatigueLevel == null }
  ]

  return <section className="page record-page">
    <header className="page-header"><div><p className="eyebrow">自動儲存</p><h1>每日紀錄</h1></div><input aria-label="紀錄日期" type="date" value={date} onChange={(event) => onDate(event.target.value)} /></header>
    <p className="autosave-note">每次修改都會儲存在此裝置的 IndexedDB。</p>

    <nav className="record-tabs" aria-label="紀錄分類">
      {tabs.map((tab) => <button type="button" key={tab.id} className={activeTab === tab.id ? 'active' : ''} aria-current={activeTab === tab.id ? 'page' : undefined} onClick={() => setActiveTab(tab.id)}>{tab.label}{tab.incomplete && <i aria-label="有未完成項目" />}</button>)}
    </nav>

    {activeTab === 'morning' && <div className="record-tab-panel">
      <div className="tab-intro"><strong>起床後記錄</strong><p>體重填醒來後的數值；睡眠歸在醒來這一天。</p></div>
      <Section title="晨間" missing={log.weightKg == null}>
        <NumberField label="體重" value={log.weightKg} unit="kg" step={0.1} onChange={(weightKg) => onChange({ weightKg })} />
        <div className="segmented"><button type="button" className={log.weightCondition === 'morning_fasted' ? 'selected' : ''} onClick={() => onChange({ weightCondition: 'morning_fasted' })}>晨起空腹</button><button type="button" className={log.weightCondition === 'other' ? 'selected' : ''} onClick={() => onChange({ weightCondition: 'other' })}>其他時間</button></div>
        <NumberField label="腰圍" value={log.waistCm} unit="cm" step={0.1} onChange={(waistCm) => onChange({ waistCm })} />
      </Section>
      <Section title="前一晚睡眠" missing={log.sleepHours == null}>
        <div className="sleep-context"><strong>{shortDate(previousDate)} 晚上 → {shortDate(currentDate)} 早上</strong><p>{date} 這筆紀錄，填寫的是醒來前一晚的睡眠。</p></div>
        <div className="time-pair"><label>入睡時間<input type="time" value={log.sleepStartedAt ?? ''} onChange={(event) => updateSleepTime('sleepStartedAt', event.target.value)} /></label><label>醒來時間<input type="time" value={log.sleepEndedAt ?? ''} onChange={(event) => updateSleepTime('sleepEndedAt', event.target.value)} /></label></div>
        {log.sleepStartedAt && log.sleepEndedAt && <p className="calculated-note">已依起訖時間自動計算；仍可在下方手動修正。</p>}
        <NumberField label="前一晚睡眠時間" value={log.sleepHours} unit="小時" step={0.25} onChange={(sleepHours) => onChange({ sleepHours })} />
        <SelectScale label="前一晚睡眠品質" value={log.sleepQuality} onChange={(sleepQuality) => onChange({ sleepQuality: sleepQuality as DailyLog['sleepQuality'] })} />
      </Section>
    </div>}

    {activeTab === 'activity' && <div className="record-tab-panel">
      <div className="tab-intro"><strong>Apple Watch 每日摘要</strong><p>從「健身」或「健康」App 手動抄入；PWA 無法直接讀取 HealthKit。</p></div>
      <Section title="每日活動總覽" missing={log.activeKcal == null || log.restingKcal == null}>
        <NumberField label="Apple Watch 活動能量" value={log.activeKcal} unit="kcal" quick={[50, 100]} onChange={(activeKcal) => onChange({ activeKcal })} />
        <NumberField label="Apple Watch 靜態能量" value={log.restingKcal} unit="kcal" quick={[100]} onChange={(restingKcal) => onChange({ restingKcal })} />
        <NumberField label="運動時間" value={log.exerciseMinutes} unit="分鐘" quick={[10, 15]} onChange={(exerciseMinutes) => onChange({ exerciseMinutes })} />
        <NumberField label="步數" value={log.steps} unit="步" step={100} quick={[1000]} onChange={(steps) => onChange({ steps })} />
        <NumberField label="距離" value={log.distanceKm} unit="km" step={0.1} onChange={(distanceKm) => onChange({ distanceKm })} />
        <NumberField label="站立時數" value={log.standingHours} unit="小時" onChange={(standingHours) => onChange({ standingHours })} />
        <NumberField label="平均運動心率" value={log.averageExerciseHeartRate} unit="bpm" onChange={(averageExerciseHeartRate) => onChange({ averageExerciseHeartRate })} />
      </Section>
      <Section title="恢復指標" open={false}>
        <NumberField label="靜息心率" value={log.restingHeartRate} unit="bpm" onChange={(restingHeartRate) => onChange({ restingHeartRate })} />
        <NumberField label="心率變異度 HRV" value={log.heartRateVariabilityMs} unit="ms" onChange={(heartRateVariabilityMs) => onChange({ heartRateVariabilityMs })} />
        <p className="fine-print">這些數值受量測時機與裝置影響，適合看長期趨勢，不做醫療判斷。</p>
      </Section>
      <Section title={`運動明細 ${workouts.length ? `· ${workouts.length} 筆` : ''}`}>
        <div className="workout-list">{workouts.length === 0 ? <p className="empty">尚無運動明細。每日活動總量仍可獨立使用。</p> : workouts.map((workout) => <article key={workout.id} className="workout-card">
          <div><span>{workoutLabels[workout.type]} · {workout.source === 'apple_watch' ? 'Apple Watch' : '手動'}</span><strong>{workout.title}</strong><small>{workout.durationMinutes} 分{workout.distanceKm != null ? ` · ${workout.distanceKm} km` : ''}{workout.activeKcal != null ? ` · ${workout.activeKcal} kcal` : ''}</small></div>
          <div><button type="button" onClick={() => editWorkout(workout)}>編輯</button><button type="button" className="danger-text" onClick={() => onChange({ workouts: workouts.filter((item) => item.id !== workout.id) })}>刪除</button></div>
        </article>)}</div>
        {!showWorkoutForm && <button type="button" className="primary add-detail-button" onClick={() => setShowWorkoutForm(true)}>＋ 新增運動明細</button>}
        {showWorkoutForm && <div className="workout-form panel-inner">
          <div className="form-title"><strong>{editingWorkoutId ? '編輯運動' : '新增運動'}</strong><span>不會重複加到每日活動能量</span></div>
          <label className="select-field">類型<select value={workoutDraft.type} onChange={(event) => { const type = event.target.value as WorkoutType; setWorkoutDraft({ ...workoutDraft, type, title: workoutLabels[type] }) }}>{Object.entries(workoutLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="text-field">名稱<input value={workoutDraft.title} onChange={(event) => setWorkoutDraft({ ...workoutDraft, title: event.target.value })} /></label>
          <label className="select-field">開始時間<input type="time" value={workoutDraft.startTime ?? ''} onChange={(event) => setWorkoutDraft({ ...workoutDraft, startTime: event.target.value || undefined })} /></label>
          <div className="compact-field-grid">
            <NumberField label="時長" value={workoutDraft.durationMinutes} unit="分" onChange={(durationMinutes) => setWorkoutDraft({ ...workoutDraft, durationMinutes: durationMinutes ?? 0 })} />
            <NumberField label="活動能量" value={workoutDraft.activeKcal} unit="kcal" onChange={(activeKcal) => setWorkoutDraft({ ...workoutDraft, activeKcal })} />
            <NumberField label="總能量" value={workoutDraft.totalKcal} unit="kcal" onChange={(totalKcal) => setWorkoutDraft({ ...workoutDraft, totalKcal })} />
            <NumberField label="距離" value={workoutDraft.distanceKm} unit="km" step={0.1} onChange={(distanceKm) => setWorkoutDraft({ ...workoutDraft, distanceKm })} />
            <NumberField label="平均心率" value={workoutDraft.averageHeartRate} unit="bpm" onChange={(averageHeartRate) => setWorkoutDraft({ ...workoutDraft, averageHeartRate })} />
            <NumberField label="最高心率" value={workoutDraft.maxHeartRate} unit="bpm" onChange={(maxHeartRate) => setWorkoutDraft({ ...workoutDraft, maxHeartRate })} />
          </div>
          <SelectScale label="主觀強度 RPE" max={10} value={workoutDraft.perceivedExertion} onChange={(perceivedExertion) => setWorkoutDraft({ ...workoutDraft, perceivedExertion: perceivedExertion as WorkoutEntry['perceivedExertion'] })} />
          {workoutDraft.type === 'strength' && <div className="strength-fields"><label className="text-field">肌群／動作<input placeholder="例如：腿、深蹲" value={workoutDraft.muscleGroup ?? ''} onChange={(event) => setWorkoutDraft({ ...workoutDraft, muscleGroup: event.target.value })} /></label><div className="compact-field-grid"><NumberField label="組數" value={workoutDraft.sets} onChange={(sets) => setWorkoutDraft({ ...workoutDraft, sets })} /><NumberField label="每組次數" value={workoutDraft.reps} onChange={(reps) => setWorkoutDraft({ ...workoutDraft, reps })} /><NumberField label="重量" value={workoutDraft.weightKg} unit="kg" step={0.5} onChange={(weightKg) => setWorkoutDraft({ ...workoutDraft, weightKg })} /><NumberField label="保留次數 RIR" value={workoutDraft.rir} max={10} onChange={(rir) => setWorkoutDraft({ ...workoutDraft, rir })} /></div></div>}
          <label className="select-field">來源<select value={workoutDraft.source} onChange={(event) => setWorkoutDraft({ ...workoutDraft, source: event.target.value as WorkoutEntry['source'] })}><option value="apple_watch">Apple Watch</option><option value="manual">手動紀錄</option></select></label>
          <label className="text-field">備註<textarea rows={2} value={workoutDraft.notes ?? ''} onChange={(event) => setWorkoutDraft({ ...workoutDraft, notes: event.target.value })} /></label>
          <div className="form-actions"><button type="button" className="primary" disabled={!workoutDraft.title.trim() || workoutDraft.durationMinutes <= 0} onClick={saveWorkout}>{editingWorkoutId ? '儲存修改' : '加入運動'}</button><button type="button" onClick={() => { setWorkoutDraft(blankWorkout()); setEditingWorkoutId(undefined); setShowWorkoutForm(false) }}>取消</button></div>
        </div>}
        {(log.slowJogMinutes != null || log.slowJogActiveKcal != null) && <div className="legacy-note">舊版超慢跑：{log.slowJogMinutes ?? 0} 分 · {log.slowJogActiveKcal ?? 0} kcal（保留舊紀錄，不重複計算）</div>}
      </Section>
    </div>}

    {activeTab === 'food' && <div className="record-tab-panel">
      <div className="nutrition-overview panel">
        <div><span>熱量</span><strong>{log.intakeKcal ?? '—'}<small> kcal</small></strong></div><div><span>蛋白質</span><strong>{log.proteinG ?? '—'}<small> g</small></strong></div><div><span>碳水</span><strong>{log.carbsG ?? '—'}<small> g</small></strong></div><div><span>脂肪</span><strong>{log.fatG ?? '—'}<small> g</small></strong></div><div><span>纖維</span><strong>{log.fiberG ?? '—'}<small> g</small></strong></div><div><span>鈉</span><strong>{log.sodiumMg ?? '—'}<small> mg</small></strong></div>
      </div>
      <Section title="飲食" missing={log.intakeKcal == null || log.proteinG == null}>
        <div className="segmented"><button type="button" className={log.mealMode !== 'detailed' ? 'selected' : ''} onClick={() => onChange({ mealMode: 'quick' })}>快速總量</button><button type="button" className={log.mealMode === 'detailed' ? 'selected' : ''} onClick={() => onChange({ mealMode: 'detailed' })}>詳細餐點</button></div>
        {log.mealMode !== 'detailed' ? <div className="compact-field-grid nutrition-fields">
          <NumberField label="今日總熱量" value={log.intakeKcal} unit="kcal" quick={[100, 250]} onChange={(intakeKcal) => onChange({ intakeKcal })} />
          <NumberField label="蛋白質" value={log.proteinG} unit="g" quick={[10, 20]} onChange={(proteinG) => onChange({ proteinG })} />
          <NumberField label="碳水" value={log.carbsG} unit="g" onChange={(carbsG) => onChange({ carbsG })} />
          <NumberField label="脂肪" value={log.fatG} unit="g" onChange={(fatG) => onChange({ fatG })} />
          <NumberField label="纖維" value={log.fiberG} unit="g" onChange={(fiberG) => onChange({ fiberG })} />
          <NumberField label="鈉" value={log.sodiumMg} unit="mg" step={10} onChange={(sodiumMg) => onChange({ sodiumMg })} />
        </div> : <div className="detailed-meals">
          <p className="fine-print estimate-note">預設營養值為一般估算；品牌、烹調方式差異很大，請以包裝標示或實際秤重為準。</p>
          <MealEditor title="早餐" lines={details.breakfast} onChange={(lines) => setMeal('breakfast', lines)} />
          <MealEditor title="午餐" lines={details.lunch} onChange={(lines) => setMeal('lunch', lines)} />
          <MealEditor title="晚餐" lines={details.dinner} onChange={(lines) => setMeal('dinner', lines)} />
          <MealEditor title="點心／晚間" lines={details.evening} onChange={(lines) => setMeal('evening', lines)} />
          <details className="ramen panel-inner"><summary>泡麵快速模板</summary><label className="toggle-row"><span>今天有吃泡麵</span><input type="checkbox" checked={details.ramen.enabled} onChange={(event) => updateDetails({ ...details, ramen: { ...details.ramen, enabled: event.target.checked } })} /></label>{details.ramen.enabled && <>
            <div className="compact-field-grid nutrition-fields"><NumberField label="包裝整份熱量" value={details.ramen.packageKcal} unit="kcal" onChange={(packageKcal) => updateDetails({ ...details, ramen: { ...details.ramen, packageKcal: packageKcal ?? 0 } })} /><NumberField label="包裝蛋白質" value={details.ramen.packageProteinG} unit="g" onChange={(packageProteinG) => updateDetails({ ...details, ramen: { ...details.ramen, packageProteinG } })} /><NumberField label="包裝碳水" value={details.ramen.packageCarbsG} unit="g" onChange={(packageCarbsG) => updateDetails({ ...details, ramen: { ...details.ramen, packageCarbsG } })} /><NumberField label="包裝脂肪" value={details.ramen.packageFatG} unit="g" onChange={(packageFatG) => updateDetails({ ...details, ramen: { ...details.ramen, packageFatG } })} /><NumberField label="包裝鈉" value={details.ramen.packageSodiumMg} unit="mg" step={10} onChange={(packageSodiumMg) => updateDetails({ ...details, ramen: { ...details.ramen, packageSodiumMg } })} /></div>
            {(['noodleRatio', 'seasoningRatio', 'oilRatio'] as const).map((key) => <label className="select-field" key={key}>{key === 'noodleRatio' ? '麵體比例' : key === 'seasoningRatio' ? '調味包比例' : '油包比例'}<select value={details.ramen[key]} onChange={(event) => updateDetails({ ...details, ramen: { ...details.ramen, [key]: Number(event.target.value) } })}><option value={0.5}>1/2</option><option value={2 / 3}>2/3</option><option value={1}>整份</option></select></label>)}
            <label className="toggle-row"><span>有喝湯</span><input type="checkbox" checked={details.ramen.drankSoup} onChange={(event) => updateDetails({ ...details, ramen: { ...details.ramen, drankSoup: event.target.checked } })} /></label>
            <NumberField label="加雞胸肉" value={details.ramen.chickenG} unit="g" step={10} onChange={(chickenG) => updateDetails({ ...details, ramen: { ...details.ramen, chickenG: chickenG ?? 0 } })} />
            <NumberField label="加蔬菜" value={details.ramen.vegetablesG} unit="g" step={10} onChange={(vegetablesG) => updateDetails({ ...details, ramen: { ...details.ramen, vegetablesG: vegetablesG ?? 0 } })} />
          </>}</details>
          <div className="meal-total"><span>詳細餐點自動加總</span><strong>{log.intakeKcal ?? 0} kcal · {log.proteinG ?? 0} g 蛋白質</strong></div>
        </div>}
        <div className="check-grid">{[
          ['breakfastPlanCompleted', '早餐計畫'], ['lunchPlateCompleted', '午餐餐盤'], ['dinnerPlateCompleted', '晚餐餐盤'], ['soyChiaCompleted', '豆漿奇亞籽']
        ].map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(log[key as keyof DailyLog])} onChange={(event) => onChange({ [key]: event.target.checked })} />{label}</label>)}</div>
        <label className="toggle-row"><span>高鹽餐</span><input type="checkbox" checked={Boolean(log.highSaltMeal)} onChange={(event) => onChange({ highSaltMeal: event.target.checked })} /></label>
        <label className="toggle-row"><span>已補充肌酸</span><input type="checkbox" checked={Boolean(log.creatineTaken)} onChange={(event) => onChange({ creatineTaken: event.target.checked })} /></label>
        <label className="select-field">晚餐完成時間<input type="time" value={log.dinnerFinishedAt ?? ''} onChange={(event) => onChange({ dinnerFinishedAt: event.target.value })} /></label>
      </Section>

      <Section title="自訂食物資料庫" open={false}>
        <p className="fine-print">建立後可加到任一餐。加入時會複製當下營養值，之後修改資料庫不會改變舊紀錄。</p>
        <div className="food-form">
          <input aria-label="食物名稱" placeholder="食物名稱" value={newFood.name} onChange={(event) => setNewFood({ ...newFood, name: event.target.value })} />
          <select aria-label="計算基準" value={newFood.basis} onChange={(event) => setNewFood({ ...newFood, basis: event.target.value as CustomFood['basis'] })}><option value="100g">每 100g</option><option value="serving">每份</option></select>
          {([['kcal', '熱量 kcal'], ['proteinG', '蛋白質 g'], ['carbsG', '碳水 g'], ['fatG', '脂肪 g'], ['fiberG', '纖維 g'], ['sodiumMg', '鈉 mg'], ['defaultAmount', '預設份量']] as const).map(([key, placeholder]) => <input key={key} aria-label={placeholder} inputMode="decimal" type="number" min="0" placeholder={placeholder} value={newFood[key] || ''} onChange={(event) => setNewFood({ ...newFood, [key]: Number(event.target.value) })} />)}
          <button type="button" className="primary" disabled={!newFood.name.trim()} onClick={saveFoodEntry}>{editingFoodId ? '儲存食物修改' : '新增食物'}</button>
          {editingFoodId && <button type="button" onClick={() => { setEditingFoodId(undefined); setNewFood(blankFood()) }}>取消編輯</button>}
        </div>
        <div className="food-list">{foods.length === 0 ? <p className="empty">尚未建立自訂食物。</p> : foods.map((food) => <article key={food.id}><span><strong>{food.name}</strong><small>{food.kcal} kcal · P {food.proteinG} g · C {food.carbsG ?? 0} g · F {food.fatG ?? 0} g</small></span><div className="food-actions"><select aria-label={`${food.name}加入餐次`} defaultValue="lunch" id={`meal-${food.id}`}><option value="breakfast">早餐</option><option value="lunch">午餐</option><option value="dinner">晚餐</option><option value="evening">點心</option></select><button type="button" onClick={() => { const select = document.getElementById(`meal-${food.id}`) as HTMLSelectElement | null; addCustom(food, (select?.value ?? 'lunch') as MealKey) }}>加入</button><button type="button" onClick={() => editFood(food)}>編輯</button><button type="button" className="danger-text" onClick={() => onDeleteFood(food.id)}>刪除</button></div></article>)}</div>
      </Section>
    </div>}

    {activeTab === 'water' && <div className="record-tab-panel"><Section title="水分" missing={log.waterMl == null}><NumberField label="白開水" value={log.waterMl} unit="ml" step={250} quick={[250, 500]} onChange={(waterMl) => onChange({ waterMl })} /></Section></div>}

    {activeTab === 'condition' && <div className="record-tab-panel">
      <Section title="排便"><div className="segmented"><button type="button" className={log.bowelMovement === 'yes' ? 'selected' : ''} onClick={() => onChange({ bowelMovement: 'yes' })}>有排便</button><button type="button" className={log.bowelMovement !== 'yes' ? 'selected' : ''} onClick={() => onChange({ bowelMovement: 'none', bristolType: undefined })}>沒有</button></div>{log.bowelMovement === 'yes' && <SelectScale label="Bristol 型態" max={7} value={log.bristolType} onChange={(bristolType) => onChange({ bristolType: bristolType as DailyLog['bristolType'] })} />}</Section>
      <Section title="身體感受"><SelectScale label="飢餓程度" value={log.hungerLevel} onChange={(hungerLevel) => onChange({ hungerLevel: hungerLevel as DailyLog['hungerLevel'] })} /><SelectScale label="疲勞程度" value={log.fatigueLevel} onChange={(fatigueLevel) => onChange({ fatigueLevel: fatigueLevel as DailyLog['fatigueLevel'] })} /></Section>
      <Section title="備註"><textarea aria-label="備註" rows={4} placeholder="今天的感受、飲食或其他觀察…" value={log.notes ?? ''} onChange={(event) => onChange({ notes: event.target.value })} /></Section>
    </div>}
    <div className={`record-save-bar ${saveState}`} role="status" aria-live="polite">
      <div><i /><span><strong>{saveState === 'saving' ? '儲存中…' : saveState === 'error' ? '儲存失敗' : '已自動儲存'}</strong><small>{saveState === 'error' ? '請不要關閉頁面，重試修改一次' : '每次修改都已保存，不需另外按儲存'}</small></span></div>
      <button type="button" className="primary" disabled={saveState === 'saving' || saveState === 'error'} onClick={onDone}>完成紀錄，回首頁</button>
    </div>
  </section>
}
