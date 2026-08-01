interface NumberFieldProps {
  label: string
  value?: number
  onChange: (value: number | undefined) => void
  unit?: string
  step?: number
  min?: number
  max?: number
  quick?: number[]
}

export function NumberField({ label, value, onChange, unit, step = 1, min = 0, max, quick }: NumberFieldProps) {
  const change = (next: number) => onChange(Math.max(min, max == null ? next : Math.min(max, next)))
  return <div className="field-block">
    <label>{label}</label>
    <div className="number-control">
      <button type="button" aria-label={`${label}減少`} onClick={() => change((value ?? 0) - step)}>−</button>
      <div className="input-with-unit">
        <input
          inputMode="decimal"
          type="number"
          min={min}
          max={max}
          step={step}
          value={value ?? ''}
          placeholder="—"
          onChange={(event) => onChange(event.target.value === '' ? undefined : Number(event.target.value))}
        />
        {unit && <span>{unit}</span>}
      </div>
      <button type="button" aria-label={`${label}增加`} onClick={() => change((value ?? 0) + step)}>＋</button>
    </div>
    {quick && <div className="quick-row">{quick.map((amount) => <button type="button" className="chip" key={amount} onClick={() => change((value ?? 0) + amount)}>+{amount}</button>)}</div>}
  </div>
}
