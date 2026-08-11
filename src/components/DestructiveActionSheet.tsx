import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, ShieldAlert, Trash2, X } from 'lucide-react'

const defaultDeletedItems = ['所有每日紀錄', '基本追蹤設定', '自訂食物', '培育進度與成就'] as const
const defaultPreservedItems = ['長期計畫', '已下載的備份檔'] as const

export interface DestructiveActionSheetProps {
  title?: string
  description?: string
  deleteItems?: readonly string[]
  preserveItems?: readonly string[]
  confirmationPhrase?: string
  confirmLabel?: string
  cancelLabel?: string
  busy?: boolean
  errorMessage?: string
  onClose: () => void
  /** Must cover the full operation and close/unmount the sheet on success. */
  onConfirm: () => void | Promise<void>
  onExportBackup?: () => void | Promise<void>
  exportLabel?: string
}

export function matchesConfirmationPhrase(value: string, confirmationPhrase: string): boolean {
  const expected = confirmationPhrase.normalize('NFKC').trim()
  return expected.length > 0 && value.normalize('NFKC').trim() === expected
}

export function DestructiveActionSheet({
  title = '清除本機追蹤與培育資料',
  description,
  deleteItems = defaultDeletedItems,
  preserveItems = defaultPreservedItems,
  confirmationPhrase = '清除',
  confirmLabel = '永久清除',
  cancelLabel = '取消',
  busy = false,
  errorMessage,
  onClose,
  onConfirm,
  onExportBackup,
  exportLabel = '匯出 JSON 備份'
}: DestructiveActionSheetProps) {
  const titleId = useId()
  const descriptionId = useId()
  const phraseHelpId = useId()
  const sheetRef = useRef<HTMLElement>(null)
  const onCloseRef = useRef(onClose)
  const lockedRef = useRef(false)
  const actionInFlightRef = useRef(false)
  const busyRef = useRef(busy)
  const [phrase, setPhrase] = useState('')
  const [activeAction, setActiveAction] = useState<'backup' | 'confirm'>()
  const [backupExported, setBackupExported] = useState(false)
  const [localError, setLocalError] = useState<string>()
  const locked = busy || activeAction !== undefined
  const phraseMatches = matchesConfirmationPhrase(phrase, confirmationPhrase)

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
      window.requestAnimationFrame(() => {
        if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
        else document.querySelector<HTMLElement>('main button:not([disabled]), main input:not([disabled]), main [tabindex]:not([tabindex="-1"])')?.focus({ preventScroll: true })
      })
    }
  }, [])

  const exportBackup = async () => {
    if (!onExportBackup || lockedRef.current || actionInFlightRef.current) return
    actionInFlightRef.current = true
    lockedRef.current = true
    setLocalError(undefined)
    setActiveAction('backup')
    try {
      await onExportBackup()
      setBackupExported(true)
    } catch {
      setLocalError('備份匯出失敗，請確認瀏覽器允許下載後再試。')
    } finally {
      actionInFlightRef.current = false
      lockedRef.current = busyRef.current
      setActiveAction(undefined)
    }
  }

  const confirm = async () => {
    if (!phraseMatches || lockedRef.current || actionInFlightRef.current) return
    actionInFlightRef.current = true
    lockedRef.current = true
    let succeeded = false
    setLocalError(undefined)
    setActiveAction('confirm')
    try {
      await onConfirm()
      succeeded = true
    } catch {
      setLocalError('操作未完整完成，請檢查目前資料後再試。')
    } finally {
      actionInFlightRef.current = false
      // The owner closes/unmounts after a successful destructive operation.
      // Retain the lock until then so a completed callback cannot be repeated.
      if (succeeded) return
      lockedRef.current = busyRef.current
      setActiveAction(undefined)
    }
  }

  const dialog = <div
    className="v6-sheet-backdrop v6-destructive-backdrop"
    role="presentation"
    onMouseDown={(event) => { if (event.target === event.currentTarget && !locked) onClose() }}
  >
    <section
      ref={sheetRef}
      className="v6-sheet v6-destructive-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={`${descriptionId} ${phraseHelpId}`}
      aria-busy={locked || undefined}
      tabIndex={-1}
    >
      <header className="v6-sheet-header">
        <div className="v6-sheet-heading">
          <span className="v6-sheet-icon v6-sheet-icon-danger" aria-hidden="true"><ShieldAlert /></span>
          <div><p className="v6-sheet-eyebrow">資料刪除確認</p><h2 id={titleId}>{title}</h2></div>
        </div>
        <button className="v6-sheet-close" type="button" aria-label={cancelLabel} disabled={locked} onClick={onClose}><X aria-hidden="true" /></button>
      </header>

      <div className="v6-sheet-body">
        <p id={descriptionId} className="v6-destructive-description">
          {description ?? '這個動作無法復原。請先確認將刪除與保留的資料。'}
        </p>

        <div className="v6-destructive-lists">
          <section className="v6-destructive-delete-list" aria-labelledby={`${titleId}-delete`}>
            <h3 id={`${titleId}-delete`}>將刪除</h3>
            <ul>{deleteItems.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
          {preserveItems.length > 0 && <section className="v6-destructive-preserve-list" aria-labelledby={`${titleId}-preserve`}>
            <h3 id={`${titleId}-preserve`}>不會刪除</h3>
            <ul>{preserveItems.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>}
        </div>

        {onExportBackup && <button
          className="v6-backup-button"
          type="button"
          disabled={locked}
          onClick={() => { void exportBackup() }}
        >
          <Download aria-hidden="true" />
          <span>{activeAction === 'backup' ? '正在匯出…' : exportLabel}</span>
          {backupExported && <span className="v6-action-status" role="status">已匯出</span>}
        </button>}

        <label className="v6-confirmation-field">
          <span id={phraseHelpId}>輸入「{confirmationPhrase}」後才能繼續</span>
          <input
            type="text"
            value={phrase}
            data-autofocus
            disabled={locked}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={phrase.length > 0 && !phraseMatches ? 'true' : undefined}
            onChange={(event) => setPhrase(event.currentTarget.value)}
          />
        </label>

        {(localError || errorMessage) && <p className="v6-sheet-error" role="alert">{localError ?? errorMessage}</p>}
      </div>

      <footer className="v6-sheet-footer">
        <button type="button" disabled={locked} onClick={onClose}>{cancelLabel}</button>
        <button
          type="button"
          className="v6-destructive-action"
          disabled={locked || !phraseMatches}
          aria-disabled={locked || !phraseMatches}
          onClick={() => { void confirm() }}
        >
          <Trash2 aria-hidden="true" />
          {activeAction === 'confirm' ? '正在處理…' : confirmLabel}
        </button>
      </footer>
    </section>
  </div>

  return typeof document === 'undefined' ? dialog : createPortal(dialog, document.body)
}
