import { useEffect, useRef, useState } from 'react'
import { Copy, MoreHorizontal, Trash2, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { mealKeys, mealLabels, type MealKey } from '../mealOperations'
import type { MealLine } from '../types'

export function MealItemActionSheet({ line, meal, onClose, onMove, onDuplicate, onDelete }: {
  line: MealLine
  meal: MealKey
  onClose: () => void
  onMove: (target: MealKey) => void | Promise<void>
  onDuplicate: () => void | Promise<void>
  onDelete: () => void | Promise<void>
}) {
  const [targetMeal, setTargetMeal] = useState<MealKey>(mealKeys.find((key) => key !== meal) ?? meal)
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const dialogRef = useRef<HTMLElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const closeRef = useRef(onClose)
  const busyRef = useRef(false)
  useEffect(() => { closeRef.current = onClose }, [onClose])
  useEffect(() => { busyRef.current = busy }, [busy])

  useEffect(() => {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const shell = document.querySelector<HTMLElement>('.app-shell')
    const shellWasInert = shell?.hasAttribute('inert') ?? false
    const previousAriaHidden = shell?.getAttribute('aria-hidden')
    const bodyOverflow = document.body.style.overflow
    const rootOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    shell?.setAttribute('inert', '')
    shell?.setAttribute('aria-hidden', 'true')
    requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>('button, select')?.focus({ preventScroll: true }))
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); if (!busyRef.current) closeRef.current(); return }
      if (event.key !== 'Tab') return
      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable.at(-1)!
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', keydown)
    return () => {
      window.removeEventListener('keydown', keydown)
      document.body.style.overflow = bodyOverflow
      document.documentElement.style.overflow = rootOverflow
      if (!shellWasInert) shell?.removeAttribute('inert')
      if (previousAriaHidden == null) shell?.removeAttribute('aria-hidden')
      else shell?.setAttribute('aria-hidden', previousAriaHidden)
      requestAnimationFrame(() => {
        const trigger = triggerRef.current
        if (trigger?.isConnected) trigger.focus({ preventScroll: true })
        else document.querySelector<HTMLElement>('.meal-card.open .meal-card-summary, .meal-card-summary, .stage-tabs button[aria-current="step"]')?.focus({ preventScroll: true })
      })
    }
  }, [])

  const run = async (action: () => void | Promise<void>) => {
    busyRef.current = true
    setBusy(true)
    setErrorMessage('')
    try { await action(); closeRef.current() }
    catch { setErrorMessage('儲存失敗；餐點沒有變更，請稍後再試。') }
    finally { busyRef.current = false; setBusy(false) }
  }

  return createPortal(<div className="v6-sheet-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) closeRef.current() }}>
    <section ref={dialogRef} className="v6-action-sheet v6-floating-sheet" role="dialog" aria-modal="true" aria-labelledby="meal-action-title" aria-busy={busy}>
      <header><div><MoreHorizontal aria-hidden="true" /><h2 id="meal-action-title">{line.label}</h2></div><button type="button" className="v6-icon-button" aria-label="關閉餐點操作" disabled={busy} onClick={() => closeRef.current()}><X /></button></header>
      <div className="v6-action-sheet-body">
        <div className="v6-action-sheet-amount"><span>份量</span><strong>{line.amount} <small>{line.portionLabel ?? line.unit}</small></strong></div>
        <div className="v6-action-sheet-move"><label htmlFor="meal-action-target">移到其他餐次</label><div><select id="meal-action-target" value={targetMeal} onChange={(event) => setTargetMeal(event.target.value as MealKey)}>{mealKeys.filter((key) => key !== meal).map((key) => <option value={key} key={key}>{mealLabels[key]}</option>)}</select><button type="button" disabled={busy || targetMeal === meal} onClick={() => void run(() => onMove(targetMeal))}>移動</button></div></div>
        <button type="button" className="v6-action-row" disabled={busy} onClick={() => void run(onDuplicate)}><Copy aria-hidden="true" /><span>複製一份</span></button>
        <button type="button" className="v6-action-row danger" disabled={busy} onClick={() => void run(onDelete)}><Trash2 aria-hidden="true" /><span>刪除</span></button>
        {errorMessage && <p className="v6-sheet-error" role="alert">{errorMessage}</p>}
        <button type="button" className="v6-action-cancel" disabled={busy} onClick={() => closeRef.current()}>取消</button>
      </div>
    </section>
  </div>, document.body)
}
