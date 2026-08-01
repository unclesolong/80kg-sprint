import { useEffect, useRef, useState } from 'react'
import { createFoodTemplateChange, type FoodUndoPatch } from '../foodTemplates'
import type { DailyLog, FoodTemplate } from '../types'

export function FoodQuickActions({ log, templates, onChange, quickOnly = false }: {
  log: DailyLog
  templates: FoodTemplate[]
  onChange: (patch: Partial<DailyLog>) => void
  quickOnly?: boolean
}) {
  const [toast, setToast] = useState<{ name: string; undo: FoodUndoPatch }>()
  const timer = useRef<number | undefined>(undefined)
  const visible = quickOnly ? templates.filter((template) => template.quick) : templates

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])

  const add = (template: FoodTemplate) => {
    const change = createFoodTemplateChange(log, template)
    onChange(change.patch)
    setToast({ name: template.name, undo: change.undoPatch })
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToast(undefined), 5000)
  }

  const undo = () => {
    if (!toast) return
    onChange(toast.undo)
    if (timer.current) window.clearTimeout(timer.current)
    setToast(undefined)
  }

  return <>
    <div className="food-shortcuts" aria-label="食物快捷模板">
      {visible.map((template) => <button type="button" key={template.id} onClick={() => add(template)}>
        <strong>{template.name}</strong><small>約 {Math.round(template.kcal)} kcal · P {Math.round(template.proteinG)}g</small>
      </button>)}
    </div>
    {toast && <div className="undo-toast" role="status"><span>已加入{toast.name}</span><button type="button" onClick={undo}>復原</button></div>}
  </>
}
