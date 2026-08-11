import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, RefreshCw, ShieldCheck, X } from 'lucide-react'
import type { DataIntegritySummary } from '../utils/dataIntegrity'

export interface UpdateSafetySheetProps {
  summary: DataIntegritySummary
  hasPlanner?: boolean
  busy?: boolean
  errorMessage?: string
  onExportCore: () => void | Promise<void>
  onExportPlanner?: () => void | Promise<void>
  onClose: () => void
  /** Must store the integrity payload and reload/unmount before resolving. */
  onConfirmUpdate: () => void | Promise<void>
}

type UpdateAction = 'core' | 'planner' | 'update'

const formatIntegrityDate = (value: string | undefined) => {
  if (!value) return undefined
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return value
  return `${Number(match[2])}/${Number(match[3])}`
}

export function formatIntegrityDateRange(summary: Pick<DataIntegritySummary, 'earliestDate' | 'latestDate'>): string {
  const earliest = formatIntegrityDate(summary.earliestDate)
  const latest = formatIntegrityDate(summary.latestDate)
  if (!earliest && !latest) return '—'
  if (!earliest) return latest!
  if (!latest || latest === earliest) return earliest
  return `${earliest}–${latest}`
}

export function UpdateSafetySheet({
  summary,
  hasPlanner = false,
  busy = false,
  errorMessage,
  onExportCore,
  onExportPlanner,
  onClose,
  onConfirmUpdate
}: UpdateSafetySheetProps) {
  const titleId = useId()
  const descriptionId = useId()
  const sheetRef = useRef<HTMLElement>(null)
  const onCloseRef = useRef(onClose)
  const lockedRef = useRef(false)
  const actionInFlightRef = useRef(false)
  const busyRef = useRef(busy)
  const [activeAction, setActiveAction] = useState<UpdateAction>()
  const [backupAcknowledged, setBackupAcknowledged] = useState(false)
  const [coreExported, setCoreExported] = useState(false)
  const [plannerExported, setPlannerExported] = useState(false)
  const [localError, setLocalError] = useState<string>()
  const locked = busy || activeAction !== undefined

  onCloseRef.current = onClose
  busyRef.current = busy
  lockedRef.current = locked

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const bodyOverflow = document.body.style.overflow
    const rootOverflow = document.documentElement.style.overflow
    const bodyPaddingRight = document.body.style.paddingRight
    const scrollbarGap = window.innerWidth - document.documentElement.clientWidth
    const appShell = document.querySelector<HTMLElement>('.app-shell')
    const shellWasInert = appShell?.hasAttribute('inert') ?? false
    const previousAriaHidden = appShell?.getAttribute('aria-hidden')

    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    appShell?.setAttribute('inert', '')
    appShell?.setAttribute('aria-hidden', 'true')
    if (scrollbarGap > 0) {
      const currentPadding = Number.parseFloat(window.getComputedStyle(document.body).paddingRight) || 0
      document.body.style.paddingRight = `${currentPadding + scrollbarGap}px`
    }

    const selector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    const focusableElements = () => Array.from(sheetRef.current?.querySelectorAll<HTMLElement>(selector) ?? [])
      .filter((element) => element.getAttribute('aria-hidden') !== 'true')
    const focusTimer = window.requestAnimationFrame(() => {
      const preferred = sheetRef.current?.querySelector<HTMLElement>('[data-autofocus]')
      ;(preferred ?? focusableElements()[0] ?? sheetRef.current)?.focus({ preventScroll: true })
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!lockedRef.current) {
          event.preventDefault()
          onCloseRef.current()
        }
        return
      }
      if (event.key !== 'Tab') return

      const elements = focusableElements()
      if (!elements.length) {
        event.preventDefault()
        sheetRef.current?.focus()
        return
      }
      const first = elements[0]
      const last = elements[elements.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || active === sheetRef.current || !sheetRef.current?.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !sheetRef.current?.contains(active))) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(focusTimer)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = bodyOverflow
      document.documentElement.style.overflow = rootOverflow
      document.body.style.paddingRight = bodyPaddingRight
      if (!shellWasInert) appShell?.removeAttribute('inert')
      if (previousAriaHidden == null) appShell?.removeAttribute('aria-hidden')
      else appShell?.setAttribute('aria-hidden', previousAriaHidden)
      previousFocus?.focus({ preventScroll: true })
    }
  }, [])

  const runAction = async (action: UpdateAction, callback: () => void | Promise<void>, onSuccess?: () => void) => {
    if (lockedRef.current || actionInFlightRef.current) return
    actionInFlightRef.current = true
    lockedRef.current = true
    let succeeded = false
    setLocalError(undefined)
    setActiveAction(action)
    try {
      await callback()
      onSuccess?.()
      succeeded = true
    } catch {
      setLocalError(action === 'update' ? '無法開始更新，請稍後再試。' : '備份匯出失敗，請確認瀏覽器允許下載後再試。')
    } finally {
      actionInFlightRef.current = false
      // A successful update callback must reload/unmount the sheet. Keeping the
      // action locked prevents a second update while that hand-off completes.
      if (action === 'update' && succeeded) return
      lockedRef.current = busyRef.current
      setActiveAction(undefined)
    }
  }

  const confirmUpdate = () => {
    if (!backupAcknowledged) return
    void runAction('update', onConfirmUpdate)
  }

  const dialog = <div
    className="v6-sheet-backdrop v6-update-safety-backdrop"
    role="presentation"
    onMouseDown={(event) => { if (event.target === event.currentTarget && !locked) onClose() }}
  >
    <section
      ref={sheetRef}
      className="v6-sheet v6-update-safety-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={locked || undefined}
      tabIndex={-1}
    >
      <header className="v6-sheet-header">
        <div className="v6-sheet-heading">
          <span className="v6-sheet-icon" aria-hidden="true"><ShieldCheck /></span>
          <div><p className="v6-sheet-eyebrow">資料保護</p><h2 id={titleId}>更新前確認</h2></div>
        </div>
        <button className="v6-sheet-close" type="button" aria-label="稍後再更新" disabled={locked} onClick={onClose}><X aria-hidden="true" /></button>
      </header>

      <div className="v6-sheet-body">
        <section className="v6-integrity-summary" aria-labelledby={`${titleId}-summary`}>
          <h3 id={`${titleId}-summary`}>目前裝置資料</h3>
          <dl>
            <div><dt>每日紀錄</dt><dd>{summary.logCount} 筆</dd></div>
            <div><dt>餐點項目</dt><dd>{summary.mealLineCount} 項</dd></div>
            <div><dt>運動紀錄</dt><dd>{summary.workoutCount} 筆</dd></div>
            <div><dt>日期範圍</dt><dd>{formatIntegrityDateRange(summary)}</dd></div>
          </dl>
        </section>

        <p id={descriptionId} className="v6-update-safety-note">更新程式不應刪除紀錄，但仍建議先匯出備份。</p>

        <div className="v6-backup-actions">
          <button
            type="button"
            data-autofocus
            disabled={locked}
            onClick={() => { void runAction('core', onExportCore, () => setCoreExported(true)) }}
          >
            <Download aria-hidden="true" />
            <span>{activeAction === 'core' ? '正在匯出…' : '匯出追蹤與培育 JSON'}</span>
            {coreExported && <span className="v6-action-status" role="status">已匯出</span>}
          </button>
          {hasPlanner && onExportPlanner && <button
            type="button"
            disabled={locked}
            onClick={() => { void runAction('planner', onExportPlanner, () => setPlannerExported(true)) }}
          >
            <Download aria-hidden="true" />
            <span>{activeAction === 'planner' ? '正在匯出…' : '匯出長期計畫備份'}</span>
            {plannerExported && <span className="v6-action-status" role="status">已匯出</span>}
          </button>}
        </div>

        <label className="v6-backup-acknowledgement">
          <input
            type="checkbox"
            checked={backupAcknowledged}
            disabled={locked}
            onChange={(event) => setBackupAcknowledged(event.currentTarget.checked)}
          />
          <span>我已完成備份，並確認備份檔可開啟</span>
        </label>

        {(localError || errorMessage) && <p className="v6-sheet-error" role="alert">{localError ?? errorMessage}</p>}
      </div>

      <footer className="v6-sheet-footer">
        <button type="button" disabled={locked} onClick={onClose}>稍後</button>
        <button
          type="button"
          className="v6-primary-action"
          disabled={locked || !backupAcknowledged}
          aria-disabled={locked || !backupAcknowledged}
          onClick={confirmUpdate}
        >
          <RefreshCw aria-hidden="true" />
          {activeAction === 'update' ? '正在更新…' : '已完成備份，立即更新'}
        </button>
      </footer>
    </section>
  </div>

  return typeof document === 'undefined' ? dialog : createPortal(dialog, document.body)
}
