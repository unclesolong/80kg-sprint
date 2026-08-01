import { achievementRate, dailyDeficit, daysBetween, movingAverage } from '../calculations'
import { buildAdvice } from '../advice'
import type { ChallengeSettings, DailyLog } from '../types'

const Progress = ({ label, value, goal, unit }: { label: string; value?: number; goal: number; unit: string }) => {
  const ratio = value == null ? 0 : Math.min(value / goal, 1)
  const tone = ratio >= 1 ? 'good' : ratio >= .75 ? 'near' : 'warn'
  return <div className="metric-row">
    <div><span>{label}</span><strong>{value == null ? '—' : Math.round(value * 10) / 10}<small>{unit}</small></strong></div>
    <div className="progress"><i className={tone} style={{ width: `${ratio * 100}%` }} /></div>
    <em>{Math.round(ratio * 100)}%</em>
  </div>
}

const RangeProgress = ({ label, value, minimum, maximum, unit }: { label: string; value?: number; minimum: number; maximum: number; unit: string }) => {
  const ratio = value == null ? 0 : Math.min(value / maximum, 1)
  const tone = value == null ? 'warn' : value < minimum ? 'near' : value <= maximum ? 'good' : 'warn'
  const status = value == null ? '未記錄' : value < minimum ? '低於範圍' : value <= maximum ? '範圍內' : '高於範圍'
  return <div className="metric-row range-metric">
    <div><span>{label}</span><strong>{value == null ? '—' : Math.round(value)}<small>{unit}</small></strong></div>
    <div className="progress range"><i className={tone} style={{ width: `${ratio * 100}%` }} /><b style={{ left: `${minimum / maximum * 100}%` }} /></div>
    <em>{status}</em>
  </div>
}

export function TodayPage({ today, log, logs, settings, onQuickAdd, onOpenRecord }: {
  today: string; log: DailyLog; logs: DailyLog[]; settings: ChallengeSettings
  onQuickAdd: (patch: Partial<DailyLog>) => void; onOpenRecord: () => void
}) {
  const morning = [...logs, log].filter((item, index, all) => all.findIndex((other) => other.id === item.id) === index)
    .filter((item) => item.date <= today)
    .filter((item) => item.weightCondition === 'morning_fasted' && item.weightKg != null).sort((a, b) => a.date.localeCompare(b.date))
  const trend = movingAverage(morning.map((item) => item.weightKg), 3).at(-1)
  const currentWeight = morning.at(-1)?.weightKg
  const deficit = dailyDeficit(log)
  const totalDays = Math.max(daysBetween(settings.startDate, settings.finalWeighInDate), 1)
  const currentDay = Math.min(Math.max(daysBetween(settings.startDate, today) + 1, 1), totalDays)
  const advice = buildAdvice(log, [...logs.filter((item) => item.id !== log.id), log], settings)
  const rate = achievementRate(log, settings)
  const workoutMinutes = (log.workouts ?? []).reduce((sum, workout) => sum + workout.durationMinutes, 0)
  const incompleteItems: string[] = []
  if (log.weightKg == null || log.weightCondition !== 'morning_fasted') incompleteItems.push('晨間空腹體重未記錄')
  if (log.activeKcal == null) incompleteItems.push('活動能量未記錄')
  else if (log.activeKcal < settings.activeKcalMinimum) incompleteItems.push(`活動能量還差 ${Math.ceil(settings.activeKcalMinimum - log.activeKcal)} kcal`)
  if (log.intakeKcal == null) incompleteItems.push('今日攝取熱量未記錄')
  else if (log.intakeKcal < settings.intakeKcalMinimum) incompleteItems.push(`攝取熱量尚差 ${Math.ceil(settings.intakeKcalMinimum - log.intakeKcal)} kcal 才進入目標範圍`)
  else if (log.intakeKcal > settings.intakeKcalMaximum) incompleteItems.push(`攝取熱量超出目標範圍 ${Math.ceil(log.intakeKcal - settings.intakeKcalMaximum)} kcal`)
  if (log.proteinG == null) incompleteItems.push('蛋白質未記錄')
  else if (log.proteinG < settings.proteinMinimumG) incompleteItems.push(`蛋白質還差 ${Math.ceil(settings.proteinMinimumG - log.proteinG)} g`)
  if (log.waterMl == null) incompleteItems.push('白開水未記錄')
  else if (log.waterMl < settings.waterMinimumMl) incompleteItems.push(`白開水還差 ${Math.ceil(settings.waterMinimumMl - log.waterMl)} ml`)
  if (log.sleepHours == null) incompleteItems.push('前一晚睡眠未記錄')
  else if (log.sleepHours < settings.sleepMinimumHours) incompleteItems.push(`前一晚睡眠還差 ${(settings.sleepMinimumHours - log.sleepHours).toFixed(1)} 小時`)
  if ((log.exerciseMinutes ?? 0) < settings.exerciseMinutesMinimum && (log.steps ?? 0) < settings.stepsMinimum) incompleteItems.push('運動時間或步數尚未完成')

  return <section className="page today-page">
    <header className="hero">
      <div><p className="eyebrow">回到 80 公斤</p><h1>第 {currentDay} 天<span>／共 {totalDays} 天</span></h1></div>
      <div className="score-ring" style={{ '--score': `${rate * 3.6}deg` } as React.CSSProperties}><strong>{rate}</strong><small>%</small></div>
    </header>

    <div className="weight-card panel">
      <div><span>晨間體重</span><strong>{currentWeight?.toFixed(1) ?? '—'}<small>kg</small></strong></div>
      <div><span>3 日趨勢</span><strong>{trend?.toFixed(1) ?? '—'}<small>kg</small></strong></div>
      <div><span>距離目標</span><strong>{currentWeight == null ? '—' : Math.max(0, currentWeight - settings.targetWeightKg).toFixed(1)}<small>kg</small></strong></div>
    </div>

    <div className={`completion-card panel ${incompleteItems.length === 0 ? 'complete' : ''}`}>
      <div className="completion-heading"><div><span>{incompleteItems.length === 0 ? '今日核心項目' : `尚有 ${incompleteItems.length} 項待完成`}</span><strong>{incompleteItems.length === 0 ? '全部完成，很穩。' : '今天還需要留意'}</strong></div><button type="button" onClick={onOpenRecord}>{incompleteItems.length === 0 ? '查看紀錄' : '前往補記'}</button></div>
      {incompleteItems.length > 0 && <ul>{incompleteItems.map((item) => <li key={item}>{item}</li>)}</ul>}
    </div>

    <div className="section-heading"><h2>今日節奏</h2><span>行為達成率 {rate}%</span></div>
    <div className="panel metrics">
      <Progress label="活動能量" value={log.activeKcal} goal={settings.activeKcalTarget} unit=" kcal" />
      <RangeProgress label="攝取熱量" value={log.intakeKcal} minimum={settings.intakeKcalMinimum} maximum={settings.intakeKcalMaximum} unit=" kcal" />
      <Progress label="蛋白質" value={log.proteinG} goal={settings.proteinMinimumG} unit=" g" />
      <Progress label="白開水" value={log.waterMl} goal={settings.waterMinimumMl} unit=" ml" />
    </div>

    <div className="nutrient-strip panel" aria-label="今日營養素摘要">
      <div><span>碳水</span><strong>{log.carbsG == null ? '—' : Math.round(log.carbsG)}<small> g</small></strong></div>
      <div><span>脂肪</span><strong>{log.fatG == null ? '—' : Math.round(log.fatG)}<small> g</small></strong></div>
      <div><span>纖維</span><strong>{log.fiberG == null ? '—' : Math.round(log.fiberG)}<small> g</small></strong></div>
      <div><span>鈉</span><strong>{log.sodiumMg == null ? '—' : Math.round(log.sodiumMg)}<small> mg</small></strong></div>
    </div>

    <div className="mini-grid">
      <article className="panel stat"><span>今日推估赤字</span><strong>{deficit == null ? '—' : Math.round(deficit)}<small> kcal</small></strong><p>依 Watch 消耗估算</p></article>
      <article className="panel stat"><span>前一晚睡眠</span><strong>{log.sleepHours ?? '—'}<small> 小時</small></strong><p>{(log.sleepHours ?? 0) >= 7 ? '恢復時間充足' : '今天保守一點'}</p></article>
      <article className="panel stat"><span>運動明細</span><strong>{(log.workouts ?? []).length}<small> 筆</small></strong><p>{workoutMinutes ? `合計 ${workoutMinutes} 分鐘` : '可記錄步行、跑步或重訓'}</p></article>
    </div>

    <div className="section-heading"><h2>今日建議</h2><span>依目前紀錄</span></div>
    <div className="advice-list">{advice.map((item, index) => <article className={`advice ${item.level}`} key={`${item.text}-${index}`}><i /> <p>{item.text}</p></article>)}</div>

    <div className="quick-actions panel">
      <button onClick={() => onQuickAdd({ waterMl: (log.waterMl ?? 0) + 250 })}>＋250 ml 水</button>
      <button onClick={() => onQuickAdd({ proteinG: (log.proteinG ?? 0) + 20 })}>＋20 g 蛋白質</button>
      <button className="primary" onClick={onOpenRecord}>完整紀錄</button>
    </div>
  </section>
}
