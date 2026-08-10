import type { TrendRange } from '../viewModels/trendDashboard'

const options: ReadonlyArray<{ value: TrendRange; label: string }> = [
  { value: '7d', label: '7 日' },
  { value: '14d', label: '14 日' },
  { value: 'all', label: '全部' }
]

export function TrendRangeControl({ value, onChange }: {
  value: TrendRange
  onChange: (value: TrendRange) => void
}) {
  return <div className="v6-trend-range-control" role="group" aria-label="趨勢日期範圍">
    {options.map((option) => <button
      type="button"
      key={option.value}
      className={value === option.value ? 'active' : ''}
      aria-pressed={value === option.value}
      onClick={() => onChange(option.value)}
    >{option.label}</button>)}
  </div>
}
