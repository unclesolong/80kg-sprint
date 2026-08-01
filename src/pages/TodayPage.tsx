import { achievementRate, dailyDeficit, daysBetween, movingAverage } from '../calculations'
import { buildAdvice } from '../advice'
import type { ChallengeSettings, DailyLog } from '../types'

const Progress = ({ label, value, goal, unit, invert = false }: { label: string; value?: number; goal: number; unit: string; invert?: boolean }) => {
  const ratio = value == null ? 0 : invert ? Math.min(goal / Math.max(value, 1), 1) : Math.min(value / goal, 1)
  const tone = ratio >= 1 ? 'good' : ratio >= .75 ? 'near' : 'warn'
  return <div className="metric-row">
    <div><span>{label}</span><strong>{value == null ? '—' : Math.round(value * 10) / 10}<small>{unit}</small></strong></div>
    <div className="progress"><i className={tone} style={{ width: `${ratio * 100}%` }} /></div>
    <em>{Math.round(ratio * 100)}%</em>
  </div>
}

export function TodayPage({ today, log, logs, settings, onQuickAdd, onOpenRecord }: {
  today: string; log: DailyLog; logs: DailyLog[]; settings: ChallengeSettings
  onQuickAdd: (patch: Partial<DailyLog>) => void; onOpenRecord: () => void
}) {
  const morning = [...logs, log].filter((item, index, all) => all.findIndex((other) => other.id === item.id) === index)
    .filter((item) => item.weightCondition === 'morning_fasted' && item.weightKg != null).sort((a, b) => a.date.localeCompare(b.date))
  const trend = movingAverage(morning.map((item) => item.weightKg), 3).at(-1)
  const currentWeight = morning.at(-1)?.weightKg
  const deficit = dailyDeficit(log)
  const totalDays = Math.max(daysBetween(settings.startDate, settings.finalWeighInDate), 1)
  const currentDay = Math.min(Math.max(daysBetween(settings.startDate, today) + 1, 1), totalDays)
  const advice = buildAdvice(log, [...logs.filter((item) => item.id !== log.id), log], settings)
  const rate = achievementRate(log, settings)

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

    <div className="section-heading"><h2>今日節奏</h2><span>行為達成率 {rate}%</span></div>
    <div className="panel metrics">
      <Progress label="活動能量" value={log.activeKcal} goal={settings.activeKcalTarget} unit=" kcal" />
      <Progress label="攝取熱量" value={log.intakeKcal} goal={settings.intakeKcalMaximum} unit=" kcal" invert />
      <Progress label="蛋白質" value={log.proteinG} goal={settings.proteinMinimumG} unit=" g" />
      <Progress label="白開水" value={log.waterMl} goal={settings.waterMinimumMl} unit=" ml" />
    </div>

    <div className="mini-grid">
      <article className="panel stat"><span>今日推估赤字</span><strong>{deficit == null ? '—' : Math.round(deficit)}<small> kcal</small></strong><p>依 Watch 消耗估算</p></article>
      <article className="panel stat"><span>昨夜睡眠</span><strong>{log.sleepHours ?? '—'}<small> 小時</small></strong><p>{(log.sleepHours ?? 0) >= 7 ? '恢復時間充足' : '今天保守一點'}</p></article>
      <article className="panel stat"><span>排便狀況</span><strong>{log.bowelMovement === 'yes' ? '有' : '尚無'}</strong><p>{log.bristolType ? `Bristol ${log.bristolType}` : '可於紀錄頁補充'}</p></article>
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
