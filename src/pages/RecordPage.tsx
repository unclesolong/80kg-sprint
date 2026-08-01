import { useState } from 'react'
import { mealTotals, parseLocalDate } from '../calculations'
import { defaultMealDetails } from '../defaults'
import type { CustomFood, DailyLog, MealDetails, MealLine } from '../types'
import { NumberField } from '../components/NumberField'

const Section = ({ title, missing, children }: { title: string; missing?: boolean; children: React.ReactNode }) => <details className="form-section panel" open>
  <summary><span>{title}</span>{missing && <em>尚未完成</em>}</summary><div className="section-body">{children}</div>
</details>

const SelectScale = ({ label, value, max = 5, onChange }: { label: string; value?: number; max?: number; onChange: (value: number) => void }) => <div className="field-block"><label>{label}</label><div className="scale">{Array.from({ length: max }, (_, i) => i + 1).map((number) => <button type="button" className={value === number ? 'selected' : ''} onClick={() => onChange(number)} key={number}>{number}</button>)}</div></div>

const MealEditor = ({ title, lines, onChange }: { title: string; lines: MealLine[]; onChange: (lines: MealLine[]) => void }) => <div className="meal-editor"><h4>{title}</h4>{lines.map((line, index) => <NumberField key={`${line.key}-${index}`} label={line.label} value={line.amount} unit={line.key === 'sauce' || line.key === 'extra' ? 'kcal' : line.unit} step={line.unit === '份' || line.unit === '顆' ? 1 : 5} onChange={(amount) => onChange(lines.map((item, itemIndex) => itemIndex === index ? { ...item, amount: amount ?? 0 } : item))} />)}</div>

type RecordTab = 'morning' | 'activity' | 'food' | 'water' | 'condition'

export function RecordPage({ date, log, foods, onDate, onChange, onSaveFood, onDeleteFood }: {
  date: string; log: DailyLog; foods: CustomFood[]; onDate: (date: string) => void
  onChange: (patch: Partial<DailyLog>) => void; onSaveFood: (food: CustomFood) => void; onDeleteFood: (id: string) => void
}) {
  const [newFood, setNewFood] = useState<Omit<CustomFood, 'id'>>({ name: '', basis: '100g', kcal: 0, proteinG: 0, defaultAmount: 100 })
  const [activeTab, setActiveTab] = useState<RecordTab>('morning')
  const details = log.mealDetails ?? defaultMealDetails()
  const updateDetails = (next: MealDetails) => {
    const totals = mealTotals(next)
    onChange({ mealDetails: next, intakeKcal: totals.kcal, proteinG: totals.protein })
  }
  const setMeal = (key: 'breakfast' | 'lunch' | 'dinner' | 'evening', lines: MealLine[]) => updateDetails({ ...details, [key]: lines })
  const addCustom = (food: CustomFood, meal: 'lunch' | 'dinner') => {
    const divider = food.basis === '100g' ? 100 : food.defaultAmount || 1
    setMeal(meal, [...details[meal], { key: food.id, label: food.name, amount: food.defaultAmount, unit: food.basis === '100g' ? 'g' : '份', kcalPerUnit: food.kcal / divider, proteinPerUnit: food.proteinG / divider }])
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
      <div className="tab-intro"><strong>起床後記錄</strong><p>體重與睡眠都以這一天的晨間狀態為準。</p></div>

    <Section title="晨間" missing={log.weightKg == null}>
      <NumberField label="體重" value={log.weightKg} unit="kg" step={0.1} onChange={(weightKg) => onChange({ weightKg })} />
      <div className="segmented"><button className={log.weightCondition === 'morning_fasted' ? 'selected' : ''} onClick={() => onChange({ weightCondition: 'morning_fasted' })}>晨起空腹</button><button className={log.weightCondition === 'other' ? 'selected' : ''} onClick={() => onChange({ weightCondition: 'other' })}>其他時間</button></div>
      <NumberField label="腰圍" value={log.waistCm} unit="cm" step={0.1} onChange={(waistCm) => onChange({ waistCm })} />
    </Section>

    <Section title="前一晚睡眠" missing={log.sleepHours == null}>
      <div className="sleep-context"><strong>{shortDate(previousDate)} 晚上 → {shortDate(currentDate)} 早上</strong><p>{date} 這筆紀錄，填寫的是醒來前一晚的睡眠。</p></div>
      <NumberField label="前一晚睡眠時間" value={log.sleepHours} unit="小時" step={0.25} onChange={(sleepHours) => onChange({ sleepHours })} />
      <SelectScale label="前一晚睡眠品質" value={log.sleepQuality} onChange={(sleepQuality) => onChange({ sleepQuality: sleepQuality as DailyLog['sleepQuality'] })} />
    </Section>
    </div>}

    {activeTab === 'activity' && <div className="record-tab-panel">
    <Section title="活動" missing={log.activeKcal == null || log.restingKcal == null}>
      <NumberField label="Apple Watch 活動能量" value={log.activeKcal} unit="kcal" quick={[50, 100]} onChange={(activeKcal) => onChange({ activeKcal })} />
      <NumberField label="Apple Watch 靜態能量" value={log.restingKcal} unit="kcal" quick={[100]} onChange={(restingKcal) => onChange({ restingKcal })} />
      <NumberField label="運動時間" value={log.exerciseMinutes} unit="分鐘" quick={[10, 15]} onChange={(exerciseMinutes) => onChange({ exerciseMinutes })} />
      <NumberField label="額外超慢跑" value={log.slowJogMinutes} unit="分鐘" step={0.1} onChange={(slowJogMinutes) => onChange({ slowJogMinutes })} />
      <NumberField label="超慢跑動態能量" value={log.slowJogActiveKcal} unit="kcal" onChange={(slowJogActiveKcal) => onChange({ slowJogActiveKcal })} />
      <NumberField label="平均運動心率" value={log.averageExerciseHeartRate} unit="bpm" onChange={(averageExerciseHeartRate) => onChange({ averageExerciseHeartRate })} />
      <NumberField label="步數" value={log.steps} unit="步" step={100} quick={[1000]} onChange={(steps) => onChange({ steps })} />
      <NumberField label="距離" value={log.distanceKm} unit="km" step={0.1} onChange={(distanceKm) => onChange({ distanceKm })} />
      <NumberField label="站立時數" value={log.standingHours} unit="小時" onChange={(standingHours) => onChange({ standingHours })} />
      <p className="fine-print">Apple Watch 消耗為估算值，本 App 不會直接讀取 HealthKit。</p>
    </Section>
    </div>}

    {activeTab === 'food' && <div className="record-tab-panel">
    <Section title="飲食" missing={log.intakeKcal == null || log.proteinG == null}>
      <div className="segmented"><button className={log.mealMode !== 'detailed' ? 'selected' : ''} onClick={() => onChange({ mealMode: 'quick' })}>快速總量</button><button className={log.mealMode === 'detailed' ? 'selected' : ''} onClick={() => onChange({ mealMode: 'detailed' })}>詳細餐點</button></div>
      {log.mealMode !== 'detailed' ? <>
        <NumberField label="今日總熱量" value={log.intakeKcal} unit="kcal" quick={[100, 250]} onChange={(intakeKcal) => onChange({ intakeKcal })} />
        <NumberField label="今日蛋白質" value={log.proteinG} unit="g" quick={[10, 20]} onChange={(proteinG) => onChange({ proteinG })} />
      </> : <div className="detailed-meals">
        <MealEditor title="早餐" lines={details.breakfast} onChange={(lines) => setMeal('breakfast', lines)} />
        <MealEditor title="午餐" lines={details.lunch} onChange={(lines) => setMeal('lunch', lines)} />
        <MealEditor title="晚餐" lines={details.dinner} onChange={(lines) => setMeal('dinner', lines)} />
        <MealEditor title="晚間豆漿" lines={details.evening} onChange={(lines) => setMeal('evening', lines)} />
        <div className="ramen panel-inner"><label className="toggle-row"><span>泡麵模式</span><input type="checkbox" checked={details.ramen.enabled} onChange={(e) => updateDetails({ ...details, ramen: { ...details.ramen, enabled: e.target.checked } })} /></label>{details.ramen.enabled && <>
          <NumberField label="包裝整份熱量" value={details.ramen.packageKcal} unit="kcal" onChange={(packageKcal) => updateDetails({ ...details, ramen: { ...details.ramen, packageKcal: packageKcal ?? 0 } })} />
          {(['noodleRatio', 'seasoningRatio', 'oilRatio'] as const).map((key) => <label className="select-field" key={key}>{key === 'noodleRatio' ? '麵體比例' : key === 'seasoningRatio' ? '調味包比例' : '油包比例'}<select value={details.ramen[key]} onChange={(e) => updateDetails({ ...details, ramen: { ...details.ramen, [key]: Number(e.target.value) } })}><option value={0.5}>1/2</option><option value={2 / 3}>2/3</option><option value={1}>整份</option></select></label>)}
          <label className="toggle-row"><span>有喝湯</span><input type="checkbox" checked={details.ramen.drankSoup} onChange={(e) => updateDetails({ ...details, ramen: { ...details.ramen, drankSoup: e.target.checked } })} /></label>
          <NumberField label="雞胸肉" value={details.ramen.chickenG} unit="g" step={10} onChange={(chickenG) => updateDetails({ ...details, ramen: { ...details.ramen, chickenG: chickenG ?? 0 } })} />
          <NumberField label="蔬菜" value={details.ramen.vegetablesG} unit="g" step={10} onChange={(vegetablesG) => updateDetails({ ...details, ramen: { ...details.ramen, vegetablesG: vegetablesG ?? 0 } })} />
        </>}</div>
        <div className="meal-total"><span>自動加總</span><strong>{log.intakeKcal ?? 0} kcal · {log.proteinG ?? 0} g 蛋白質</strong></div>
      </div>}
      <div className="check-grid">{[
        ['breakfastPlanCompleted', '早餐計畫'], ['lunchPlateCompleted', '午餐餐盤'], ['dinnerPlateCompleted', '晚餐餐盤'], ['soyChiaCompleted', '豆漿奇亞籽']
      ].map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(log[key as keyof DailyLog])} onChange={(e) => onChange({ [key]: e.target.checked })} />{label}</label>)}</div>
      <label className="toggle-row"><span>高鹽餐</span><input type="checkbox" checked={Boolean(log.highSaltMeal)} onChange={(e) => onChange({ highSaltMeal: e.target.checked })} /></label>
      <label className="toggle-row"><span>已補充肌酸</span><input type="checkbox" checked={Boolean(log.creatineTaken)} onChange={(e) => onChange({ creatineTaken: e.target.checked })} /></label>
      <label className="select-field">晚餐完成時間<input type="time" value={log.dinnerFinishedAt ?? ''} onChange={(e) => onChange({ dinnerFinishedAt: e.target.value })} /></label>
    </Section>

    <Section title="自訂食物資料庫">
      <div className="food-form">
        <input aria-label="食物名稱" placeholder="食物名稱" value={newFood.name} onChange={(e) => setNewFood({ ...newFood, name: e.target.value })} />
        <select aria-label="計算基準" value={newFood.basis} onChange={(e) => setNewFood({ ...newFood, basis: e.target.value as CustomFood['basis'] })}><option value="100g">每 100g</option><option value="serving">每份</option></select>
        <input aria-label="熱量" inputMode="decimal" type="number" placeholder="熱量" value={newFood.kcal || ''} onChange={(e) => setNewFood({ ...newFood, kcal: Number(e.target.value) })} />
        <input aria-label="蛋白質" inputMode="decimal" type="number" placeholder="蛋白質 g" value={newFood.proteinG || ''} onChange={(e) => setNewFood({ ...newFood, proteinG: Number(e.target.value) })} />
        <input aria-label="預設份量" inputMode="decimal" type="number" placeholder="預設份量" value={newFood.defaultAmount || ''} onChange={(e) => setNewFood({ ...newFood, defaultAmount: Number(e.target.value) })} />
        <button type="button" className="primary" disabled={!newFood.name.trim()} onClick={() => { onSaveFood({ ...newFood, id: crypto.randomUUID() }); setNewFood({ name: '', basis: '100g', kcal: 0, proteinG: 0, defaultAmount: 100 }) }}>新增食物</button>
      </div>
      <div className="food-list">{foods.length === 0 ? <p className="empty">尚未建立自訂食物。</p> : foods.map((food) => <div key={food.id}><span><strong>{food.name}</strong><small>{food.kcal} kcal · {food.proteinG} g 蛋白質</small></span><button onClick={() => addCustom(food, 'lunch')}>加到午餐</button><button onClick={() => addCustom(food, 'dinner')}>加到晚餐</button><button className="danger-text" onClick={() => onDeleteFood(food.id)}>刪除</button></div>)}</div>
    </Section>
    </div>}

    {activeTab === 'water' && <div className="record-tab-panel">
    <Section title="水分" missing={log.waterMl == null}><NumberField label="白開水" value={log.waterMl} unit="ml" step={250} quick={[250, 500]} onChange={(waterMl) => onChange({ waterMl })} /></Section>
    </div>}

    {activeTab === 'condition' && <div className="record-tab-panel">
    <Section title="排便"><div className="segmented"><button className={log.bowelMovement === 'yes' ? 'selected' : ''} onClick={() => onChange({ bowelMovement: 'yes' })}>有排便</button><button className={log.bowelMovement !== 'yes' ? 'selected' : ''} onClick={() => onChange({ bowelMovement: 'none', bristolType: undefined })}>沒有</button></div>{log.bowelMovement === 'yes' && <SelectScale label="Bristol 型態" max={7} value={log.bristolType} onChange={(bristolType) => onChange({ bristolType: bristolType as DailyLog['bristolType'] })} />}</Section>
    <Section title="身體感受"><SelectScale label="飢餓程度" value={log.hungerLevel} onChange={(hungerLevel) => onChange({ hungerLevel: hungerLevel as DailyLog['hungerLevel'] })} /><SelectScale label="疲勞程度" value={log.fatigueLevel} onChange={(fatigueLevel) => onChange({ fatigueLevel: fatigueLevel as DailyLog['fatigueLevel'] })} /></Section>
    <Section title="備註"><textarea aria-label="備註" rows={4} placeholder="今天的感受、飲食或其他觀察…" value={log.notes ?? ''} onChange={(e) => onChange({ notes: e.target.value })} /></Section>
    </div>}
  </section>
}
