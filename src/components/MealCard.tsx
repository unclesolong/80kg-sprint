import { useEffect, useState } from 'react'
import { MoreHorizontal, Plus } from 'lucide-react'
import { mealLabels, type MealKey } from '../mealOperations'
import type { MealLine } from '../types'

const totals = (lines: MealLine[]) => lines.reduce((sum, line) => ({
  kcal: sum.kcal + line.amount * line.kcalPerUnit,
  protein: sum.protein + line.amount * line.proteinPerUnit
}), { kcal: 0, protein: 0 })

function MealAmountInput({ line, onCommit }: { line: MealLine; onCommit: (amount: number) => void }) {
  const [draft, setDraft] = useState(String(line.amount))
  useEffect(() => setDraft(String(line.amount)), [line.amount])

  const commit = () => {
    const next = Number(draft)
    // Clearing a number field while typing must not silently delete the row.
    // Explicit deletion remains in the item action sheet and keeps its Undo.
    if (!draft.trim() || !Number.isFinite(next) || next <= 0) {
      setDraft(String(line.amount))
      return
    }
    setDraft(String(next))
    if (next !== line.amount) onCommit(next)
  }

  return <input
    aria-label={`${line.label}份量`}
    type="number"
    min={line.unit === '份' || line.unit === '顆' ? 1 : 0.1}
    step={line.unit === '份' || line.unit === '顆' ? 1 : 5}
    inputMode="decimal"
    value={draft}
    onChange={(event) => setDraft(event.target.value)}
    onBlur={commit}
    onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
  />
}

export function MealCard({ meal, lines, open, onToggle, onAdd, onAmount, onMore }: {
  meal: MealKey
  lines: MealLine[]
  open: boolean
  onToggle: () => void
  onAdd: () => void
  onAmount: (key: string, amount: number) => void
  onMore: (line: MealLine) => void
}) {
  const visible = lines.filter((line) => line.amount > 0)
  const total = totals(visible)
  return <article className={`meal-card ${open ? 'open' : ''}`}>
    <header className="meal-card-header">
      <button type="button" className="meal-card-summary" aria-expanded={open} onClick={onToggle}>
        <span><strong>{mealLabels[meal]}</strong><small>{visible.length ? `${visible.length} 項` : '尚未記錄'}</small></span>
        <b>{Math.round(total.kcal)} kcal <i>·</i> P {Math.round(total.protein)} g</b>
      </button>
      <button type="button" className="meal-add-button" onClick={onAdd}><Plus />新增</button>
    </header>
    {open && <div className="meal-card-body">
      {visible.length === 0 ? <div className="meal-empty"><p>這一餐還沒有食物。</p><button type="button" onClick={onAdd}><Plus />新增第一項</button></div> : visible.map((line) => <div className="meal-item" key={line.key}>
        <div className="meal-item-main"><span><strong>{line.label}</strong><small>{Math.round(line.amount * line.kcalPerUnit)} kcal · P {(line.amount * line.proteinPerUnit).toFixed(1)} g</small></span><button type="button" className="meal-item-more" aria-label={`更多${line.label}操作`} onClick={() => onMore(line)}><MoreHorizontal /></button></div>
        <div className="meal-item-controls">
          <label><span>份量</span><span className="meal-amount"><MealAmountInput line={line} onCommit={(amount) => onAmount(line.key, amount)} /><i>{line.portionLabel ?? line.unit}</i></span></label>
        </div>
      </div>)}
    </div>}
  </article>
}
