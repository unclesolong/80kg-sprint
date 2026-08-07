import { useEffect, useState } from 'react'
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Footprints, Scale, Target, Utensils } from 'lucide-react'
import { average, dailyDeficit, effectiveActiveKcal, estimatedTDEE, finalizedCumulativeDeficit, movingAverage, shouldShowSevenDayAverage, targetWeightForDate, targetWeightRangeForDate, weightPrediction, weightTrendStatus } from '../calculations'
import { formatChartDate, formatChartValue } from '../chartFormatting'
import type { ChallengeSettings, DailyLog } from '../types'

interface ChartDatum {
  date: string
  fullDate: string
  morning?: number
  other?: number
  ma3?: number
  ma7?: number
  target: number
  targetRange: [number, number]
  intake?: number
  tdee?: number
  deficit?: number
  active?: number
  exercise?: number
  steps?: number
  sleep?: number
  fatigue?: number
  hunger?: number
  leg?: number
}

interface TooltipEntry { dataKey?: string | number; name?: string | number; value?: unknown; payload?: ChartDatum }

const chartLabels: Record<string, string> = {
  morning: '晨間體重', other: '其他時間', ma3: '3 日趨勢', ma7: '7 日平均', target: '目標曲線', targetRange: '目標區間',
  intake: '攝取', tdee: '總消耗', deficit: '赤字', active: '活動能量', exercise: '運動分鐘', steps: '步數',
  sleep: '睡眠', fatigue: '疲勞', hunger: '飢餓', leg: '下肢／足底'
}
const emptyTrendsArt = `${import.meta.env.BASE_URL}art/empty-trends.webp`

const ChartCard = ({ title, note, children, footer }: { title: string; note: string; children: React.ReactNode; footer?: React.ReactNode }) => <article className="standard-card chart-card"><div><h3>{title}</h3><p>{note}</p></div><div className="chart-wrap">{children}</div>{footer}</article>
const Summary = ({ label, value, note, Icon }: { label: string; value: string; note?: string; Icon: typeof Scale }) => <article className="standard-card summary-card"><Icon aria-hidden="true" /><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</article>

const CompactTooltip = ({ active, payload, keys, className = '' }: { active?: boolean; payload?: readonly TooltipEntry[]; keys: readonly string[]; className?: string }) => {
  if (!active || !payload?.length) return null
  const source = payload.find((entry) => entry.payload)?.payload
  const rows = keys.flatMap((key) => {
    const entry = payload.find((item) => String(item.dataKey) === key)
    const value = formatChartValue(key, entry?.value ?? source?.[key as keyof ChartDatum])
    return value == null ? [] : [{ key, value }]
  }).slice(0, 4)
  if (!rows.length) return null
  return <div className={`compact-chart-tooltip ${className}`}><strong>{source?.fullDate ? formatChartDate(source.fullDate) : source?.date}</strong>{rows.map((row) => <div key={row.key}><span>{chartLabels[row.key] ?? row.key}</span><b>{row.value}</b></div>)}</div>
}

const tooltip = (keys: readonly string[], className = '') => (props: { active?: boolean; payload?: readonly unknown[] }) =>
  <CompactTooltip active={props.active} payload={props.payload as readonly TooltipEntry[] | undefined} keys={keys} className={className} />

export function TrendsPage({ logs, settings }: { logs: DailyLog[]; settings: ChallengeSettings }) {
  const ordered = [...logs].filter((log) => log.date >= settings.startDate && log.date <= settings.finalWeighInDate).sort((a, b) => a.date.localeCompare(b.date))
  const morning = ordered.filter((log) => log.weightCondition === 'morning_fasted' && log.weightKg != null)
  const finalized = ordered.filter((log) => log.dayFinalized)
  const ma3 = movingAverage(morning.map((log) => log.weightKg), 3)
  const ma7 = movingAverage(morning.map((log) => log.weightKg), 7)
  const morningByDate = new Map(morning.map((log, index) => [log.date, { ma3: ma3[index], ma7: ma7[index] }]))
  const data: ChartDatum[] = ordered.map((log) => {
    const range = targetWeightRangeForDate(log.date, settings)
    return {
      date: log.date.slice(5).replace('-', '/'), fullDate: log.date,
      morning: log.weightCondition === 'morning_fasted' ? log.weightKg : undefined,
      other: log.weightCondition === 'other' ? log.weightKg : undefined,
      ma3: morningByDate.get(log.date)?.ma3,
      ma7: shouldShowSevenDayAverage(morning.length) ? morningByDate.get(log.date)?.ma7 : undefined,
      target: targetWeightForDate(log.date, settings), targetRange: [range.lower, range.upper],
      intake: log.intakeKcal, tdee: log.dayFinalized ? estimatedTDEE(log) : undefined,
      deficit: log.dayFinalized ? dailyDeficit(log) : undefined,
      active: effectiveActiveKcal(log), exercise: log.exerciseMinutes, steps: log.steps,
      sleep: log.sleepHours, fatigue: log.fatigueLevel, hunger: log.hungerLevel, leg: log.lowerLegTightness
    }
  })
  const latestWeightDate = data.filter((item) => item.morning != null).at(-1)?.fullDate ?? ''
  const hasWeightMeasurements = data.some((item) => item.morning != null || item.other != null)
  const [selectedDate, setSelectedDate] = useState(latestWeightDate)
  useEffect(() => {
    if (!selectedDate || !data.some((item) => item.fullDate === selectedDate && item.morning != null)) setSelectedDate(latestWeightDate)
  }, [data, latestWeightDate, selectedDate])
  const selected = data.find((item) => item.fullDate === selectedDate) ?? data.find((item) => item.fullDate === latestWeightDate)
  const selectChartPoint = (state: { activeLabel?: string | number } | null | undefined) => {
    const point = data.find((item) => item.date === String(state?.activeLabel ?? ''))
    if (point?.morning != null) setSelectedDate(point.fullDate)
  }

  const statusDate = morning.at(-1)?.date ?? settings.startDate
  const status = weightTrendStatus(morning, statusDate, settings).status
  const trend = ma3.at(-1)
  const targetRange = morning.length ? targetWeightRangeForDate(morning.at(-1)!.date, settings) : undefined
  const targetGap = trend == null || targetRange == null ? undefined : Math.max(0, trend - targetRange.upper)
  const prediction = weightPrediction(morning.map((log) => ({ date: log.date, weight: log.weightKg! })), settings.finalWeighInDate)
  const cumulative = finalizedCumulativeDeficit(ordered, settings)
  const statusText = status === 'collecting' ? '蒐集基準中' : status === 'on_track' ? '在目標區間' : status === 'possible' ? '仍可調整' : '落後目標曲線'
  const simple = (key: string, value: unknown, fallback = '—') => formatChartValue(key, value) ?? fallback
  const predictionText = prediction.confidence === 'insufficient' ? '資料不足，需至少 7 筆晨間體重' : `${prediction.value!.toFixed(1)} kg`
  const predictionNote = prediction.confidence === 'insufficient' ? `目前資料 ${prediction.sampleCount}／7 筆` : prediction.confidence === 'low' ? '低信心 · 約 ±0.5 kg 水分區間' : '趨勢估算 · 不是保證'

  const inspector = selected && <div className="chart-inspector" aria-live="polite"><strong>{formatChartDate(selected.fullDate)}</strong><dl>{[
    ['晨間體重', formatChartValue('morning', selected.morning)],
    ['3 日趨勢', formatChartValue('ma3', selected.ma3)],
    ['目標區間', formatChartValue('targetRange', selected.targetRange)]
  ].flatMap(([label, value]) => value == null ? [] : [<div key={label}><dt>{label}</dt><dd>{value}</dd></div>])}</dl></div>

  return <section className="page trends-page">
    <header className="page-header"><div><p className="eyebrow">看方向，不被單日數字牽動</p><h1>7 日趨勢</h1></div></header>

    <div className={`trend-overview standard-card status-${status}`}><span>目前判讀</span><strong>{statusText}</strong><p>{status === 'collecting' ? `最新晨間 ${simple('morning', morning.at(-1)?.weightKg)} · 已有 ${morning.length}/3 筆` : `最新晨間 ${simple('morning', morning.at(-1)?.weightKg)} · 已完成 ${finalized.length} 天結算`}</p></div>

    <div className="summary-grid trend-summary">
      <Summary Icon={Scale} label="3 日體重趨勢" value={simple('ma3', trend)} note={morning.length < 3 ? '至少 3 筆晨間量測' : undefined} />
      <Summary Icon={Target} label="距離目標區間" value={targetGap == null ? '—' : targetGap === 0 ? '區間內' : simple('morning', targetGap)} />
      <Summary Icon={Utensils} label="平均攝取" value={simple('intake', average(ordered.map((log) => log.intakeKcal)))} />
      <Summary Icon={Footprints} label="平均活動" value={simple('active', average(ordered.map(effectiveActiveKcal)))} />
    </div>

    {!hasWeightMeasurements ? <div className="empty-state trend-empty-state panel"><div className="trend-empty-art" aria-hidden="true"><img src={emptyTrendsArt} alt="" loading="lazy" decoding="async" /></div><strong>還沒有體重趨勢資料</strong><p>先完成一筆晨間體重紀錄；累積 3 筆後，我們會開始判讀趨勢。</p></div> : <ChartCard title="晨間體重與目標區間" note="點擊或滑動某一天，下方會固定顯示格式化資訊。" footer={inspector}>
      <ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} onClick={selectChartPoint} onMouseMove={selectChartPoint}><CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" /><XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 11 }} /><YAxis domain={['dataMin - 0.5', 'dataMax + 0.5']} tickFormatter={(value: number) => value.toFixed(1)} tick={{ fill: 'var(--muted)', fontSize: 11 }} /><Tooltip content={tooltip(['morning', 'ma3', 'targetRange'], 'weight-desktop-tooltip')} wrapperStyle={{ maxWidth: 220, outline: 'none' }} /><Legend /><Area name="目標區間" dataKey="targetRange" stroke="none" fill="#65d38e22" /><Line name="目標曲線" dataKey="target" stroke="#65d38e" strokeDasharray="5 4" dot={false} /><Line name="晨間體重" dataKey="morning" stroke="var(--text)" strokeWidth={2} connectNulls /><Line name="3 日趨勢" dataKey="ma3" stroke="#f0bf63" strokeWidth={3} connectNulls dot={false} /></ComposedChart></ResponsiveContainer>
    </ChartCard>}

    {data.length > 0 && <details className="chart-data-table standard-card"><summary>以資料表查看趨勢</summary><div className="chart-data-scroll" role="region" aria-label="趨勢圖資料表，可水平捲動" tabIndex={0}><table><caption>已紀錄日期的趨勢摘要</caption><thead><tr><th scope="col">日期</th><th scope="col">晨間體重</th><th scope="col">3 日趨勢</th><th scope="col">目標區間</th><th scope="col">攝取</th><th scope="col">活動</th></tr></thead><tbody>{data.map((item) => <tr key={item.fullDate}><th scope="row">{formatChartDate(item.fullDate)}</th><td>{simple('morning', item.morning)}</td><td>{simple('ma3', item.ma3)}</td><td>{simple('targetRange', item.targetRange)}</td><td>{simple('intake', item.intake)}</td><td>{simple('active', item.active)}</td></tr>)}</tbody></table></div></details>}

    {data.length > 0 && <details className="advanced-trends standard-card"><summary>查看進階趨勢</summary><div className="details-body chart-stack">
      <div className="advanced-summary"><p>累積最終赤字 <strong>{simple('deficit', cumulative)}</strong></p><p>最終日線性估算 <strong>{predictionText}</strong></p><p>預測信心 <strong>{prediction.confidence === 'insufficient' ? '資料不足' : prediction.confidence === 'low' ? '低' : '趨勢估算'}</strong></p><small>{predictionNote}</small></div>
      <ChartCard title="體重細節" note={`其他時間量測為虛線；${shouldShowSevenDayAverage(morning.length) ? '已顯示 7 日平均' : '滿 7 筆才顯示 7 日平均'}。`}><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" /><XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 11 }} /><YAxis domain={['dataMin - 0.5', 'dataMax + 0.5']} tickFormatter={(value: number) => value.toFixed(1)} tick={{ fill: 'var(--muted)', fontSize: 11 }} /><Tooltip content={tooltip(['morning', 'other', 'ma7'])} wrapperStyle={{ maxWidth: 220, outline: 'none' }} /><Legend /><Line name="晨間" dataKey="morning" stroke="var(--text)" connectNulls /><Line name="其他時間" dataKey="other" stroke="#9ba59e" strokeDasharray="2 4" /><Line name="7 日平均" dataKey="ma7" stroke="#6db7ff" strokeWidth={2} connectNulls dot={false} /></ComposedChart></ResponsiveContainer></ChartCard>
      <ChartCard title="已結算能量" note="未按日結的日期不顯示消耗或赤字。"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" /><XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 11 }} /><YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} /><Tooltip content={tooltip(['intake', 'tdee', 'deficit'])} wrapperStyle={{ maxWidth: 220, outline: 'none' }} /><Legend /><Bar name="攝取" dataKey="intake" fill="#f0bf63" /><Line name="總消耗" dataKey="tdee" stroke="#6db7ff" /><Line name="最終赤字" dataKey="deficit" stroke="#65d38e" /></ComposedChart></ResponsiveContainer></ChartCard>
      <ChartCard title="活動與運動分鐘" note="活動熱量與分鐘使用相同日期，但不互相加總。"><ResponsiveContainer width="100%" height="100%"><BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" /><XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 11 }} /><YAxis yAxisId="kcal" tick={{ fill: 'var(--muted)', fontSize: 11 }} /><YAxis yAxisId="minutes" orientation="right" tick={{ fill: 'var(--muted)', fontSize: 11 }} /><Tooltip content={tooltip(['active', 'exercise'])} wrapperStyle={{ maxWidth: 220, outline: 'none' }} /><Legend /><Bar yAxisId="kcal" name="活動 kcal" dataKey="active" fill="#65d38e" /><Line yAxisId="minutes" name="運動分" dataKey="exercise" stroke="#6db7ff" /></BarChart></ResponsiveContainer></ChartCard>
      <ChartCard title="恢復訊號" note="前一晚睡眠、疲勞、飢餓與下肢／足底狀態。"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" /><XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 11 }} /><YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} /><Tooltip content={tooltip(['sleep', 'fatigue', 'hunger', 'leg'])} wrapperStyle={{ maxWidth: 220, outline: 'none' }} /><Legend /><Line name="睡眠小時" dataKey="sleep" stroke="#6db7ff" /><Line name="疲勞" dataKey="fatigue" stroke="#ef6d74" /><Line name="飢餓" dataKey="hunger" stroke="#f0bf63" /><Line name="下肢／足底" dataKey="leg" stroke="#d594f5" /></ComposedChart></ResponsiveContainer></ChartCard>
    </div></details>}
  </section>
}
