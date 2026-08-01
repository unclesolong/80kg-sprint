import { Copy, Plus, Trash2 } from 'lucide-react'
import { mealLabels, mealKeys, type MealKey } from '../mealOperations'
import type { MealLine } from '../types'

const totals = (lines: MealLine[]) => lines.reduce((sum, line) => ({
  kcal: sum.kcal + line.amount * line.kcalPerUnit,
  protein: sum.protein + line.amount * line.proteinPerUnit
}), { kcal: 0, protein: 0 })

export function MealCard({ meal, lines, open, onToggle, onAdd, onAmount, onMove, onDuplicate, onDelete }: {
  meal: MealKey
  lines: MealLine[]
  open: boolean
  onToggle: () => void
  onAdd: () => void
  onAmount: (key: string, amount: number) => void
  onMove: (key: string, meal: MealKey) => void
  onDuplicate: (key: string) => void
  onDelete: (key: string) => void
}) {
  const visible = lines.filter((line) => line.amount > 0)
  const total = totals(visible)
  return <article className={`meal-card ${open ? 'open' : ''}`}>
    <header className="meal-card-header">
      <button type="button" className="meal-card-summary" aria-expanded={open} onClick={onToggle}>
        <span><strong>{mealLabels[meal]}</strong><small>{visible.length ? `${visible.length} 項` : '尚未記錄'}</small></span>
        <b>{Math.round(total.kcal)} kcal <i>·</i> P {Math.round(total.protein)} g</b>
      </button>
      <button type="button" className="meal-add-button" onClick={onAdd}><Plus />新增食物</button>
    </header>
    {open && <div className="meal-card-body">
      {visible.length === 0 ? <div className="meal-empty"><p>這一餐還沒有食物。</p><button type="button" onClick={onAdd}><Plus />新增第一項</button></div> : visible.map((line) => <div className="meal-item" key={line.key}>
        <div className="meal-item-main"><strong>{line.label}</strong><span>{Math.round(line.amount * line.kcalPerUnit)} kcal · P {(line.amount * line.proteinPerUnit).toFixed(1)} g</span></div>
        <div className="meal-item-controls">
          <label><span>份量</span><span className="meal-amount"><input aria-label={`${line.label}份量`} type="number" min="0" step={line.unit === '份' || line.unit === '顆' ? 1 : 5} value={line.amount} onChange={(event) => onAmount(line.key, Number(event.target.value))} /><i>{line.portionLabel ?? line.unit}</i></span></label>
          <label><span>移到</span><select aria-label={`${line.label}移動餐次`} value={meal} onChange={(event) => onMove(line.key, event.target.value as MealKey)}>{mealKeys.map((key) => <option value={key} key={key}>{mealLabels[key]}</option>)}</select></label>
          <div className="meal-item-actions"><button type="button" aria-label={`複製${line.label}`} onClick={() => onDuplicate(line.key)}><Copy />複製</button><button type="button" className="danger-text" aria-label={`刪除${line.label}`} onClick={() => onDelete(line.key)}><Trash2 />刪除</button></div>
        </div>
      </div>)}
    </div>}
  </article>
}
