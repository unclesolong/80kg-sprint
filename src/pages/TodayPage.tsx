import { achievementRate, activityTotals, dailyCompletion, daysBetween, finalizedDeficit, remainingActivity, remainingFoodBudget, weightTrendStatus } from '../calculations'
import { buildAdvice } from '../advice'
import { FoodQuickActions } from '../components/FoodQuickActions'
import type { ChallengeSettings, DailyLog, RecordStage } from '../types'

const rounded = (value?: number) => value == null ? '—' : Math.round(value).toLocaleString('zh-TW')

export function TodayPage({ today, log, logs, settings, onQuickAdd, onOpenRecord }: {
  today: string
  log: DailyLog
  logs: DailyLog[]
  settings: ChallengeSettings
  onQuickAdd: (patch: Partial<DailyLog>) => void
  onOpenRecord: (stage: RecordStage) => void
}) {
  const allLogs = [...logs.filter((item) => item.id !== log.id), log]
  const morning = allLogs
    .filter((item) => item.date <= today && item.weightCondition === 'morning_fasted' && item.weightKg != null)
    .sort((a, b) => a.date.localeCompare(b.date))
  const currentWeight = morning.at(-1)?.weightKg
  const totalDays = Math.max(daysBetween(settings.startDate, settings.finalWeighInDate), 1)
  const currentDay = Math.min(Math.max(daysBetween(settings.startDate, today) + 1, 1), totalDays)
  const trend = weightTrendStatus(allLogs, today, settings)
  const activity = activityTotals(log)
  const foodRemaining = remainingFoodBudget(log, settings)
  const activityRemaining = remainingActivity(log, settings)
  const completion = dailyCompletion(log, settings)
  const advice = buildAdvice(log, allLogs, settings)
  const deficit = finalizedDeficit(log)
  const templates = settings.foodTemplates ?? []

  const previous = allLogs.filter((item) => item.date < today).sort((a, b) => a.date.localeCompare(b.date)).at(-1)
  const legIncreasing = previous?.lowerLegTightness != null && log.lowerLegTightness != null && log.lowerLegTightness > previous.lowerLegTightness
  let action: { title: string; detail: string; stage: RecordStage; tone: 'good' | 'near' | 'warn' }
  if ((log.lowerLegTightness ?? 0) >= 3) action = { title: '小腿緊繃，今天不補跑', detail: '改成輕鬆走路或休息，不追 660 kcal。', stage: 'morning', tone: 'warn' }
  else if (log.lowerLegTightness === 2 || legIncreasing) action = { title: '今天先保護下肢', detail: '不要補跑；若自然走路沒有加劇，可輕鬆走 10–20 分鐘。', stage: 'morning', tone: 'near' }
  else if (log.weightKg == null || log.weightCondition !== 'morning_fasted') action = { title: '先記錄晨間體重', detail: '起床、上完廁所後量一次即可。', stage: 'morning', tone: 'near' }
  else if (log.sleepHours == null) action = { title: '補上前一晚睡眠', detail: '填寫睡眠時數與下肢緊繃程度。', stage: 'morning', tone: 'near' }
  else if (log.intakeKcal == null) action = { title: '更新今天已吃的食物', detail: '可用快捷模板，或直接填目前總熱量。', stage: 'food', tone: 'near' }
  else if ((log.proteinG ?? 0) < settings.proteinMinimumG) action = { title: '下一餐優先安排蛋白質', detail: `目前 ${rounded(log.proteinG)}g，目標至少 ${settings.proteinMinimumG}g。`, stage: 'food', tone: 'near' }
  else if ((log.waterMl ?? 0) < settings.waterMinimumMl) action = { title: '再補一些白開水', detail: `目前 ${rounded(log.waterMl)}ml，分次補到約 ${settings.waterMinimumMl}ml。`, stage: 'food', tone: 'near' }
  else if (activity.effectiveActiveKcal == null || log.restingKcal == null || log.exerciseMinutes == null || log.steps == null) action = { title: '晚上抄入 Watch 四個數字', detail: '活動、靜態能量、運動分鐘與步數。', stage: 'evening', tone: 'near' }
  else if (log.hungerLevel == null || log.fatigueLevel == null) action = { title: '補上今晚的身體感受', detail: '記錄飢餓、疲勞，再檢查高鹽餐。', stage: 'evening', tone: 'near' }
  else if (!log.dayFinalized) action = { title: '今天可以結算', detail: '確認 Watch 與飲食是最新數字，再完成晚間結算。', stage: 'evening', tone: 'good' }
  else action = { title: '今日已結算', detail: '若再吃東西或更新 Watch，系統會自動要求重新結算。', stage: 'evening', tone: 'good' }

  return <section className="page today-page sprint-home">
    <header className="sprint-hero">
      <div><p className="eyebrow">80KG SPRINT · 第 {currentDay}／{totalDays} 天</p><h1>{settings.baselineWeightKg.toFixed(1)} <span>→</span> {settings.targetWeightKg.toFixed(1)} kg</h1><p>最近晨間 {currentWeight?.toFixed(1) ?? '—'} kg · 距離目標 {currentWeight == null ? '—' : Math.max(0, currentWeight - settings.targetWeightKg).toFixed(1)} kg</p></div>
      <span className={`finalized-badge ${log.dayFinalized ? 'done' : ''}`}>{log.dayFinalized ? '今日已結算' : '今日尚未結算'}</span>
    </header>

    <div className={`trend-status panel ${trend.status}`}><div><span>一週體重趨勢</span><strong>{trend.label}</strong><p>{trend.detail}</p></div>{trend.trend != null && <b>{trend.trend.toFixed(1)}<small> kg／3日</small></b>}</div>

    <div className="budget-grid">
      <article className="budget-card food panel"><span>今天還可安排</span><strong>{rounded(foodRemaining)}<small> kcal</small></strong><p>已吃 {rounded(log.intakeKcal)} · 建議上限 {settings.intakeKcalMaximum}</p></article>
      <article className="budget-card activity panel"><span>{activityRemaining > 0 ? '活動距基本目標' : '活動基本目標已達'}</span><strong>{activityRemaining > 0 ? rounded(activityRemaining) : '完成'}{activityRemaining > 0 && <small> kcal</small>}</strong><p>目前 {rounded(activity.effectiveActiveKcal)} · 基本 {settings.activeKcalMinimum} · 中心 {settings.activeKcalTarget}</p>{activityRemaining === 0 && <em>不需要強迫補跑</em>}</article>
    </div>

    <button type="button" className={`next-action panel ${action.tone}`} onClick={() => onOpenRecord(action.stage)}><span>現在唯一要做</span><strong>{action.title}</strong><small>{action.detail}</small><i>前往</i></button>

    <div className="stage-actions" aria-label="今日三階段"><button onClick={() => onOpenRecord('morning')}><span>早</span><strong>早上紀錄</strong><small>體重 · 睡眠 · 恢復</small></button><button onClick={() => onOpenRecord('food')}><span>食</span><strong>更新飲食</strong><small>熱量 · 蛋白 · 水</small></button><button onClick={() => onOpenRecord('evening')}><span>晚</span><strong>晚間結算</strong><small>Watch · 感受 · 結算</small></button></div>

    <div className="quick-sprint panel"><div className="quick-water"><button onClick={() => onQuickAdd({ waterMl: (log.waterMl ?? 0) + 250 })}>＋250ml 白水</button><button onClick={() => onQuickAdd({ waterMl: (log.waterMl ?? 0) + 500 })}>＋500ml 白水</button></div><FoodQuickActions log={log} templates={templates} onChange={onQuickAdd} quickOnly /></div>

    <details className="more-data panel"><summary><span>更多資料</span><strong>{log.dayFinalized ? `當日達成率 ${achievementRate(log, settings)}%` : `今日已完成 ${completion.completed}／${completion.total} 項`}</strong></summary><div className="more-data-body">
      {!log.dayFinalized && <p className="not-finalized-note">目前資料尚未完成今日結算，因此不顯示最終赤字。</p>}
      {log.dayFinalized && <article className="final-deficit"><span>今日最終推估赤字</span><strong>{rounded(deficit)} kcal</strong><p>依最後輸入的 Watch 靜態能量、活動能量與飲食估算。</p></article>}
      <div className="completion-list">{completion.items.map((item) => <span className={item.complete ? 'done' : ''} key={item.key}><i />{item.label}</span>)}</div>
      <div className="nutrient-strip" aria-label="今日營養素摘要"><div><span>蛋白質</span><strong>{rounded(log.proteinG)}g</strong></div><div><span>碳水</span><strong>{rounded(log.carbsG)}g</strong></div><div><span>脂肪</span><strong>{rounded(log.fatG)}g</strong></div><div><span>纖維</span><strong>{rounded(log.fiberG)}g</strong></div></div>
      <div className="mini-grid"><article className="stat"><span>前一晚睡眠</span><strong>{log.sleepHours ?? '—'} 小時</strong></article><article className="stat"><span>下肢緊繃／疼痛</span><strong>{log.lowerLegTightness ?? '—'}／5</strong></article><article className="stat"><span>運動明細</span><strong>{log.workouts?.length ?? 0} 筆</strong></article></div>
      <div className="advice-list">{advice.map((item, index) => <article className={`advice ${item.level}`} key={`${item.text}-${index}`}><i /><p>{item.text}</p></article>)}</div>
    </div></details>
  </section>
}
