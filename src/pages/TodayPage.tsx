import { useEffect, useRef, useState } from 'react'
import { Check, ChevronRight, Droplets, Footprints, Moon, Scale, Utensils } from 'lucide-react'
import { buildAdvice } from '../advice'
import { achievementRate, activityTotals, dailyCompletion, daysBetween, dinnerBudgetSummary, finalizedCumulativeDeficit, finalizedDeficit, nutritionCoverageDisplay, remainingActivity, weightTrendStatus } from '../calculations'
import { ensureMealDetails } from '../mealOperations'
import type { ChallengeSettings, DailyLog, FoodTemplate, RecordStage } from '../types'

const rounded = (value?: number) => value == null ? '—' : Math.round(value).toLocaleString('zh-TW')

export function TodayPage({ today, log, logs, settings, onQuickAdd, onOpenRecord, onOpenFoodTemplate }: {
  today: string
  log: DailyLog
  logs: DailyLog[]
  settings: ChallengeSettings
  onQuickAdd: (patch: Partial<DailyLog>) => void
  onOpenRecord: (stage: RecordStage) => void
  onOpenFoodTemplate: (template: FoodTemplate) => void
}) {
  const [waterToast, setWaterToast] = useState<{ amount: number; previous?: number }>()
  const waterTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => { if (waterTimer.current) window.clearTimeout(waterTimer.current) }, [])

  const allLogs = [...logs.filter((item) => item.id !== log.id), log]
  const morning = allLogs.filter((item) => item.date <= today && item.weightCondition === 'morning_fasted' && item.weightKg != null).sort((a, b) => a.date.localeCompare(b.date))
  const currentWeight = morning.at(-1)?.weightKg
  const totalDays = Math.max(daysBetween(settings.startDate, settings.finalWeighInDate), 1)
  const currentDay = Math.min(Math.max(daysBetween(settings.startDate, today) + 1, 1), totalDays)
  const trend = weightTrendStatus(allLogs, today, settings)
  const activity = activityTotals(log)
  const details = ensureMealDetails(log)
  const dinner = dinnerBudgetSummary(details, settings)
  const activityRemaining = remainingActivity(log, settings)
  const completion = dailyCompletion(log, settings)
  const advice = buildAdvice(log, allLogs, settings)
  const deficit = finalizedDeficit(log)
  const cumulative = finalizedCumulativeDeficit(allLogs, settings)
  const homeTemplateIds = ['fixed_breakfast', 'fage_250', 'chicken_rice', 'chicken_pasta', 'ramen_chicken', 'soy_chia']
  const templates = homeTemplateIds.flatMap((id) => (settings.foodTemplates ?? []).find((template) => template.id === id) ?? [])

  const priorLogs = allLogs.filter((item) => item.date < today).sort((a, b) => a.date.localeCompare(b.date))
  const previous = priorLogs.at(-1)
  const beforePrevious = priorLogs.at(-2)
  const legIncreasing = previous?.lowerLegTightness != null && log.lowerLegTightness != null && log.lowerLegTightness > previous.lowerLegTightness
  const legWorseningTwoDays = legIncreasing && beforePrevious?.lowerLegTightness != null && previous!.lowerLegTightness! > beforePrevious.lowerLegTightness
  let action: { title: string; detail: string; stage: RecordStage; tone: 'good' | 'near' | 'warn' }
  if (legWorseningTwoDays) action = { title: '下肢／足底連續兩天惡化，今天恢復', detail: '停止補跑，改成休息或不痛的輕鬆走路；若持續惡化請尋求專業評估。', stage: 'morning', tone: 'warn' }
  else if ((log.lowerLegTightness ?? 0) >= 3) action = { title: '今天是恢復日，不補跑', detail: '活動以 500–550 kcal 為上限參考，優先走路或休息。', stage: 'morning', tone: 'warn' }
  else if (log.lowerLegTightness === 2 || legIncreasing) action = { title: '今天先保護下肢', detail: '不要補跑；自然走路沒有加劇時，輕鬆走 10–20 分鐘即可。', stage: 'morning', tone: 'near' }
  else if (log.weightKg == null || log.weightCondition !== 'morning_fasted') action = { title: '先記錄晨間體重', detail: '起床、上完廁所後量一次即可。', stage: 'morning', tone: 'near' }
  else if (log.sleepHours == null) action = { title: '補上前一晚睡眠', detail: '填寫睡眠時數與下肢緊繃程度。', stage: 'morning', tone: 'near' }
  else if ((log.waterMl ?? 0) < settings.waterMinimumMl - 500) action = { title: '先補 500 ml 白開水', detail: `目前 ${rounded(log.waterMl)} ml，分兩次喝完即可。`, stage: 'food', tone: 'near' }
  else if (log.intakeKcal == null) action = { title: '更新今天已吃的食物', detail: '用真實餐點快捷加入，熱量與營養素會一起計算。', stage: 'food', tone: 'near' }
  else if ((log.proteinG ?? 0) < settings.proteinMinimumG) action = { title: '下一餐優先安排蛋白質', detail: `目前 ${rounded(log.proteinG)} g，目標至少 ${settings.proteinMinimumG} g。`, stage: 'food', tone: 'near' }
  else if (activity.effectiveActiveKcal == null || log.restingKcal == null || log.exerciseMinutes == null || log.steps == null) action = { title: '晚上抄入 Watch 四個數字', detail: '活動、靜態能量、運動分鐘與步數。', stage: 'evening', tone: 'near' }
  else if (log.hungerLevel == null || log.fatigueLevel == null || log.highSaltMeal == null) action = { title: '補上今晚的身體感受', detail: '記錄飢餓、疲勞與高鹽餐，再完成結算。', stage: 'evening', tone: 'near' }
  else if (!log.dayFinalized) action = { title: '今天可以完成結算', detail: activityRemaining === 0 ? '活動已達基本目標，不需要再補跑。' : `活動還差 ${rounded(activityRemaining)} kcal；晚餐後輕鬆走即可。`, stage: 'evening', tone: 'good' }
  else action = { title: '今天完成了，可以休息', detail: '若再吃東西或更新 Watch，系統會自動要求重新結算。', stage: 'evening', tone: 'good' }

  const morningDone = log.weightKg != null && log.sleepHours != null && log.bowelMovement !== 'unrecorded' && log.lowerLegTightness != null
  const foodStarted = log.intakeKcal != null || log.waterMl != null
  const foodDone = log.intakeKcal != null && log.proteinG != null && log.waterMl != null
  const eveningStarted = activity.effectiveActiveKcal != null || log.restingKcal != null || log.exerciseMinutes != null || log.steps != null
  const stages: Array<{ id: RecordStage; label: string; note: string; status: '未完成' | '進行中' | '已完成'; Icon: typeof Scale }> = [
    { id: 'morning', label: '早上紀錄', note: '體重 · 睡眠', status: morningDone ? '已完成' : '未完成', Icon: Scale },
    { id: 'food', label: '更新飲食', note: '餐點 · 白水', status: foodDone ? '已完成' : foodStarted ? '進行中' : '未完成', Icon: Utensils },
    { id: 'evening', label: '晚間結算', note: 'Watch · 感受', status: log.dayFinalized ? '已完成' : eveningStarted ? '進行中' : '未完成', Icon: Moon }
  ]

  const addWater = (amount: number) => {
    const previousWater = log.waterMl
    onQuickAdd({ waterMl: (previousWater ?? 0) + amount })
    setWaterToast({ amount, previous: previousWater })
    if (waterTimer.current) window.clearTimeout(waterTimer.current)
    waterTimer.current = window.setTimeout(() => setWaterToast(undefined), 5000)
  }
  const nutrientRows = [
    { label: '熱量', value: `${Math.round(log.intakeKcal ?? 0).toLocaleString('zh-TW')} kcal`, note: '完整' },
    { label: '蛋白質', value: `${(log.proteinG ?? 0).toFixed(1)} g`, note: '完整' },
    { label: '碳水', ...nutritionCoverageDisplay(details, 'carbs', log.carbsG) },
    { label: '脂肪', ...nutritionCoverageDisplay(details, 'fat', log.fatG) },
    { label: '纖維', ...nutritionCoverageDisplay(details, 'fiber', log.fiberG) },
    { label: '鈉', ...nutritionCoverageDisplay(details, 'sodium', log.sodiumMg) }
  ]

  return <section className="page today-page sprint-home">
    <header className="sprint-hero hero-card">
      <div className="hero-top"><span>第 {currentDay}／{totalDays} 天</span><span className={`finalized-badge ${log.dayFinalized ? 'done' : ''}`}>{log.dayFinalized ? <><Check size={14} /> 已結算</> : '尚未結算'}</span></div>
      <div className="hero-weight"><strong>{settings.baselineWeightKg.toFixed(1)}</strong><span>kg</span><i>→</i><strong>{settings.targetWeightKg.toFixed(1)}</strong><span>kg</span></div>
      <p>最新晨間 <b>{currentWeight?.toFixed(1) ?? '—'} kg</b><span>距離目標 {currentWeight == null ? '—' : Math.max(0, currentWeight - settings.targetWeightKg).toFixed(1)} kg</span></p>
      <div className="sprint-nodes" aria-label={`第 ${currentDay} 天，共 ${totalDays} 天`}>{Array.from({ length: totalDays }, (_, index) => <i key={index} className={index + 1 <= currentDay ? 'active' : ''} />)}</div>
      <div className={`hero-status ${trend.status}`}><span>{trend.label}</span><small>{trend.detail}</small></div>
    </header>

    <div className="budget-grid">
      <article className="budget-card dinner-budget standard-card"><Utensils aria-hidden="true" />{dinner.dinnerKcal > 0 ? <><span>晚餐</span><strong>{rounded(dinner.dinnerKcal)}<small>／{rounded(dinner.budget)} kcal</small></strong><p>{dinner.over > 0 ? `晚餐超出 ${rounded(dinner.over)} kcal` : `還有 ${rounded(dinner.remaining)} kcal 空間`}</p></> : <><span>今晚主餐預算</span><strong>{rounded(dinner.budget)}<small> kcal</small></strong><p>已扣除早餐、午餐與點心</p></>}</article>
      <article className="budget-card standard-card"><Footprints aria-hidden="true" /><span>{activityRemaining > 0 ? '活動還差' : '基本目標已達'}</span><strong>{activityRemaining > 0 ? rounded(activityRemaining) : '完成'}{activityRemaining > 0 && <small> kcal</small>}</strong><p>目前 {rounded(activity.effectiveActiveKcal)}／{settings.activeKcalMinimum}</p></article>
    </div>

    <button type="button" className={`next-action standard-card ${action.tone}`} onClick={() => onOpenRecord(action.stage)}><span>今日唯一行動</span><strong>{action.title}</strong><small>{action.detail}</small><ChevronRight aria-hidden="true" /></button>

    <div className="daily-flow flat-section" aria-label="今日三階段">{stages.map(({ id, label, note, status, Icon }) => <button key={id} className={status === '已完成' ? 'done' : status === '進行中' ? 'active' : ''} onClick={() => onOpenRecord(id)}><span className="flow-icon">{status === '已完成' ? <Check /> : <Icon />}</span><strong>{label}</strong><small>{status} · {note}</small></button>)}</div>

    <section className="quick-sprint flat-section"><div className="flat-heading"><h2>快速加入</h2><span>白天隨吃隨記</span></div><div className="quick-water"><button onClick={() => addWater(250)}><Droplets size={18} />＋250 ml</button><button onClick={() => addWater(500)}><Droplets size={18} />＋500 ml</button></div><div className="food-shortcuts" aria-label="食物快捷模板">{templates.map((template) => <button type="button" key={template.id} onClick={() => onOpenFoodTemplate(template)}><strong>{template.name}</strong><small>約 {Math.round(template.kcal)} kcal · P {Math.round(template.proteinG)}g</small></button>)}</div></section>

    <details className="more-data standard-card"><summary><span>更多資料</span><strong>{log.dayFinalized ? `達成率 ${achievementRate(log, settings)}%` : `完成 ${completion.completed}／${completion.total}`}</strong></summary><div className="more-data-body">
      {!log.dayFinalized && <p className="not-finalized-note">尚未完成晚間結算，不顯示最終赤字。</p>}
      {log.dayFinalized && <div className="final-energy-grid"><article><span>今日消耗</span><strong>{rounded((log.restingKcal ?? 0) + (activity.effectiveActiveKcal ?? 0))}</strong><small>kcal</small></article><article><span>今日赤字</span><strong>{rounded(deficit)}</strong><small>kcal</small></article><article><span>7 日累積</span><strong>{rounded(cumulative)}</strong><small>kcal</small></article></div>}
      <div className="more-metrics"><div><Utensils /><span>蛋白質</span><strong>{log.proteinG == null ? '—' : `${log.proteinG.toFixed(1)} g`}</strong></div><div><Droplets /><span>白開水</span><strong>{rounded(log.waterMl)} ml</strong></div><div><Moon /><span>前一晚睡眠</span><strong>{log.sleepHours == null ? '—' : `${log.sleepHours.toFixed(1)} 小時`}</strong></div><div><Footprints /><span>步數</span><strong>{rounded(log.steps)}</strong></div><div><span className="status-dot" /> <span>排便</span><strong>{log.bowelMovement === 'yes' ? '有' : log.bowelMovement === 'none' ? '沒有' : '未記錄'}</strong></div><div><span className="status-dot" /><span>下肢／足底狀態</span><strong>{log.lowerLegTightness ?? '—'}／5</strong></div></div>
      <div className="nutrient-coverage-grid">{nutrientRows.map((row) => <div key={row.label}><span>{row.label}</span><strong>{row.value}</strong><small>{row.note}</small></div>)}</div>
      <div className="completion-list">{completion.items.map((item) => <span className={item.complete ? 'done' : ''} key={item.key}><i />{item.label}</span>)}</div>
      <div className="advice-list secondary-advice">{advice.slice(0, 2).map((item, index) => <article className={`advice ${item.level}`} key={`${item.text}-${index}`}><i /><p>{item.text}</p></article>)}</div>
    </div></details>
    {waterToast && <div className="undo-toast" role="status"><span>已加入 {waterToast.amount} ml 白開水</span><button onClick={() => { onQuickAdd({ waterMl: waterToast.previous }); setWaterToast(undefined) }}>復原</button></div>}
  </section>
}
