import { useEffect, useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import {
  addFoodTemplate, addMealLine, commonIngredients, customFoodMealLine, findFoodTemplate,
  ingredientMealLine, manualMealLine, mealKeys, mealLabels, type MealKey
} from '../mealOperations'
import type { CustomFood, FoodTemplate, MealDetails } from '../types'

type SheetTab = 'common' | 'templates' | 'mine' | 'manual'
type Selection =
  | { kind: 'common'; id: string; amount: number }
  | { kind: 'template'; id: string }
  | { kind: 'mine'; id: string; amount: number }

const tabLabels: Record<SheetTab, string> = { common: '常用食材', templates: '快捷套餐', mine: '我的食物', manual: '手動新增' }
const blankManual = () => ({ name: '', kcal: '', proteinG: '0', carbsG: '', fatG: '', fiberG: '', sodiumMg: '', portionLabel: '份' })

export function FoodAddSheet({ open, defaultMeal, initialTab = 'common', initialTemplateId, details, templates, foods, onApply, onEditExisting, onClose }: {
  open: boolean
  defaultMeal: MealKey
  initialTab?: SheetTab
  initialTemplateId?: string
  details: MealDetails
  templates: FoodTemplate[]
  foods: CustomFood[]
  onApply: (details: MealDetails, meal: MealKey, message: string) => void
  onEditExisting: (meal: MealKey) => void
  onClose: () => void
}) {
  const ingredients = useMemo(commonIngredients, [])
  const [tab, setTab] = useState<SheetTab>(initialTab)
  const [meal, setMeal] = useState<MealKey>(defaultMeal)
  const [selection, setSelection] = useState<Selection>()
  const [manual, setManual] = useState(blankManual)
  const [duplicate, setDuplicate] = useState<FoodTemplate>()

  useEffect(() => {
    if (!open) return
    setTab(initialTab)
    setMeal(defaultMeal)
    setManual(blankManual())
    setDuplicate(undefined)
    if (initialTemplateId) {
      const template = templates.find((item) => item.id === initialTemplateId)
      if (template) { setSelection({ kind: 'template', id: template.id }); setMeal(template.meal) }
    } else setSelection(undefined)
  }, [open, defaultMeal, initialTab, initialTemplateId, templates])

  if (!open) return null
  const selectedIngredient = selection?.kind === 'common' ? ingredients.find((item) => item.id === selection.id) : undefined
  const selectedTemplate = selection?.kind === 'template' ? templates.find((item) => item.id === selection.id) : undefined
  const selectedFood = selection?.kind === 'mine' ? foods.find((item) => item.id === selection.id) : undefined
  const selectedIngredientAmount = selection?.kind === 'common' ? selection.amount : 0
  const selectedFoodAmount = selection?.kind === 'mine' ? selection.amount : 0

  const finish = (next: MealDetails, target: MealKey, name: string) => {
    onApply(next, target, `已加入${mealLabels[target]}：${name}`)
    onClose()
  }
  const addTemplate = (template: FoodTemplate, allowDuplicate = false) => {
    if (!allowDuplicate && findFoodTemplate(details, meal, template.id)) { setDuplicate(template); return }
    const result = addFoodTemplate(details, template, meal)
    finish(result.details, meal, template.name)
  }
  const submitManual = () => {
    if (!manual.name.trim() || manual.kcal === '') return
    const line = manualMealLine({
      name: manual.name,
      kcal: Number(manual.kcal), proteinG: Number(manual.proteinG || 0),
      carbsG: manual.carbsG === '' ? undefined : Number(manual.carbsG),
      fatG: manual.fatG === '' ? undefined : Number(manual.fatG),
      fiberG: manual.fiberG === '' ? undefined : Number(manual.fiberG),
      sodiumMg: manual.sodiumMg === '' ? undefined : Number(manual.sodiumMg),
      portionLabel: manual.portionLabel
    })
    finish(addMealLine(details, meal, line), meal, line.label)
  }

  return <div className="food-sheet-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="food-sheet" role="dialog" aria-modal="true" aria-labelledby="food-sheet-title">
      <header><div><span>加入 {mealLabels[defaultMeal]}</span><h2 id="food-sheet-title">新增食物</h2></div><button type="button" className="icon-button" aria-label="關閉新增食物" onClick={onClose}><X /></button></header>
      <nav className="food-sheet-tabs" aria-label="新增食物方式">{(Object.keys(tabLabels) as SheetTab[]).map((key) => <button type="button" className={tab === key ? 'active' : ''} key={key} onClick={() => { setTab(key); setSelection(undefined); setDuplicate(undefined) }}>{tabLabels[key]}</button>)}</nav>
      <div className="food-sheet-content">
        {tab === 'common' && <div className="food-picker-grid">{ingredients.map((item) => <button type="button" className={selectedIngredient?.id === item.id ? 'selected' : ''} key={item.id} onClick={() => setSelection({ kind: 'common', id: item.id, amount: item.defaultAmount })}><strong>{item.line.label}</strong><small>建議 {item.defaultAmount} {item.line.unit}</small></button>)}</div>}
        {tab === 'templates' && <div className="food-picker-list">{templates.map((template) => <button type="button" className={selectedTemplate?.id === template.id ? 'selected' : ''} key={template.id} onClick={() => { setSelection({ kind: 'template', id: template.id }); setMeal(template.meal); setDuplicate(undefined) }}><span><strong>{template.name}</strong><small>{template.description}</small></span><b>{Math.round(template.kcal)} kcal<br />P {Math.round(template.proteinG)} g</b></button>)}</div>}
        {tab === 'mine' && <div className="food-picker-list">{foods.length === 0 ? <p className="empty">尚未建立我的食物，可到頁面底部建立。</p> : foods.map((food) => <button type="button" className={selectedFood?.id === food.id ? 'selected' : ''} key={food.id} onClick={() => setSelection({ kind: 'mine', id: food.id, amount: food.defaultAmount })}><span><strong>{food.name}</strong><small>{food.basis === '100g' ? '每 100g' : '每份'}</small></span><b>{Math.round(food.kcal)} kcal<br />P {Math.round(food.proteinG)} g</b></button>)}</div>}
        {tab === 'manual' && <div className="manual-food-form">
          <label className="wide">食物／餐點名稱 *<input autoFocus placeholder="例如：公司午餐" value={manual.name} onChange={(event) => setManual({ ...manual, name: event.target.value })} /></label>
          <label>熱量 kcal *<input type="number" min="0" inputMode="decimal" value={manual.kcal} onChange={(event) => setManual({ ...manual, kcal: event.target.value })} /></label>
          <label>蛋白質 g<input type="number" min="0" inputMode="decimal" value={manual.proteinG} onChange={(event) => setManual({ ...manual, proteinG: event.target.value })} /></label>
          {([['carbsG', '碳水 g'], ['fatG', '脂肪 g'], ['fiberG', '纖維 g'], ['sodiumMg', '鈉 mg']] as const).map(([key, label]) => <label key={key}>{label}（選填）<input type="number" min="0" inputMode="decimal" value={manual[key]} onChange={(event) => setManual({ ...manual, [key]: event.target.value })} /></label>)}
          <label className="wide">份量名稱<input placeholder="1份" value={manual.portionLabel} onChange={(event) => setManual({ ...manual, portionLabel: event.target.value })} /></label>
        </div>}
      </div>

      {duplicate ? <div className="duplicate-template-prompt" role="alertdialog"><strong>這個套餐已經加入{mealLabels[meal]}，要再加一份嗎？</strong><div><button type="button" onClick={() => setDuplicate(undefined)}>取消</button><button type="button" onClick={() => { setDuplicate(undefined); onEditExisting(meal); onClose() }}>編輯原有份量</button><button type="button" className="primary" onClick={() => addTemplate(duplicate, true)}>再加一份</button></div></div> : <footer>
        <label>加入餐次<select value={meal} onChange={(event) => setMeal(event.target.value as MealKey)}>{mealKeys.map((key) => <option value={key} key={key}>{mealLabels[key]}</option>)}</select></label>
        {selectedIngredient && <label>份量<span className="sheet-amount"><input type="number" min="0" inputMode="decimal" value={selectedIngredientAmount} onChange={(event) => setSelection({ kind: 'common', id: selectedIngredient.id, amount: Number(event.target.value) })} /><i>{selectedIngredient.line.unit}</i></span></label>}
        {selectedFood && <label>份量<span className="sheet-amount"><input type="number" min="0" inputMode="decimal" value={selectedFoodAmount} onChange={(event) => setSelection({ kind: 'mine', id: selectedFood.id, amount: Number(event.target.value) })} /><i>{selectedFood.basis === '100g' ? 'g' : '份'}</i></span></label>}
        <button type="button" className="primary sheet-submit" disabled={tab === 'common' ? !selectedIngredient : tab === 'templates' ? !selectedTemplate : tab === 'mine' ? !selectedFood : !manual.name.trim() || manual.kcal === ''} onClick={() => {
          if (selectedIngredient && selection?.kind === 'common') finish(addMealLine(details, meal, ingredientMealLine(selectedIngredient, selection.amount)), meal, selectedIngredient.line.label)
          else if (selectedTemplate) addTemplate(selectedTemplate)
          else if (selectedFood && selection?.kind === 'mine') finish(addMealLine(details, meal, customFoodMealLine(selectedFood, selection.amount)), meal, selectedFood.name)
          else if (tab === 'manual') submitManual()
        }}><Plus />加入{mealLabels[meal]}</button>
      </footer>}
    </section>
  </div>
}
