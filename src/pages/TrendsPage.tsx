import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Scatter, XAxis, YAxis } from 'recharts'
import { TrendRangeControl } from '../components/TrendRangeControl'
import { formatChartDate, formatChartValue } from '../chartFormatting'
import type { ChallengeSettings, DailyLog } from '../types'
import { buildTrendDashboardModel } from '../viewModels/trendDashboard'
import type { TrendDatum, TrendRange, TrendSource } from '../viewModels/trendDashboard'

const emptyTrendsArt = `${import.meta.env.BASE_URL}art/empty-trends.webp`
const integer = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 })

interface ChartState { activeLabel?: string | number }
interface ChartKeyItem { className: string; label: string }

const axisDate = (value: string) => value.slice(5).replace('-', '/')
const simple = (key: string, value: unknown, fallback = '—') => formatChartValue(key, value) ?? fallback
const trendLabel = (source: TrendSource) => source === 'ma7' ? '7 日趨勢' : source === 'ma3' ? '3 日趨勢' : '趨勢'
const signedWeight = (value?: number) => value == null
  ? '—'
  : `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(1)} kg`

const ChartKey = ({ items }: { items: ChartKeyItem[] }) => <div className="v6-trend-chart-key" aria-hidden="true">
  {items.map((item) => <span className={item.className} key={item.label}><i />{item.label}</span>)}
</div>

const ChartCard = ({ title, note, ariaLabel, keys, children, footer }: {
  title: string
  note: string
  ariaLabel: string
  keys?: ChartKeyItem[]
  children: ReactNode
  footer?: ReactNode
}) => <article className="standard-card chart-card v6-trend-chart-card">
  <header><h3>{title}</h3><p>{note}</p>{keys && <ChartKey items={keys} />}</header>
  <div className="chart-wrap" role="img" aria-label={ariaLabel}>{children}</div>
  {footer}
</article>

const chartGrid = <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--grid)" />

const ChartXAxis = ({ interval }: { interval: number }) => <XAxis
  dataKey="fullDate"
  interval={interval}
  tickFormatter={axisDate}
  minTickGap={12}
  tick={{ fill: 'var(--muted)', fontSize: 12 }}
/>

const WeightYAxis = () => <YAxis
  width={42}
  domain={[
    (minimum: number) => Math.floor((minimum - .5) * 10) / 10,
    (maximum: number) => Math.ceil((maximum + .5) * 10) / 10
  ]}
  tickFormatter={(value: number) => value.toFixed(1)}
  tick={{ fill: 'var(--muted)', fontSize: 12 }}
/>

const RangeSummary = ({ model }: { model: ReturnType<typeof buildTrendDashboardModel> }) => {
  const sourceLabel = model.trendSource === 'none' ? '趨勢資料' : `最新 ${trendLabel(model.trendSource)}`
  const trendValue = model.latestTrendKg == null ? '蒐集中' : simple(model.trendSource, model.latestTrendKg)
  return <dl className="v6-trend-summary-panel standard-card" aria-label="目前趨勢摘要">
    <div><dt>{sourceLabel}</dt><dd><strong>{trendValue}</strong><small>{model.morningCount} 筆晨間體重</small></dd></div>
    <div><dt>較前 7 日</dt><dd><strong>{signedWeight(model.previousWeekDeltaKg)}</strong><small>{model.previousWeekDeltaKg == null ? '需累積可比較資料' : '單日波動不作結論'}</small></dd></div>
    <div><dt>已記錄日平均攝取</dt><dd><strong>{simple('intake', model.averages.intake)}</strong><small>{model.averages.intakeSampleCount} 天</small></dd></div>
    <div><dt>已記錄日平均活動</dt><dd><strong>{simple('active', model.averages.activity)}</strong><small>{model.averages.activitySampleCount} 天</small></dd></div>
  </dl>
}

const Inspector = ({ selected, source }: { selected?: TrendDatum; source: TrendSource }) => {
  if (!selected) return null
  const required = source === 'ma7' ? 7 : 3
  const collected = Math.min(selected.morningCountThroughDate, required)
  const trendValue = selected.trend == null ? `蒐集中 ${collected}／${required}` : simple(source, selected.trend)
  return <section className="chart-inspector v6-trend-inspector" aria-live="polite" aria-atomic="true">
    <strong>{formatChartDate(selected.fullDate)}</strong>
    <dl>
      <div><dt>晨間體重</dt><dd>{simple('morning', selected.morning)}</dd></div>
      <div><dt>{trendLabel(source)}</dt><dd>{trendValue}</dd></div>
      <div><dt>目標區間</dt><dd>{simple('targetRange', selected.targetRange)}</dd></div>
      <div><dt>較前 7 日</dt><dd>{signedWeight(selected.previousWeekDeltaKg)}</dd></div>
    </dl>
  </section>
}

const DataTable = ({ data, source }: { data: TrendDatum[]; source: TrendSource }) => <details className="chart-data-table standard-card">
  <summary>資料表</summary>
  <div className="chart-data-scroll" role="region" aria-label="趨勢資料表，可水平捲動" tabIndex={0}>
    <table>
      <caption>目前顯示範圍的趨勢資料</caption>
      <thead><tr><th scope="col">日期</th><th scope="col">晨間體重</th><th scope="col">{trendLabel(source)}</th><th scope="col">目標區間</th><th scope="col">攝取</th><th scope="col">活動</th><th scope="col">最終赤字</th></tr></thead>
      <tbody>{data.map((item) => <tr key={item.fullDate}>
        <th scope="row">{formatChartDate(item.fullDate)}</th>
        <td>{simple('morning', item.morning)}</td>
        <td>{simple(source, item.trend)}</td>
        <td>{simple('targetRange', item.targetRange)}</td>
        <td>{simple('intake', item.intake)}</td>
        <td>{simple('active', item.active)}</td>
        <td>{simple('deficit', item.deficit)}</td>
      </tr>)}</tbody>
    </table>
  </div>
</details>

export function TrendsPage({ logs, settings }: { logs: DailyLog[]; settings: ChallengeSettings }) {
  const [range, setRange] = useState<TrendRange>('14d')
  const [selectedDate, setSelectedDate] = useState('')
  const model = useMemo(
    () => buildTrendDashboardModel(logs, settings, range, selectedDate),
    [logs, range, selectedDate, settings]
  )

  useEffect(() => {
    const fallbackDate = model.selected?.fullDate ?? ''
    if (fallbackDate !== selectedDate) setSelectedDate(fallbackDate)
  }, [model.selected?.fullDate, selectedDate])

  const data = model.visibleSeries
  const selected = model.selected
  const xInterval = Math.max(0, Math.ceil(data.length / 5) - 1)
  const selectChartPoint = (state: ChartState | null | undefined) => {
    const fullDate = String(state?.activeLabel ?? '')
    if (data.some((item) => item.fullDate === fullDate)) setSelectedDate(fullDate)
  }
  const statusText = model.status === 'collecting' ? '蒐集基準中' : model.status === 'on_track' ? '在目標區間' : model.status === 'possible' ? '仍可調整' : '落後目標曲線'
  const predictionText = model.prediction.confidence === 'insufficient' ? '資料不足' : `${model.prediction.value?.toFixed(1)} kg`
  const predictionNote = model.prediction.confidence === 'insufficient'
    ? `目前 ${model.prediction.sampleCount}／7 筆晨間體重`
    : model.prediction.confidence === 'low' ? '低信心 · 約 ±0.5 kg 水分區間' : '趨勢估算 · 不是保證'
  const chartSummary = model.morningCount < 3
    ? `目前有 ${model.morningCount} 筆晨間體重，累積 3 筆後顯示短期趨勢。`
    : `目前有 ${model.morningCount} 筆晨間體重，主圖顯示${trendLabel(model.trendSource)}、晨重點與目標區間。`

  return <section className="page trends-page v6-trends-page">
    <header className="page-header v6-trends-header"><div><p className="eyebrow">看方向，不被單日數字牽動</p><h1>體重趨勢</h1></div><TrendRangeControl value={range} onChange={setRange} /></header>

    <div className={`trend-overview standard-card status-${model.status}`}><span>目前判讀</span><strong>{statusText}</strong><p>最新晨間 {simple('morning', model.latestMorningKg)} · {model.morningCount} 筆晨間紀錄</p></div>

    <RangeSummary model={model} />

    {model.morningCount === 0 ? <div className="empty-state trend-empty-state panel"><div className="trend-empty-art" aria-hidden="true"><img src={emptyTrendsArt} alt="" loading="lazy" decoding="async" /></div><strong>還沒有體重趨勢</strong><p>先完成一筆晨間體重。累積 3 筆後開始顯示短期趨勢，7 筆後顯示 7 日平均。</p></div> : <>
      <p id="v6-trend-chart-summary" className="v6-trend-chart-summary">{chartSummary}</p>
      <ChartCard
        title="晨間體重與目標區間"
        note="點擊或滑動日期後，下方固定資訊會同步更新。"
        ariaLabel={chartSummary}
        keys={[
          { className: 'morning', label: '晨重' },
          { className: 'trend', label: trendLabel(model.trendSource) },
          { className: 'target', label: '目標區間' }
        ]}
        footer={<Inspector selected={selected} source={model.trendSource} />}
      >
        <ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} onClick={selectChartPoint} onMouseMove={selectChartPoint} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
          {chartGrid}<ChartXAxis interval={xInterval} /><WeightYAxis />
          <Area dataKey="targetRange" stroke="none" fill="#65d38e22" isAnimationActive={false} />
          <Line dataKey="target" stroke="var(--green)" strokeWidth={1.25} strokeDasharray="5 5" dot={false} connectNulls={false} isAnimationActive={false} />
          <Line dataKey="trend" stroke="var(--blue)" strokeWidth={2.5} dot={false} connectNulls={false} isAnimationActive={false} />
          <Scatter dataKey="morning" fill="var(--text)" line={false} isAnimationActive={false} />
          {selected && <ReferenceLine x={selected.fullDate} stroke="var(--muted)" strokeOpacity={.5} strokeDasharray="3 4" />}
          {selected?.morning != null && <ReferenceDot x={selected.fullDate} y={selected.morning} r={6} fill="var(--text)" stroke="var(--blue)" strokeWidth={3} />}
        </ComposedChart></ResponsiveContainer>
      </ChartCard>
    </>}

    {data.length > 0 && <details className="advanced-trends standard-card v6-trend-advanced"><summary>查看進階趨勢</summary><div className="details-body chart-stack">
      <div className="advanced-summary"><p>累積最終赤字 <strong>{simple('deficit', model.cumulativeFinalizedDeficit)}</strong></p><p>最終日線性估算 <strong>{predictionText}</strong></p><p>已結算 <strong>{model.finalizedCount} 天</strong></p><small>{predictionNote}</small></div>

      <ChartCard title="能量與赤字" note="攝取為已記錄值；總消耗只顯示已結算日期，赤字請見資料表。" ariaLabel="攝取熱量長條與已結算總消耗折線" keys={[{ className: 'intake', label: '攝取' }, { className: 'tdee', label: '總消耗' }]}>
        <ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>{chartGrid}<ChartXAxis interval={xInterval} /><YAxis width={42} tick={{ fill: 'var(--muted)', fontSize: 12 }} /><Bar dataKey="intake" fill="#f0bf63" isAnimationActive={false} /><Line dataKey="tdee" stroke="var(--blue)" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} /></ComposedChart></ResponsiveContainer>
      </ChartCard>

      <ChartCard title="活動與運動" note="活動熱量與運動分鐘使用不同刻度，不互相加總。" ariaLabel="每日活動熱量與運動分鐘" keys={[{ className: 'active', label: '活動 kcal' }, { className: 'exercise', label: '運動分鐘' }]}>
        <ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>{chartGrid}<ChartXAxis interval={xInterval} /><YAxis yAxisId="kcal" width={42} tick={{ fill: 'var(--muted)', fontSize: 12 }} /><YAxis yAxisId="minutes" width={36} orientation="right" tick={{ fill: 'var(--muted)', fontSize: 12 }} /><Bar yAxisId="kcal" dataKey="active" fill="#65d38e" isAnimationActive={false} /><Line yAxisId="minutes" dataKey="exercise" stroke="var(--blue)" dot={false} connectNulls={false} isAnimationActive={false} /></BarChart></ResponsiveContainer>
      </ChartCard>

      <ChartCard title="睡眠" note="只顯示已記錄的睡眠小時。" ariaLabel="每日睡眠小時折線" keys={[{ className: 'sleep', label: '睡眠小時' }]}>
        <ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>{chartGrid}<ChartXAxis interval={xInterval} /><YAxis width={38} tick={{ fill: 'var(--muted)', fontSize: 12 }} /><Line dataKey="sleep" stroke="var(--blue)" strokeWidth={2} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} /></ComposedChart></ResponsiveContainer>
      </ChartCard>

      <ChartCard title="身體感受" note="疲勞、飢餓與下肢／足底皆使用 0–5 刻度。" ariaLabel="疲勞、飢餓與下肢足底狀態折線" keys={[{ className: 'fatigue', label: '疲勞' }, { className: 'hunger', label: '飢餓' }, { className: 'leg', label: '下肢／足底' }]}>
        <ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>{chartGrid}<ChartXAxis interval={xInterval} /><YAxis width={30} domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tick={{ fill: 'var(--muted)', fontSize: 12 }} /><Line dataKey="fatigue" stroke="#ef6d74" strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false} /><Line dataKey="hunger" stroke="#f0bf63" strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false} /><Line dataKey="leg" stroke="#d594f5" strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false} /></ComposedChart></ResponsiveContainer>
      </ChartCard>

      <DataTable data={data} source={model.trendSource} />
    </div></details>}
  </section>
}
