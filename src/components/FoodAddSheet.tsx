import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Search, Trash2, X } from 'lucide-react'
import { localDateString, mealTotals, parseLocalDate } from '../calculations'
import { makeFoodMetadata } from '../foodData/confirmedCache'
import type { FoodCandidate } from '../foodData/types'
import {
  commitDraftEntriesWithMetadata, commonIngredients, customFoodMealLine, ingredientMealLine, manualMealLine,
  mealKeys, mealLabels, mergeDraftFoodEntry, recentFoodItems, templateMealLine,
  type DraftFoodEntry, type MealKey
} from '../mealOperations'
import type { CustomFood, DailyLog, FoodTemplate, MealDetails, MealLine } from '../types'
import type { FoodMetadata } from '../planner/types'
import { FoodAIFlow } from './FoodAIFlow'

type SheetTab = 'recent' | 'common' | 'templates' | 'mine' | 'ai' | 'manual'
const tabLabels: Record<SheetTab, string> = { recent: '最近', common: '常用', templates: '套餐', mine: '我的', ai: 'AI 解析', manual: '手動' }
const blankManual = () => ({ name: '', kcal: '', proteinG: '0', carbsG: '', fatG: '', fiberG: '', sodiumMg: '', portionLabel: '份' })

const cloneForDraft = (line: MealLine, prefix: string): MealLine => ({ ...line, key: `${prefix}-${crypto.randomUUID()}` })

export function FoodAddSheet({ open, date, logs, defaultMeal, initialTab = 'recent', initialTemplateId, initialFoodId, details, templates, foods, online, aiEnabled, metadata, onEnableAI, onAIRun, onCommitMetadata, onApply, onClose }: {
  open: boolean
  date: string
  logs: DailyLog[]
  defaultMeal: MealKey
  initialTab?: SheetTab
  initialTemplateId?: string
  initialFoodId?: string
  details: MealDetails
  templates: FoodTemplate[]
  foods: CustomFood[]
  online: boolean
  aiEnabled: boolean
  metadata: FoodMetadata[]
  onEnableAI: () => Promise<void>
  onAIRun: (status: 'success' | 'fallback' | 'error', errorCode?: string) => void
  onCommitMetadata: (metadata: FoodMetadata) => Promise<void>
  onApply: (details: MealDetails, meal: MealKey, message: string) => void | Promise<void>
  onClose: () => void
}) {
  const ingredients = useMemo(commonIngredients, [])
  const recent = useMemo(() => recentFoodItems(logs, date), [logs, date])
  const [tab, setTab] = useState<SheetTab>(initialTab)
  const [meal, setMeal] = useState<MealKey>(defaultMeal)
  const [draftEntries, setDraftEntries] = useState<DraftFoodEntry[]>([])
  const [pendingMetadata, setPendingMetadata] = useState<Record<string, FoodMetadata>>({})
  const [manual, setManual] = useState(blankManual)
  const [query, setQuery] = useState('')
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const wasOpen = useRef(false)
  const scrollY = useRef(0)
  const trigger = useRef<HTMLElement | null>(null)
  const draftEntriesRef = useRef<DraftFoodEntry[]>([])
  const historyGuard = useRef(false)
  const onCloseRef = useRef(onClose)
  const sheetRef = useRef<HTMLElement>(null)

  useEffect(() => { draftEntriesRef.current = draftEntries }, [draftEntries])
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    if (open && !wasOpen.current) {
      setTab(initialTab)
      setMeal(defaultMeal)
      setManual(blankManual())
      setQuery('')
      setConfirmDiscard(false)
      setSaveError('')
      setPendingMetadata({})
      const initialTemplate = initialTemplateId ? templates.find((item) => item.id === initialTemplateId) : undefined
      const initialFood = initialFoodId ? foods.find((item) => item.id === initialFoodId) : undefined
      setDraftEntries(initialTemplate ? [{ draftId: crypto.randomUUID(), meal: defaultMeal, line: templateMealLine(initialTemplate), source: 'template' }]
        : initialFood ? [{ draftId: crypto.randomUUID(), meal: defaultMeal, line: customFoodMealLine(initialFood), source: 'mine' }]
          : [])
    }
    wasOpen.current = open
  }, [open, defaultMeal, initialTab, initialTemplateId, initialFoodId, templates, foods])

  useEffect(() => {
    if (!open) return
    scrollY.current = window.scrollY
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const body = document.body
    const appShell = document.querySelector<HTMLElement>('.app-shell')
    const shellWasInert = appShell?.hasAttribute('inert') ?? false
    const previousAriaHidden = appShell?.getAttribute('aria-hidden')
    const previous = { position: body.style.position, top: body.style.top, left: body.style.left, right: body.style.right, width: body.style.width, overflow: body.style.overflow }
    body.style.position = 'fixed'
    body.style.top = `-${scrollY.current}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'
    body.style.overflow = 'hidden'
    appShell?.setAttribute('inert', '')
    appShell?.setAttribute('aria-hidden', 'true')
    window.requestAnimationFrame(() => sheetRef.current?.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])')?.focus({ preventScroll: true }))
    return () => {
      Object.assign(body.style, previous)
      if (!shellWasInert) appShell?.removeAttribute('inert')
      if (previousAriaHidden == null) appShell?.removeAttribute('aria-hidden')
      else appShell?.setAttribute('aria-hidden', previousAriaHidden)
      window.scrollTo({ top: scrollY.current, behavior: 'auto' })
      window.requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }))
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const guardId = `food-sheet-${crypto.randomUUID()}`
    const pushGuard = () => {
      window.history.pushState({ ...window.history.state, foodSheetGuard: guardId }, '', window.location.href)
      historyGuard.current = true
    }
    const onPopState = () => {
      historyGuard.current = false
      if (draftEntriesRef.current.length) {
        setConfirmDiscard(true)
        pushGuard()
      } else onCloseRef.current()
    }
    pushGuard()
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
      if (historyGuard.current) {
        historyGuard.current = false
        window.history.back()
      }
    }
  }, [open])

  const requestClose = () => {
    if (draftEntries.length) setConfirmDiscard(true)
    else onClose()
  }

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); requestClose(); return }
      if (event.key !== 'Tab') return
      const focusable = [...(sheetRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') ?? [])]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable.at(-1)!
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const addDraft = (line: MealLine, source: DraftFoodEntry['source'], targetMeal = meal) => {
    setDraftEntries((entries) => mergeDraftFoodEntry(entries, {
      draftId: crypto.randomUUID(), meal: targetMeal, line, source
    }))
    setConfirmDiscard(false)
    setSaveError('')
  }

  const addProviderDraft = (line: MealLine, candidate: FoodCandidate) => {
    const draftId = crypto.randomUUID()
    setDraftEntries((entries) => [...entries, { draftId, meal, line, source: 'provider' }])
    setPendingMetadata((items) => ({ ...items, [draftId]: makeFoodMetadata(candidate, { mealLineKey: line.key }) }))
    setConfirmDiscard(false)
    setSaveError('')
  }

  const submitManual = () => {
    if (!manual.name.trim() || manual.kcal === '') return
    addDraft(manualMealLine({
      name: manual.name,
      kcal: Number(manual.kcal), proteinG: Number(manual.proteinG || 0),
      carbsG: manual.carbsG === '' ? undefined : Number(manual.carbsG),
      fatG: manual.fatG === '' ? undefined : Number(manual.fatG),
      fiberG: manual.fiberG === '' ? undefined : Number(manual.fiberG),
      sodiumMg: manual.sodiumMg === '' ? undefined : Number(manual.sodiumMg),
      portionLabel: manual.portionLabel
    }), 'manual')
    setManual(blankManual())
  }

  const draftDetails = useMemo(() => ({
    breakfast: draftEntries.filter((entry) => entry.meal === 'breakfast').map((entry) => entry.line),
    lunch: draftEntries.filter((entry) => entry.meal === 'lunch').map((entry) => entry.line),
    dinner: draftEntries.filter((entry) => entry.meal === 'dinner').map((entry) => entry.line),
    evening: draftEntries.filter((entry) => entry.meal === 'evening').map((entry) => entry.line),
    ramen: { ...details.ramen, enabled: false }
  }), [draftEntries, details.ramen])
  const draftTotals = mealTotals(draftDetails)
  const normalizedQuery = query.trim().toLocaleLowerCase('zh-TW')
  const matches = (value: string) => value.toLocaleLowerCase('zh-TW').includes(normalizedQuery)
  const searchResults = normalizedQuery ? [
    ...recent.filter((item) => matches(item.line.label)).map((item) => ({ id: `recent-${item.id}`, label: item.line.label, note: `最近使用 · ${item.line.amount} ${item.line.portionLabel ?? item.line.unit}`, add: () => addDraft(cloneForDraft(item.line, 'recent'), 'manual') })),
    ...ingredients.filter((item) => matches(item.line.label)).map((item) => ({ id: `common-${item.id}`, label: item.line.label, note: `常用 · ${item.defaultAmount} ${item.line.unit}`, add: () => addDraft(ingredientMealLine(item, item.defaultAmount), 'common') })),
    ...templates.filter((item) => matches(`${item.name} ${item.description}`)).map((item) => ({ id: `template-${item.id}`, label: item.name, note: `套餐 · ${Math.round(item.kcal)} kcal`, add: () => addDraft(templateMealLine(item), 'template') })),
    ...foods.filter((item) => matches(item.name)).map((item) => ({ id: `mine-${item.id}`, label: item.name, note: `我的食物 · ${Math.round(item.kcal)} kcal`, add: () => addDraft(customFoodMealLine(item), 'mine') }))
  ] : []

  const saveDraft = async () => {
    if (!draftEntries.length || saving) return
    setSaving(true)
    setSaveError('')
    const meals = [...new Set(draftEntries.map((entry) => entry.meal))]
    const targetMeal = meals.length === 1 ? meals[0] : defaultMeal
    const prefix = meals.length === 1 ? `已加入${mealLabels[targetMeal]}：` : '已加入：'
    try {
      const metadataToSave = draftEntries.flatMap((entry) => pendingMetadata[entry.draftId] ?? [])
      await commitDraftEntriesWithMetadata(
        details,
        draftEntries,
        (next) => onApply(next, targetMeal, `${prefix}${draftEntries.length}項 · ${draftTotals.kcal} kcal`),
        metadataToSave.map((metadata) => () => onCommitMetadata(metadata))
      )
      setDraftEntries([])
      setPendingMetadata({})
      onClose()
    } catch {
      setSaveError('儲存失敗，草稿仍保留。請稍後再試。')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null
  const dateTitle = date < localDateString()
    ? `補記 ${new Intl.DateTimeFormat('zh-TW', { month: 'numeric', day: 'numeric' }).format(parseLocalDate(date))}${mealLabels[defaultMeal]}`
    : `加入 ${mealLabels[defaultMeal]}`

  const pickerButton = (id: string, label: string, note: string, action: () => void) => <button type="button" key={id} onClick={action}><span><strong>{label}</strong><small>{note}</small></span><Plus aria-hidden="true" /></button>

  return createPortal(<div className="food-sheet-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose() }}>
    <section ref={sheetRef} className="food-sheet" role="dialog" aria-modal="true" aria-labelledby="food-sheet-title">
      <header><div><span>{dateTitle}</span><h2 id="food-sheet-title">批次新增食物</h2></div><button type="button" className="icon-button" aria-label="關閉新增食物" onClick={requestClose}><X /></button></header>
      <div className="food-sheet-tools">
        <label className="food-search"><Search aria-hidden="true" /><input aria-label="搜尋食物" placeholder="搜尋常用、套餐、我的食物…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <label className="sheet-meal-select">加入餐次<select value={meal} onChange={(event) => setMeal(event.target.value as MealKey)}>{mealKeys.map((key) => <option value={key} key={key}>{mealLabels[key]}</option>)}</select></label>
      </div>
      {!normalizedQuery && <nav className="food-sheet-tabs" aria-label="新增食物方式">{(Object.keys(tabLabels) as SheetTab[]).map((key) => <button type="button" className={tab === key ? 'active' : ''} key={key} onClick={() => setTab(key)}>{tabLabels[key]}</button>)}</nav>}
      <div className="food-sheet-content">
        {normalizedQuery && <div className="food-picker-list search-results">{searchResults.length ? searchResults.map((item) => pickerButton(item.id, item.label, item.note, item.add)) : <p className="empty">找不到符合的食物。</p>}</div>}
        {!normalizedQuery && tab === 'recent' && <div className="food-picker-list">{recent.length ? recent.map((item) => pickerButton(item.id, item.line.label, `${item.line.amount} ${item.line.portionLabel ?? item.line.unit} · ${item.lastUsedDate.slice(5).replace('-', '/')}`, () => addDraft(cloneForDraft(item.line, 'recent'), 'manual'))) : <p className="empty">最近 14 天還沒有可重用的食物。</p>}</div>}
        {!normalizedQuery && tab === 'common' && <div className="food-picker-grid">{ingredients.map((item) => <button type="button" key={item.id} onClick={() => addDraft(ingredientMealLine(item, item.defaultAmount), 'common')}><span><strong>{item.line.label}</strong><small>建議 {item.defaultAmount} {item.line.unit}</small></span><Plus aria-hidden="true" /></button>)}</div>}
        {!normalizedQuery && tab === 'templates' && <div className="food-picker-list">{templates.map((template) => pickerButton(template.id, template.name, `${template.description} · ${Math.round(template.kcal)} kcal`, () => addDraft(templateMealLine(template), 'template')))}</div>}
        {!normalizedQuery && tab === 'mine' && <div className="food-picker-list">{foods.length ? foods.map((food) => pickerButton(food.id, food.name, `${food.basis === '100g' ? '每 100g' : '每份'} · ${Math.round(food.kcal)} kcal`, () => addDraft(customFoodMealLine(food), 'mine'))) : <p className="empty">尚未建立我的食物。</p>}</div>}
        {!normalizedQuery && tab === 'ai' && <FoodAIFlow online={online} aiEnabled={aiEnabled} metadata={metadata} onEnableAI={onEnableAI} onAIRun={onAIRun} onManual={() => setTab('manual')} onAdd={(line, candidate) => addProviderDraft(line, candidate)} />}
        {!normalizedQuery && tab === 'manual' && <div className="manual-food-form">
          <label className="wide">食物／餐點名稱 *<input autoFocus placeholder="例如：公司午餐" value={manual.name} onChange={(event) => setManual({ ...manual, name: event.target.value })} /></label>
          <label>熱量 kcal *<input type="number" min="0" inputMode="decimal" value={manual.kcal} onChange={(event) => setManual({ ...manual, kcal: event.target.value })} /></label>
          <label>蛋白質 g<input type="number" min="0" inputMode="decimal" value={manual.proteinG} onChange={(event) => setManual({ ...manual, proteinG: event.target.value })} /></label>
          {([['carbsG', '碳水 g'], ['fatG', '脂肪 g'], ['fiberG', '纖維 g'], ['sodiumMg', '鈉 mg']] as const).map(([key, label]) => <label key={key}>{label}（選填）<input type="number" min="0" inputMode="decimal" value={manual[key]} onChange={(event) => setManual({ ...manual, [key]: event.target.value })} /></label>)}
          <label className="wide">份量名稱<input placeholder="1份" value={manual.portionLabel} onChange={(event) => setManual({ ...manual, portionLabel: event.target.value })} /></label>
          <button type="button" className="primary manual-add-draft" disabled={!manual.name.trim() || manual.kcal === ''} onClick={submitManual}><Plus />加入本次草稿</button>
        </div>}
        {draftEntries.length > 0 && <section className="draft-entry-list" aria-label="本次新增草稿"><h3>本次草稿</h3>{draftEntries.map((entry) => <div key={entry.draftId}><span><strong>{entry.line.label}</strong><small>{mealLabels[entry.meal]}{entry.source === 'provider' ? ' · 已確認來源' : ''}</small></span><label><input aria-label={`${entry.line.label}草稿份量`} type="number" min="0" step={entry.line.unit === '份' || entry.line.unit === '顆' ? 1 : 5} value={entry.line.amount} onChange={(event) => setDraftEntries((items) => items.map((item) => item.draftId === entry.draftId ? { ...item, line: { ...item.line, amount: Math.max(0, Number(event.target.value)) } } : item))} /><i>{entry.line.portionLabel ?? entry.line.unit}</i></label><button type="button" aria-label={`移除${entry.line.label}`} onClick={() => { setDraftEntries((items) => items.filter((item) => item.draftId !== entry.draftId)); setPendingMetadata((items) => { const next = { ...items }; delete next[entry.draftId]; return next }) }}><Trash2 /></button></div>)}</section>}
      </div>

      {confirmDiscard && <div className="discard-draft-prompt" role="alertdialog" aria-live="assertive"><strong>尚有 {draftEntries.length} 項未儲存</strong><div><button type="button" onClick={() => setConfirmDiscard(false)}>繼續編輯</button><button type="button" className="danger-text" onClick={() => { setDraftEntries([]); setPendingMetadata({}); onClose() }}>捨棄本次輸入</button></div></div>}
      <footer className="draft-save-bar"><div><span>本次新增 {draftEntries.length} 項</span><strong>{draftTotals.kcal} kcal · 蛋白質 {draftTotals.protein.toFixed(1)} g</strong>{saveError && <small role="alert">{saveError}</small>}</div><div><button type="button" onClick={requestClose}>取消</button><button type="button" className="primary" disabled={!draftEntries.length || saving} onClick={() => void saveDraft()}>{saving ? '儲存中…' : `儲存 ${draftEntries.length} 項`}</button></div></footer>
    </section>
  </div>, document.body)
}
