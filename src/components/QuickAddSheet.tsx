import { Activity, Droplets, Scale, Utensils, X } from 'lucide-react'
import type { MealKey } from '../mealOperations'
import type { RecordStage } from '../types'

export function QuickAddSheet({ onClose, onStage, onMeal }: { onClose: () => void; onStage: (stage: RecordStage) => void; onMeal: (meal: MealKey) => void }) {
  const meal = (value: MealKey) => { onMeal(value); onClose() }
  const stage = (value: RecordStage) => { onStage(value); onClose() }
  return <div className="quick-add-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="quick-add-sheet" role="dialog" aria-modal="true" aria-label="快速新增"><header><div><span>快速新增</span><h2>今天要更新什麼？</h2></div><button aria-label="關閉快速新增" onClick={onClose}><X /></button></header><div className="quick-add-grid">{([['breakfast', '早餐'], ['lunch', '午餐'], ['dinner', '晚餐'], ['evening', '點心']] as const).map(([key, label]) => <button onClick={() => meal(key)} key={key}><Utensils /><strong>新增{label}</strong></button>)}<button onClick={() => stage('food')}><Droplets /><strong>更新飲水</strong></button><button onClick={() => stage('evening')}><Activity /><strong>更新活動</strong></button><button onClick={() => stage('morning')}><Scale /><strong>更新晨重</strong></button></div></section></div>
}
