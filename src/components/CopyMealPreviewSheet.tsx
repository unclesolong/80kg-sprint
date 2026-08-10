import { useEffect, useRef, useState } from 'react'
import { Copy, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import type { MealCopyMode } from '../mealOperations'

export interface MealCopyPreviewRow {
  label: string
  count: number
  kcal?: number
  proteinG?: number
}

const PreviewRows = ({ rows }: { rows: MealCopyPreviewRow[] }) => <div className="v6-copy-preview-rows">
  {rows.map((row) => <div key={row.label}><span>{row.label}</span><strong>{row.count} 項{row.kcal != null ? ` · ${Math.round(row.kcal)} kcal` : ''}{row.proteinG != null ? ` · P ${Math.round(row.proteinG)} g` : ''}</strong></div>)}
</div>

export function CopyMealPreviewSheet({ title, sourceTitle, sourceRows, currentTitle, currentRows, itemCount, scope, onCancel, onConfirm }: {
  title: string
  sourceTitle: string
  sourceRows: MealCopyPreviewRow[]
  currentTitle: string
  currentRows: MealCopyPreviewRow[]
  itemCount: number
  scope: 'meal' | 'day'
  onCancel: () => void
  onConfirm: (mode: MealCopyMode) => void | Promise<void>
}) {
  const [mode, setMode] = useState<MealCopyMode>('append')
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const dialogRef = useRef<HTMLElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const cancelRef = useRef(onCancel)
  const busyRef = useRef(false)
  useEffect(() => { cancelRef.current = onCancel }, [onCancel])
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
    requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>('button, input')?.focus({ preventScroll: true }))
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); if (!busyRef.current) cancelRef.current(); return }
      if (event.key !== 'Tab') return
      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])]
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
      requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }))
    }
  }, [])

  const confirm = async () => {
    busyRef.current = true
    setBusy(true)
    setErrorMessage('')
    try { await onConfirm(mode) }
    catch (error) { setErrorMessage(error instanceof Error && error.message ? error.message : '沿用失敗；今天的餐點沒有變更。') }
    finally { busyRef.current = false; setBusy(false) }
  }

  return createPortal(<div className="v6-sheet-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) cancelRef.current() }}>
    <section ref={dialogRef} className="v6-copy-sheet v6-floating-sheet" role="dialog" aria-modal="true" aria-labelledby="copy-meal-title" aria-busy={busy}>
      <header><div><Copy aria-hidden="true" /><h2 id="copy-meal-title">{title}</h2></div><button type="button" className="v6-icon-button" aria-label="關閉沿用預覽" disabled={busy} onClick={() => cancelRef.current()}><X /></button></header>
      <div className="v6-copy-sheet-body">
        <section><h3>{sourceTitle}</h3><PreviewRows rows={sourceRows} /></section>
        <section><h3>{currentTitle}</h3><PreviewRows rows={currentRows} /></section>
        <fieldset className="v6-copy-mode" disabled={busy}><legend>加入方式</legend><label><input type="radio" name="copy-mode" value="append" checked={mode === 'append'} onChange={() => { setMode('append'); setErrorMessage('') }} /><span><strong>追加到{scope === 'day' ? '目前餐點' : '今天這餐'}（預設）</strong><small>保留今天已輸入的內容</small></span></label><label><input type="radio" name="copy-mode" value="replace" checked={mode === 'replace'} onChange={() => { setMode('replace'); setErrorMessage('') }} /><span><strong>取代{scope === 'day' ? '今天所有餐點' : '今天這餐'}</strong><small>只有明確選取後才會取代</small></span></label></fieldset>
        {errorMessage && <p className="v6-sheet-error" role="alert">{errorMessage}</p>}
      </div>
      <footer><button type="button" disabled={busy} onClick={() => cancelRef.current()}>取消</button><button type="button" className="primary" disabled={busy || itemCount === 0} onClick={() => void confirm()}>{busy ? '加入中…' : `加入 ${itemCount} 項`}</button></footer>
    </section>
  </div>, document.body)
}
