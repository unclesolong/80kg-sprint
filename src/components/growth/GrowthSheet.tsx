import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export interface GrowthSheetProps {
  eyebrow?: string
  title: string
  description?: string
  children: ReactNode
  onClose: () => void
}

export function GrowthSheet({ eyebrow, title, description, children, onClose }: GrowthSheetProps) {
  const titleId = useId()
  const descriptionId = useId()
  const sheetRef = useRef<HTMLElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

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
        event.preventDefault()
        onCloseRef.current()
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
      const fallback = document.querySelector<HTMLElement>('.growth-page h1, main h1, main')
      ;(previousFocus?.isConnected ? previousFocus : fallback)?.focus({ preventScroll: true })
    }
  }, [])

  return createPortal(<div
    className="growth-sheet-backdrop"
    role="presentation"
    onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
  >
    <section
      ref={sheetRef}
      className="growth-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      tabIndex={-1}
    >
      <header className="growth-sheet__header">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2 id={titleId}>{title}</h2>
          {description && <p id={descriptionId}>{description}</p>}
        </div>
        <button className="growth-sheet__close growth-touch-target" type="button" onClick={onClose} aria-label={`關閉${title}`} data-autofocus><X aria-hidden="true" /></button>
      </header>
      <div className="growth-sheet__body">{children}</div>
    </section>
  </div>, document.body)
}
