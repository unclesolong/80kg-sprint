import { useEffect, useRef, useState } from 'react'
import { createFoodTemplateChange, type FoodUndoPatch } from '../foodTemplates'
import { ensureMealDetails, findFoodTemplate, mealKeys, mealLabels, moveMealLine, nutritionPatch, type MealKey } from '../mealOperations'
import type { DailyLog, FoodTemplate } from '../types'

export function FoodQuickActions({ log, templates, onChange, quickOnly = false, onOpenFood }: {
  log: DailyLog
  templates: FoodTemplate[]
  onChange: (patch: Partial<DailyLog>) => void
  quickOnly?: boolean
  onOpenFood?: () => void
}) {
  const [toast, setToast] = useState<{ name: string; kcal: number; proteinG: number; undo: FoodUndoPatch; meal: MealKey; key: string; choosingMeal?: boolean }>()
  const [duplicate, setDuplicate] = useState<FoodTemplate>()
  const timer = useRef<number | undefined>(undefined)
  const visible = quickOnly ? templates.filter((template) => template.quick) : templates

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])

  const add = (template: FoodTemplate, allowDuplicate = false) => {
    const current = ensureMealDetails(log)
    if (!allowDuplicate && findFoodTemplate(current, template.meal, template.id)) { setDuplicate(template); return }
    const change = createFoodTemplateChange(log, template)
    onChange(change.patch)
    setDuplicate(undefined)
    setToast({ name: template.name, kcal: template.kcal, proteinG: template.proteinG, undo: change.undoPatch, meal: change.meal, key: change.addedKey })
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToast(undefined), 5000)
  }

  const undo = () => {
    if (!toast) return
    onChange(toast.undo)
    if (timer.current) window.clearTimeout(timer.current)
    setToast(undefined)
  }

  const changeMeal = (target: MealKey) => {
    if (!toast || target === toast.meal) return setToast(toast ? { ...toast, choosingMeal: false } : undefined)
    const next = moveMealLine(ensureMealDetails(log), toast.meal, target, toast.key)
    onChange(nutritionPatch(next))
    setToast({ ...toast, meal: target, choosingMeal: false })
  }

  return <>
    <div className="food-shortcuts" aria-label="食物快捷模板">
      {visible.map((template) => <button type="button" key={template.id} onClick={() => add(template)}>
        <strong>{template.name}</strong><small>約 {Math.round(template.kcal)} kcal · P {Math.round(template.proteinG)}g</small>
      </button>)}
    </div>
    {duplicate && <div className="duplicate-template-prompt quick-duplicate" role="alertdialog"><strong>這個套餐已經加入{mealLabels[duplicate.meal]}，要再加一份嗎？</strong><div><button type="button" onClick={() => setDuplicate(undefined)}>取消</button>{onOpenFood && <button type="button" onClick={() => { setDuplicate(undefined); onOpenFood() }}>編輯原有份量</button>}<button type="button" className="primary" onClick={() => add(duplicate, true)}>再加一份</button></div></div>}
    {toast && <div className="undo-toast food-quick-toast" role="status"><span>已加入{mealLabels[toast.meal]}：{toast.name}<small>＋{Math.round(toast.kcal)} kcal · 蛋白質＋{Math.round(toast.proteinG)} g</small>{toast.choosingMeal && <span className="toast-meal-options">{mealKeys.filter((meal) => meal !== toast.meal).map((meal) => <button type="button" key={meal} onClick={() => changeMeal(meal)}>{mealLabels[meal]}</button>)}</span>}</span><div><button type="button" onClick={() => setToast({ ...toast, choosingMeal: !toast.choosingMeal })}>更改餐次</button><button type="button" onClick={undo}>復原</button></div></div>}
  </>
}
