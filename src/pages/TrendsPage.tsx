import { Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { achievementRate, average, cumulativeDeficit, dailyDeficit, estimatedTDEE, fatEquivalentKg, linearRegressionProjection, movingAverage, targetWeightForDate } from '../calculations'
import type { ChallengeSettings, DailyLog } from '../types'

const tipStyle = { background: '#171c19', border: '1px solid #343b37', borderRadius: 12, color: '#f5f7f5' }
const ChartCard = ({ title, note, children }: { title: string; note: string; children: React.ReactNode }) => <article className="panel chart-card"><div><h3>{title}</h3><p>{note}</p></div><div className="chart-wrap">{children}</div></article>
const Summary = ({ label, value, note }: { label: string; value: string; note?: string }) => <article className="panel summary-card"><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</article>

export function TrendsPage({ logs, settings }: { logs: DailyLog[]; settings: ChallengeSettings }) {
  const ordered = [...logs].filter((log) => log.date >= settings.startDate && log.date <= settings.finalWeighInDate).sort((a, b) => a.date.localeCompare(b.date))
  const morning = ordered.filter((log) => log.weightCondition === 'morning_fasted' && log.weightKg != null)
  const ma3 = movingAverage(morning.map((log) => log.weightKg), 3)
  const ma7 = movingAverage(morning.map((log) => log.weightKg), 7)
  const morningByDate = new Map(morning.map((log, index) => [log.date, { ma3: ma3[index], ma7: ma7[index] }]))
  const data = ordered.map((log) => ({
    date: log.date.slice(5).replace('-', '/'), fullDate: log.date,
    morning: log.weightCondition === 'morning_fasted' ? log.weightKg : undefined,
    other: log.weightCondition === 'other' ? log.weightKg : undefined,
    ma3: morningByDate.get(log.date)?.ma3, ma7: morningByDate.get(log.date)?.ma7,
    target: targetWeightForDate(log.date, settings), targetFinal: settings.targetWeightKg,
    intake: log.intakeKcal, tdee: estimatedTDEE(log), deficit: dailyDeficit(log),
    active: log.activeKcal, exercise: log.exerciseMinutes, steps: log.steps,
    sleep: log.sleepHours, fatigue: log.fatigueLevel, hunger: log.hungerLevel
  }))
  const cumulative = cumulativeDeficit(ordered, settings)
  const prediction = linearRegressionProjection(morning.map((log) => ({ date: log.date, weight: log.weightKg! })), settings.finalWeighInDate)
  const actualChange = morning.length ? morning.at(-1)!.weightKg! - settings.baselineWeightKg : undefined
  const achieved = ordered.filter((log) => achievementRate(log, settings) >= 80).length
  const format = (value: number | undefined, unit: string) => value == null ? '—' : `${Math.round(value * 10) / 10} ${unit}`

  return <section className="page trends-page">
    <header className="page-header"><div><p className="eyebrow">趨勢，不是判決</p><h1>7 日分析</h1></div></header>
    {prediction == null ? <div className="prediction panel"><span>最終日預測</span><strong>需要至少 3 筆晨間體重</strong><p>其他時間量測只以空心點顯示，不納入主要趨勢。</p></div> : <div className="prediction panel"><span>最終日預測</span><strong>{prediction.toFixed(1)} kg <small>±0.5 kg</small></strong><p>水分波動區間；這是簡單線性回歸預測，不是保證。</p></div>}

    {data.length === 0 ? <div className="empty-state panel"><strong>還沒有趨勢資料</strong><p>從「紀錄」加入第一筆資料後，圖表會出現在這裡。</p></div> : <div className="chart-stack">
      <ChartCard title="體重趨勢" note="晨間體重、3/7 日移動平均與目標線">
        <ResponsiveContainer width="100%" height="100%"><ComposedChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" /><XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 11 }} /><YAxis domain={['dataMin - 0.5', 'dataMax + 0.5']} tick={{ fill: 'var(--muted)', fontSize: 11 }} /><Tooltip contentStyle={tipStyle} /><Legend /><Line name="晨間體重" dataKey="morning" stroke="#f4f7f4" strokeWidth={2} connectNulls /><Line name="其他時間（空心）" dataKey="other" stroke="#9ba59e" strokeDasharray="2 4" dot={{ fill: 'var(--card)', stroke: '#9ba59e', strokeWidth: 2, r: 4 }} /><Line name="3日平均" dataKey="ma3" stroke="#65d38e" strokeWidth={3} connectNulls dot={false} /><Line name="7日平均" dataKey="ma7" stroke="#6db7ff" strokeWidth={2} connectNulls dot={false} /><Line name="目標曲線" dataKey="target" stroke="#f0bf63" strokeDasharray="5 4" dot={false} /><Line name={`${settings.targetWeightKg} kg`} dataKey="targetFinal" stroke="#ef6d74" strokeDasharray="2 4" dot={false} /></ComposedChart></ResponsiveContainer>
      </ChartCard>
      <ChartCard title="能量收支" note="Apple Watch 消耗與每日赤字皆為估算">
        <ResponsiveContainer width="100%" height="100%"><ComposedChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" /><XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 11 }} /><YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} /><Tooltip contentStyle={tipStyle} /><Legend /><Bar name="攝取" dataKey="intake" fill="#f0bf63" radius={[5, 5, 0, 0]} /><Line name="推估消耗" dataKey="tdee" stroke="#6db7ff" strokeWidth={2} /><Line name="推估赤字" dataKey="deficit" stroke="#65d38e" strokeWidth={2} /></ComposedChart></ResponsiveContainer>
      </ChartCard>
      <ChartCard title="活動" note="活動能量、運動分鐘與步數">
        <ResponsiveContainer width="100%" height="100%"><BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" /><XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 11 }} /><YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} /><Tooltip contentStyle={tipStyle} /><Legend /><Bar name="活動 kcal" dataKey="active" fill="#65d38e" radius={[4, 4, 0, 0]} /><Bar name="運動分" dataKey="exercise" fill="#6db7ff" radius={[4, 4, 0, 0]} /><Line name="步數" dataKey="steps" stroke="#d594f5" /></BarChart></ResponsiveContainer>
      </ChartCard>
      <ChartCard title="恢復與感受" note="睡眠、疲勞與飢餓（1–5）">
        <ResponsiveContainer width="100%" height="100%"><AreaChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" /><XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 11 }} /><YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} /><Tooltip contentStyle={tipStyle} /><Legend /><Area name="睡眠小時" dataKey="sleep" stroke="#6db7ff" fill="#6db7ff33" /><Line name="疲勞" dataKey="fatigue" stroke="#ef6d74" /><Line name="飢餓" dataKey="hunger" stroke="#f0bf63" /></AreaChart></ResponsiveContainer>
      </ChartCard>
    </div>}

    <div className="section-heading"><h2>摘要</h2><span>{ordered.length} 天紀錄</span></div>
    <div className="summary-grid">
      <Summary label="平均每日攝取" value={format(average(ordered.map((log) => log.intakeKcal)), 'kcal')} />
      <Summary label="平均活動能量" value={format(average(ordered.map((log) => log.activeKcal)), 'kcal')} />
      <Summary label="平均推估赤字" value={format(average(ordered.map(dailyDeficit)), 'kcal')} />
      <Summary label="累積推估赤字" value={format(cumulative, 'kcal')} />
      <Summary label="脂肪等值估算" value={format(fatEquivalentKg(cumulative), 'kg')} note="7700 kcal/kg 僅為估算" />
      <Summary label="體重實際變化" value={format(actualChange, 'kg')} />
      <Summary label="有效晨間量測" value={`${morning.length} 次`} />
      <Summary label="達標天數" value={`${achieved} 天`} note="行為達成率 ≥ 80%" />
    </div>
  </section>
}
