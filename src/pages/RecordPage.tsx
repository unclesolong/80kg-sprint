import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Moon, Plus, Scale, Utensils } from 'lucide-react'
import { dailyDeficit, effectiveActiveKcal, estimatedTDEE, parseLocalDate, sleepDurationHours } from '../calculations'
import type { ChallengeSettings, CustomFood, DailyLog, MealDetails, RecordStage, WorkoutEntry, WorkoutType } from '../types'
import { addMealLine, customFoodMealLine, duplicateMealLine, ensureMealDetails, mealKeys, mealLabels, moveMealLine, nutritionPatch, removeMealLine, restoreMealLine, updateMealLineAmount, type MealKey, type RemovedMealLine } from '../mealOperations'
import { FoodAddSheet } from '../components/FoodAddSheet'
import { MealCard } from '../components/MealCard'
import { NumberField } from '../components/NumberField'

const Section = ({ title, missing, open = true, children }: { title: string; missing?: boolean; open?: boolean; children: React.ReactNode }) => <details className="form-section standard-card" open={open}>
  <summary><span>{title}</span>{missing && <em>尚未完成</em>}</summary><div className="section-body">{children}</div>
</details>

const SelectScale = ({ label, value, min = 1, max = 5, onChange }: { label: string; value?: number; min?: number; max?: number; onChange: (value: number) => void }) => <div className="field-block"><label>{label}</label><div className="scale">{Array.from({ length: max - min + 1 }, (_, i) => i + min).map((number) => <button type="button" className={value === number ? 'selected' : ''} onClick={() => onChange(number)} key={number}>{number}</button>)}</div></div>

const workoutLabels: Record<WorkoutType, string> = { walk: '步行', slow_jog: '超慢跑', run: '跑步', strength: '重量訓練', cycling: '單車', other: '其他' }
const blankWorkout = (): WorkoutEntry => ({ id: crypto.randomUUID(), type: 'walk', title: '步行', durationMinutes: 0, source: 'apple_watch', activityKcalMode: 'included_in_daily_total' })
const blankFood = (): Omit<CustomFood, 'id'> => ({ name: '', basis: '100g', kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sodiumMg: 0, defaultAmount: 100 })
export function RecordPage({ date, log, logs, foods, settings, initialStage, saveState, onDate, onChange, onSaveFood, onDeleteFood }: {
  date: string
  log: DailyLog
  logs: DailyLog[]
  foods: CustomFood[]
  settings: ChallengeSettings
  initialStage: RecordStage
  saveState: 'saved' | 'saving' | 'error'
  onDate: (date: string) => void
  onChange: (patch: Partial<DailyLog>) => void
  onSaveFood: (food: CustomFood) => void
  onDeleteFood: (id: string) => void
}) {
  const [activeStage, setActiveStage] = useState<RecordStage>(initialStage)
  const [newFood, setNewFood] = useState<Omit<CustomFood, 'id'>>(blankFood)
  const [editingFoodId, setEditingFoodId] = useState<string>()
  const [workoutDraft, setWorkoutDraft] = useState<WorkoutEntry>(blankWorkout)
  const [editingWorkoutId, setEditingWorkoutId] = useState<string>()
  const [showWorkoutForm, setShowWorkoutForm] = useState(false)
  const [copyMessage, setCopyMessage] = useState('')
  const [foodSheet, setFoodSheet] = useState<{ meal: MealKey; tab?: 'common' | 'templates' | 'mine' | 'manual'; templateId?: string }>()
  const [expandedMeal, setExpandedMeal] = useState<MealKey>()
  const [deletedMealLine, setDeletedMealLine] = useState<{ removed: RemovedMealLine; details: MealDetails }>()
  const [justFinalized, setJustFinalized] = useState(false)
  const sleepTimesRef = useRef({ startedAt: log.sleepStartedAt, endedAt: log.sleepEndedAt })
  const finalizeTimer = useRef<number | undefined>(undefined)
  const deleteTimer = useRef<number | undefined>(undefined)

  useEffect(() => setActiveStage(initialStage), [initialStage, date])
  useEffect(() => { sleepTimesRef.current = { startedAt: log.sleepStartedAt, endedAt: log.sleepEndedAt } }, [log.sleepStartedAt, log.sleepEndedAt])
  useEffect(() => () => { if (finalizeTimer.current) window.clearTimeout(finalizeTimer.current); if (deleteTimer.current) window.clearTimeout(deleteTimer.current) }, [])

  const details = ensureMealDetails(log)
  const workouts = log.workouts ?? []
  const templates = settings.foodTemplates ?? []
  const activityValue = effectiveActiveKcal(log)
  const finalTdee = log.dayFinalized ? estimatedTDEE(log) : undefined
  const finalDeficit = log.dayFinalized ? dailyDeficit(log) : undefined
  const eveningMissing = [activityValue, log.restingKcal, log.exerciseMinutes, log.steps, log.hungerLevel, log.fatigueLevel, log.highSaltMeal].some((value) => value == null)

  const previousDate = parseLocalDate(date); previousDate.setDate(previousDate.getDate() - 1)
  const currentDate = parseLocalDate(date)
  const shortDate = (value: Date) => new Intl.DateTimeFormat('zh-TW', { month: 'numeric', day: 'numeric' }).format(value)
  const updateFood = (patch: Partial<DailyLog>) => onChange({ ...patch, foodUpdatedAt: new Date().toISOString() })
  const updateActivity = (patch: Partial<DailyLog>) => onChange({ ...patch, activityUpdatedAt: new Date().toISOString() })
  const updateDetails = (next: MealDetails) => {
    updateFood(nutritionPatch(next))
  }
  const cloneDetails = (source: MealDetails): MealDetails => ({
    breakfast: source.breakfast.map((line) => ({ ...line, key: `${line.key}-${crypto.randomUUID()}` })),
    lunch: source.lunch.map((line) => ({ ...line, key: `${line.key}-${crypto.randomUUID()}` })),
    dinner: source.dinner.map((line) => ({ ...line, key: `${line.key}-${crypto.randomUUID()}` })),
    evening: source.evening.map((line) => ({ ...line, key: `${line.key}-${crypto.randomUUID()}` })),
    ramen: { ...source.ramen }
  })
  const dateKey = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  const showCopyMessage = (message: string) => { setCopyMessage(message); window.setTimeout(() => setCopyMessage(''), 3500) }
  const copyYesterdayBreakfast = () => {
    const source = logs.find((item) => item.date === dateKey(previousDate))?.mealDetails
    if (!source) return showCopyMessage('昨天沒有可複製的早餐')
    updateDetails({ ...details, breakfast: cloneDetails(source).breakfast })
    showCopyMessage('已複製昨天早餐')
  }
  const copyYesterdayFood = () => {
    const source = logs.find((item) => item.date === dateKey(previousDate))?.mealDetails
    if (!source) return showCopyMessage('昨天沒有可複製的飲食')
    updateDetails(cloneDetails(source))
    showCopyMessage('已複製昨天整天飲食')
  }
  const copyRecentChickenMeal = () => {
    const source = [...logs].filter((item) => item.date < date && item.mealDetails).sort((a, b) => b.date.localeCompare(a.date)).map((item) => {
      const mealDetails = item.mealDetails!
      const meal = (['lunch', 'dinner'] as const).find((key) => mealDetails[key].some((line) => line.label.includes('雞胸')))
      return meal ? { meal, details: mealDetails } : undefined
    }).find(Boolean)
    if (!source) return showCopyMessage('找不到最近的雞胸餐')
    const copied = cloneDetails(source.details)
    updateDetails({ ...details, [source.meal]: copied[source.meal] })
    showCopyMessage('已複製最近一次雞胸餐')
  }
  const updateSleepTime = (key: 'sleepStartedAt' | 'sleepEndedAt', value: string) => {
    const nextTimes = { ...sleepTimesRef.current, [key === 'sleepStartedAt' ? 'startedAt' : 'endedAt']: value || undefined }
    sleepTimesRef.current = nextTimes
    const sleepHours = sleepDurationHours(nextTimes.startedAt, nextTimes.endedAt)
    onChange({ [key]: value || undefined, ...(sleepHours == null ? {} : { sleepHours }) })
  }

  const addCustom = (food: CustomFood, meal: MealKey) => {
    updateDetails(addMealLine(details, meal, customFoodMealLine(food)))
    setExpandedMeal(meal)
    showCopyMessage(`已加入${mealLabels[meal]}：${food.name}`)
  }
  const saveFoodEntry = () => {
    if (!newFood.name.trim()) return
    onSaveFood({ ...newFood, name: newFood.name.trim(), id: editingFoodId ?? crypto.randomUUID() })
    setNewFood(blankFood()); setEditingFoodId(undefined)
  }
  const editFood = (food: CustomFood) => { setEditingFoodId(food.id); setNewFood({ name: food.name, basis: food.basis, kcal: food.kcal, proteinG: food.proteinG, carbsG: food.carbsG ?? 0, fatG: food.fatG ?? 0, fiberG: food.fiberG ?? 0, sodiumMg: food.sodiumMg ?? 0, defaultAmount: food.defaultAmount }) }

  const saveWorkout = () => {
    if (workoutDraft.durationMinutes <= 0 || (workoutDraft.activityKcalMode === 'add_to_daily_total' && workoutDraft.activeKcal == null)) return
    const normalized = { ...workoutDraft, title: workoutDraft.title.trim() || workoutLabels[workoutDraft.type] }
    const next = editingWorkoutId ? workouts.map((workout) => workout.id === editingWorkoutId ? normalized : workout) : [...workouts, normalized]
    updateActivity({ workouts: next })
    setWorkoutDraft(blankWorkout()); setEditingWorkoutId(undefined); setShowWorkoutForm(false)
  }
  const editWorkout = (workout: WorkoutEntry) => { setWorkoutDraft({ ...workout, activityKcalMode: workout.activityKcalMode ?? 'included_in_daily_total' }); setEditingWorkoutId(workout.id); setShowWorkoutForm(true) }

  const finalizeDay = () => {
    if (eveningMissing || log.dayFinalized) return
    onChange({ dayFinalized: true, finalizedAt: new Date().toISOString(), needsRefinalization: false })
    setJustFinalized(true)
    if (finalizeTimer.current) window.clearTimeout(finalizeTimer.current)
    finalizeTimer.current = window.setTimeout(() => setJustFinalized(false), 2200)
  }

  const stages: Array<{ id: RecordStage; label: string; sub: string; incomplete: boolean; complete: boolean; Icon: typeof Scale }> = [
    { id: 'morning', label: '早上', sub: '20 秒', incomplete: log.weightKg == null || log.sleepHours == null || log.bowelMovement === 'unrecorded' || log.lowerLegTightness == null, complete: log.weightKg != null && log.sleepHours != null && log.bowelMovement !== 'unrecorded' && log.lowerLegTightness != null, Icon: Scale },
    { id: 'food', label: '飲食', sub: '隨吃隨記', incomplete: log.intakeKcal == null || log.proteinG == null || log.waterMl == null, complete: log.intakeKcal != null && log.proteinG != null && log.waterMl != null, Icon: Utensils },
    { id: 'evening', label: '晚上', sub: '30 秒', incomplete: eveningMissing || !log.dayFinalized, complete: Boolean(log.dayFinalized), Icon: Moon }
  ]

  return <section className="page record-page sprint-record">
    <header className="page-header"><div><p className="eyebrow">每天三次 · 自動儲存</p><h1>每日紀錄</h1></div><input aria-label="紀錄日期" type="date" value={date} onChange={(event) => onDate(event.target.value)} /></header>
    <nav className="stage-tabs" aria-label="每日三階段">{stages.map((stage, index) => <button type="button" key={stage.id} className={`${activeStage === stage.id ? 'active' : ''} ${stage.complete ? 'complete' : ''}`} onClick={() => setActiveStage(stage.id)}><b>{stage.complete ? <Check /> : index + 1}</b><span>{stage.label}{stage.incomplete && !stage.complete && <i aria-label="尚未完成" />}</span><small>{stage.sub}</small></button>)}</nav>

    {activeStage === 'morning' && <div className="record-tab-panel">
      <div className="tab-intro"><strong>早上約 20 秒</strong><p>體重、前一晚睡眠、排便與下肢恢復；腰圍不需要天天量。</p></div>
      <Section title="今天早上的核心紀錄" missing={stages[0].incomplete}>
        <NumberField label="晨間體重" value={log.weightKg} unit="kg" step={0.1} onChange={(weightKg) => onChange({ weightKg, weightCondition: 'morning_fasted' })} />
        <div className="sleep-context"><strong>{shortDate(previousDate)} 晚上 → {shortDate(currentDate)} 早上</strong><p>睡眠歸在醒來這一天。</p></div>
        <div className="time-pair"><label>入睡時間<input type="time" value={log.sleepStartedAt ?? ''} onChange={(event) => updateSleepTime('sleepStartedAt', event.target.value)} /></label><label>醒來時間<input type="time" value={log.sleepEndedAt ?? ''} onChange={(event) => updateSleepTime('sleepEndedAt', event.target.value)} /></label></div>
        <NumberField label="前一晚睡眠時間" value={log.sleepHours} unit="小時" step={0.25} onChange={(sleepHours) => onChange({ sleepHours })} />
        <div className="field-block"><label>今天有排便嗎？</label><div className="segmented"><button type="button" className={log.bowelMovement === 'yes' ? 'selected' : ''} onClick={() => onChange({ bowelMovement: 'yes' })}>有</button><button type="button" className={log.bowelMovement === 'none' ? 'selected' : ''} onClick={() => onChange({ bowelMovement: 'none', bristolType: undefined })}>沒有</button></div></div>
        {log.bowelMovement === 'yes' && <SelectScale label="Bristol 型態" max={7} value={log.bristolType} onChange={(bristolType) => onChange({ bristolType: bristolType as DailyLog['bristolType'] })} />}
        <SelectScale label="下肢緊繃／疼痛（0 無、5 很明顯）" min={0} max={5} value={log.lowerLegTightness} onChange={(lowerLegTightness) => onChange({ lowerLegTightness: lowerLegTightness as DailyLog['lowerLegTightness'] })} />
        {(log.lowerLegTightness ?? 0) >= 2 && <p className="recovery-inline">2：今天不補跑；3 以上：改走路或休息，不追活動數字。</p>}
      </Section>
      <Section title="顯示進階欄位" open={false}>
        <SelectScale label="睡眠品質" value={log.sleepQuality} onChange={(sleepQuality) => onChange({ sleepQuality: sleepQuality as DailyLog['sleepQuality'] })} />
        <NumberField label="腰圍（每週約2次）" value={log.waistCm} unit="cm" step={0.1} onChange={(waistCm) => onChange({ waistCm })} />
        <label className="text-field">疼痛／緊繃備註<textarea rows={3} placeholder="位置、何時出現、是否影響走路…" value={log.painNotes ?? ''} onChange={(event) => onChange({ painNotes: event.target.value })} /></label>
      </Section>
    </div>}

    {activeStage === 'food' && <div className="record-tab-panel">
      <div className="tab-intro"><strong>白天隨吃隨記</strong><p>主要只看總熱量、蛋白質與白開水；其餘營養素放在進階區。</p></div>
      <section className="food-total-block" aria-labelledby="food-total-title"><div className="flat-heading"><div><h2 id="food-total-title">今日總計</h2><span>由早餐、午餐、晚餐與點心自動加總</span></div><button type="button" className="quick-manual-button" onClick={() => setFoodSheet({ meal: 'lunch', tab: 'manual' })}><Plus />快速新增自訂餐點</button></div><div className="food-core-summary panel"><div><span>已吃</span><strong>{Math.round(log.intakeKcal ?? 0)}<small> kcal</small></strong></div><div><span>蛋白質</span><strong>{Math.round(log.proteinG ?? 0)}<small> g</small></strong></div><div><span>白開水</span><strong>{Math.round(log.waterMl ?? 0)}<small> ml</small></strong></div></div></section>
      <section className="today-meals" aria-labelledby="today-meals-title"><div className="flat-heading"><div><h2 id="today-meals-title">今日餐點</h2><span>點餐次查看明細；每餐都可直接新增</span></div></div>{mealKeys.map((meal) => <MealCard key={meal} meal={meal} lines={details[meal]} open={expandedMeal === meal} onToggle={() => setExpandedMeal(expandedMeal === meal ? undefined : meal)} onAdd={() => { setExpandedMeal(meal); setFoodSheet({ meal }) }} onAmount={(key, amount) => updateDetails(updateMealLineAmount(details, meal, key, amount))} onMove={(key, target) => { updateDetails(moveMealLine(details, meal, target, key)); setExpandedMeal(target) }} onDuplicate={(key) => updateDetails(duplicateMealLine(details, meal, key))} onDelete={(key) => { const result = removeMealLine(details, meal, key); if (!result.removed) return; updateDetails(result.details); setDeletedMealLine({ removed: result.removed, details: result.details }); if (deleteTimer.current) window.clearTimeout(deleteTimer.current); deleteTimer.current = window.setTimeout(() => setDeletedMealLine(undefined), 5000) }} />)}</section>
      <Section title="快捷套餐"><p className="fine-print estimate-note">餐次只是預設值；加入前可改成早餐、午餐、晚餐或點心。</p><div className="food-shortcuts">{templates.map((template) => <button type="button" key={template.id} onClick={() => setFoodSheet({ meal: template.meal, tab: 'templates', templateId: template.id })}><strong>{template.name}</strong><small>約 {Math.round(template.kcal)} kcal · P {Math.round(template.proteinG)}g</small></button>)}</div><div className="copy-food-inline"><strong>快速沿用</strong><div className="copy-actions"><button onClick={copyYesterdayBreakfast}><Copy />昨天早餐</button><button onClick={copyYesterdayFood}><Copy />昨天整天</button><button onClick={copyRecentChickenMeal}><Copy />最近雞胸餐</button></div></div></Section>
      <Section title="白開水" missing={log.waterMl == null}>
        <NumberField label="今日白開水" value={log.waterMl} unit="ml" step={250} quick={[250, 500]} onChange={(waterMl) => onChange({ waterMl })} />
      </Section>
      <Section title="顯示進階欄位" open={false}>
        <p className="fine-print estimate-note">營養素皆由餐點明細自動加總。</p><div className="nutrition-readonly"><div><span>碳水</span><strong>{Math.round(log.carbsG ?? 0)} g</strong></div><div><span>脂肪</span><strong>{Math.round(log.fatG ?? 0)} g</strong></div><div><span>纖維</span><strong>{Math.round(log.fiberG ?? 0)} g</strong></div><div><span>鈉</span><strong>{Math.round(log.sodiumMg ?? 0)} mg</strong></div></div>
        <details className="ramen panel-inner"><summary>泡麵雞胸版詳細比例</summary><label className="toggle-row"><span>今天有吃泡麵</span><input type="checkbox" checked={details.ramen.enabled} onChange={(event) => updateDetails({ ...details, ramen: { ...details.ramen, enabled: event.target.checked } })} /></label>{details.ramen.enabled && <><div className="compact-field-grid nutrition-fields"><NumberField label="包裝整份熱量" value={details.ramen.packageKcal} unit="kcal" onChange={(packageKcal) => updateDetails({ ...details, ramen: { ...details.ramen, packageKcal: packageKcal ?? 0 } })} /><NumberField label="包裝蛋白質" value={details.ramen.packageProteinG} unit="g" onChange={(packageProteinG) => updateDetails({ ...details, ramen: { ...details.ramen, packageProteinG } })} /><NumberField label="包裝碳水" value={details.ramen.packageCarbsG} unit="g" onChange={(packageCarbsG) => updateDetails({ ...details, ramen: { ...details.ramen, packageCarbsG } })} /><NumberField label="包裝脂肪" value={details.ramen.packageFatG} unit="g" onChange={(packageFatG) => updateDetails({ ...details, ramen: { ...details.ramen, packageFatG } })} /><NumberField label="包裝鈉" value={details.ramen.packageSodiumMg} unit="mg" onChange={(packageSodiumMg) => updateDetails({ ...details, ramen: { ...details.ramen, packageSodiumMg } })} /></div>{(['noodleRatio', 'seasoningRatio', 'oilRatio'] as const).map((key) => <label className="select-field" key={key}>{key === 'noodleRatio' ? '麵體比例' : key === 'seasoningRatio' ? '調味包比例' : '油包比例'}<select value={details.ramen[key]} onChange={(event) => updateDetails({ ...details, ramen: { ...details.ramen, [key]: Number(event.target.value) } })}><option value={0.5}>1/2</option><option value={2 / 3}>2/3</option><option value={1}>整份</option></select></label>)}<label className="toggle-row"><span>有喝湯</span><input type="checkbox" checked={details.ramen.drankSoup} onChange={(event) => updateDetails({ ...details, ramen: { ...details.ramen, drankSoup: event.target.checked } })} /></label><NumberField label="加雞胸肉" value={details.ramen.chickenG} unit="g" step={10} onChange={(chickenG) => updateDetails({ ...details, ramen: { ...details.ramen, chickenG: chickenG ?? 0 } })} /><NumberField label="加蔬菜" value={details.ramen.vegetablesG} unit="g" step={10} onChange={(vegetablesG) => updateDetails({ ...details, ramen: { ...details.ramen, vegetablesG: vegetablesG ?? 0 } })} /></>}</details>
        <label className="toggle-row"><span>已補充肌酸</span><input type="checkbox" checked={Boolean(log.creatineTaken)} onChange={(event) => onChange({ creatineTaken: event.target.checked })} /></label>
        <label className="select-field">晚餐完成時間<input type="time" value={log.dinnerFinishedAt ?? ''} onChange={(event) => updateFood({ dinnerFinishedAt: event.target.value })} /></label>
      </Section>
      <Section title="自訂食物資料庫" open={false}>
        <div className="food-form"><input aria-label="食物名稱" placeholder="食物名稱" value={newFood.name} onChange={(event) => setNewFood({ ...newFood, name: event.target.value })} /><select aria-label="計算基準" value={newFood.basis} onChange={(event) => setNewFood({ ...newFood, basis: event.target.value as CustomFood['basis'] })}><option value="100g">每100g</option><option value="serving">每份</option></select>{([['kcal', '熱量 kcal'], ['proteinG', '蛋白質 g'], ['carbsG', '碳水 g'], ['fatG', '脂肪 g'], ['fiberG', '纖維 g'], ['sodiumMg', '鈉 mg'], ['defaultAmount', '預設份量']] as const).map(([key, label]) => <input key={key} aria-label={label} type="number" min="0" placeholder={label} value={newFood[key] || ''} onChange={(event) => setNewFood({ ...newFood, [key]: Number(event.target.value) })} />)}<button type="button" className="primary" disabled={!newFood.name.trim()} onClick={saveFoodEntry}>{editingFoodId ? '儲存食物修改' : '新增食物'}</button></div>
        <div className="food-list">{foods.length === 0 ? <p className="empty">尚未建立自訂食物。</p> : foods.map((food) => <article key={food.id}><span><strong>{food.name}</strong><small>{food.kcal} kcal · P {food.proteinG}g</small></span><div className="food-actions"><select aria-label={`${food.name}加入餐次`} defaultValue="lunch" id={`meal-${food.id}`}><option value="breakfast">早餐</option><option value="lunch">午餐</option><option value="dinner">晚餐</option><option value="evening">點心</option></select><button type="button" onClick={() => { const select = document.getElementById(`meal-${food.id}`) as HTMLSelectElement | null; addCustom(food, (select?.value ?? 'lunch') as MealKey) }}>加入</button><button type="button" onClick={() => editFood(food)}>編輯</button><button type="button" className="danger-text" onClick={() => onDeleteFood(food.id)}>刪除</button></div></article>)}</div>
      </Section>
    </div>}

    {activeStage === 'evening' && <div className="record-tab-panel">
      <div className="tab-intro"><strong>晚上約 30 秒</strong><p>抄入 Watch 四個數字、記錄感受，再完成今日結算。</p></div>
      {log.needsRefinalization && !log.dayFinalized && <div className="needs-refinalize">資料已修改，請確認最新數字後重新結算。</div>}
      <Section title="Watch 與活動" missing={eveningMissing}>
        <NumberField label="Watch 活動能量" value={log.activeKcal} unit="kcal" quick={[50, 100]} onChange={(activeKcal) => updateActivity({ activeKcal })} />
        <NumberField label="Watch 靜態能量" value={log.restingKcal} unit="kcal" quick={[100]} onChange={(restingKcal) => updateActivity({ restingKcal })} />
        <NumberField label="運動分鐘" value={log.exerciseMinutes} unit="分鐘" quick={[10, 15]} onChange={(exerciseMinutes) => updateActivity({ exerciseMinutes })} />
        <NumberField label="步數" value={log.steps} unit="步" step={100} quick={[1000]} onChange={(steps) => updateActivity({ steps })} />
      </Section>
      <Section title="今晚身體感受" missing={log.hungerLevel == null || log.fatigueLevel == null || log.highSaltMeal == null}>
        <SelectScale label="飢餓程度" value={log.hungerLevel} onChange={(hungerLevel) => onChange({ hungerLevel: hungerLevel as DailyLog['hungerLevel'] })} />
        <SelectScale label="疲勞程度" value={log.fatigueLevel} onChange={(fatigueLevel) => onChange({ fatigueLevel: fatigueLevel as DailyLog['fatigueLevel'] })} />
        <div className="field-block"><label>今天有高鹽餐嗎？</label><div className="segmented"><button type="button" className={log.highSaltMeal === true ? 'selected' : ''} onClick={() => onChange({ highSaltMeal: true })}>有</button><button type="button" className={log.highSaltMeal === false ? 'selected' : ''} onClick={() => onChange({ highSaltMeal: false })}>沒有</button></div></div>
      </Section>
      <Section title="顯示進階欄位" open={false}>
        <div className="compact-field-grid"><NumberField label="超慢跑時間" value={log.slowJogMinutes} unit="分鐘" step={1} onChange={(slowJogMinutes) => updateActivity({ slowJogMinutes })} /><NumberField label="超慢跑活動能量" value={log.slowJogActiveKcal} unit="kcal" onChange={(slowJogActiveKcal) => updateActivity({ slowJogActiveKcal })} /><NumberField label="距離" value={log.distanceKm} unit="km" step={0.1} onChange={(distanceKm) => updateActivity({ distanceKm })} /><NumberField label="站立時數" value={log.standingHours} unit="小時" onChange={(standingHours) => updateActivity({ standingHours })} /><NumberField label="平均運動心率" value={log.averageExerciseHeartRate} unit="bpm" onChange={(averageExerciseHeartRate) => updateActivity({ averageExerciseHeartRate })} /><NumberField label="靜息心率" value={log.restingHeartRate} unit="bpm" onChange={(restingHeartRate) => onChange({ restingHeartRate })} /><NumberField label="HRV" value={log.heartRateVariabilityMs} unit="ms" onChange={(heartRateVariabilityMs) => onChange({ heartRateVariabilityMs })} /></div>
        <div className="workout-list">{workouts.length === 0 ? <p className="empty">個別運動明細為選填。</p> : workouts.map((workout) => <article key={workout.id} className="workout-card"><div><span>{workoutLabels[workout.type]}</span><strong>{workout.title}</strong><small>{workout.durationMinutes} 分{workout.distanceKm != null ? ` · ${workout.distanceKm}km` : ''}</small></div><div><button type="button" onClick={() => editWorkout(workout)}>編輯</button><button type="button" className="danger-text" onClick={() => updateActivity({ workouts: workouts.filter((item) => item.id !== workout.id) })}>刪除</button></div></article>)}</div>
        {!showWorkoutForm && <button type="button" className="add-detail-button" onClick={() => setShowWorkoutForm(true)}>＋ 新增選填運動明細</button>}
        {showWorkoutForm && <div className="workout-form panel-inner"><div className="form-title"><strong>{editingWorkoutId ? '編輯運動' : '新增運動'}</strong><span>普通紀錄只需類型與時長</span></div><label className="select-field">類型<select value={workoutDraft.type} onChange={(event) => { const type = event.target.value as WorkoutType; setWorkoutDraft({ ...workoutDraft, type, title: workoutLabels[type] }) }}>{Object.entries(workoutLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><NumberField label="時長" value={workoutDraft.durationMinutes} unit="分" onChange={(durationMinutes) => setWorkoutDraft({ ...workoutDraft, durationMinutes: durationMinutes ?? 0 })} />
          <details className="panel-inner workout-advanced"><summary>更多運動細節（選填）</summary><label className="text-field">名稱<input value={workoutDraft.title} onChange={(event) => setWorkoutDraft({ ...workoutDraft, title: event.target.value })} /></label><label className="select-field">開始時間<input type="time" value={workoutDraft.startTime ?? ''} onChange={(event) => setWorkoutDraft({ ...workoutDraft, startTime: event.target.value || undefined })} /></label><div className="compact-field-grid"><NumberField label="活動能量" value={workoutDraft.activeKcal} unit="kcal" onChange={(activeKcal) => setWorkoutDraft({ ...workoutDraft, activeKcal })} /><NumberField label="總能量" value={workoutDraft.totalKcal} unit="kcal" onChange={(totalKcal) => setWorkoutDraft({ ...workoutDraft, totalKcal })} /><NumberField label="距離" value={workoutDraft.distanceKm} unit="km" step={0.1} onChange={(distanceKm) => setWorkoutDraft({ ...workoutDraft, distanceKm })} /><NumberField label="平均心率" value={workoutDraft.averageHeartRate} unit="bpm" onChange={(averageHeartRate) => setWorkoutDraft({ ...workoutDraft, averageHeartRate })} /><NumberField label="最高心率" value={workoutDraft.maxHeartRate} unit="bpm" onChange={(maxHeartRate) => setWorkoutDraft({ ...workoutDraft, maxHeartRate })} /></div><SelectScale label="主觀強度 RPE" max={10} value={workoutDraft.perceivedExertion} onChange={(perceivedExertion) => setWorkoutDraft({ ...workoutDraft, perceivedExertion: perceivedExertion as WorkoutEntry['perceivedExertion'] })} />{workoutDraft.type === 'strength' && <div className="compact-field-grid"><label className="text-field">肌群／動作<input value={workoutDraft.muscleGroup ?? ''} onChange={(event) => setWorkoutDraft({ ...workoutDraft, muscleGroup: event.target.value })} /></label><NumberField label="組數" value={workoutDraft.sets} onChange={(sets) => setWorkoutDraft({ ...workoutDraft, sets })} /><NumberField label="每組次數" value={workoutDraft.reps} onChange={(reps) => setWorkoutDraft({ ...workoutDraft, reps })} /><NumberField label="重量" value={workoutDraft.weightKg} unit="kg" onChange={(weightKg) => setWorkoutDraft({ ...workoutDraft, weightKg })} /><NumberField label="RIR" value={workoutDraft.rir} onChange={(rir) => setWorkoutDraft({ ...workoutDraft, rir })} /></div>}<label className="text-field">備註<textarea rows={2} value={workoutDraft.notes ?? ''} onChange={(event) => setWorkoutDraft({ ...workoutDraft, notes: event.target.value })} /></label></details>
          <details className="manual-override"><summary>手動活動熱量覆寫</summary><p>只有確定這筆活動不在 Watch 每日活動能量中，才可額外加入。</p><div className="segmented"><button type="button" className={workoutDraft.activityKcalMode !== 'add_to_daily_total' ? 'selected' : ''} onClick={() => setWorkoutDraft({ ...workoutDraft, activityKcalMode: 'included_in_daily_total' })}>預設：不再加總</button><button type="button" className={workoutDraft.activityKcalMode === 'add_to_daily_total' ? 'selected' : ''} onClick={() => setWorkoutDraft({ ...workoutDraft, activityKcalMode: 'add_to_daily_total' })}>確定未包含，額外加入</button></div></details>
          {workoutDraft.activityKcalMode === 'add_to_daily_total' && workoutDraft.activeKcal == null && <p className="field-error">額外加入前必須填活動能量。</p>}<div className="form-actions"><button type="button" className="primary" disabled={workoutDraft.durationMinutes <= 0 || (workoutDraft.activityKcalMode === 'add_to_daily_total' && workoutDraft.activeKcal == null)} onClick={saveWorkout}>{editingWorkoutId ? '儲存修改' : '加入運動'}</button><button type="button" onClick={() => { setWorkoutDraft(blankWorkout()); setEditingWorkoutId(undefined); setShowWorkoutForm(false) }}>取消</button></div></div>}
      </Section>
      <Section title="今日備註" open={false}><textarea aria-label="今日備註" rows={4} value={log.notes ?? ''} onChange={(event) => onChange({ notes: event.target.value })} /></Section>
      <div className={`finalize-card standard-card ${log.dayFinalized ? 'done' : ''}`}><div><span>{log.dayFinalized ? '今日已結算' : '今日尚未結算'}</span><strong>{log.dayFinalized ? `最終推估赤字 ${Math.round(finalDeficit ?? 0)} kcal` : '確認資料後完成今天'}</strong><p>{log.dayFinalized ? `推估總消耗 ${Math.round(finalTdee ?? 0)} kcal；Watch 與熱量皆為估算。` : eveningMissing ? '完成缺少的晚間資料後，下方會出現結算按鈕。' : '資料齊全，可以在下方完成結算。'}</p></div></div>
    </div>}

    <div className={`record-save-bar ${saveState}`} role="status" aria-live="polite"><div><i /><span><strong>{saveState === 'saving' ? '儲存中…' : saveState === 'error' ? '儲存失敗' : '已自動儲存'}</strong></span></div>{activeStage === 'evening' && !log.dayFinalized && <button type="button" className="primary" disabled={saveState !== 'saved' || eveningMissing} onClick={finalizeDay}>{eveningMissing ? '尚缺資料' : '完成今日結算'}</button>}</div>
    {copyMessage && <div className="copy-toast" role="status">{copyMessage}</div>}
    {deletedMealLine && <div className="undo-toast" role="status"><span>已刪除「{deletedMealLine.removed.line.label}」<small>餐點總計已重新計算</small></span><button type="button" onClick={() => { updateDetails(restoreMealLine(deletedMealLine.details, deletedMealLine.removed)); if (deleteTimer.current) window.clearTimeout(deleteTimer.current); setDeletedMealLine(undefined); setExpandedMeal(deletedMealLine.removed.meal) }}>復原</button></div>}
    {justFinalized && <div className="finalize-success" role="status"><Check /><strong>今日結算完成</strong><span>攝取 {Math.round(log.intakeKcal ?? 0)} · 消耗 {Math.round(estimatedTDEE(log) ?? 0)} · 赤字 {Math.round(dailyDeficit(log) ?? 0)} kcal</span></div>}
    <FoodAddSheet open={Boolean(foodSheet)} defaultMeal={foodSheet?.meal ?? 'lunch'} initialTab={foodSheet?.tab} initialTemplateId={foodSheet?.templateId} details={details} templates={templates} foods={foods} onApply={(next, meal, message) => { updateDetails(next); setExpandedMeal(meal); showCopyMessage(message) }} onEditExisting={(meal) => setExpandedMeal(meal)} onClose={() => setFoodSheet(undefined)} />
  </section>
}
