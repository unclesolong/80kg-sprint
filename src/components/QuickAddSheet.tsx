import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Activity, Droplets, Scale, Utensils, X } from 'lucide-react'
import type { MealKey } from '../mealOperations'
import type { RecordStage } from '../types'

export function QuickAddSheet({ onClose, onStage, onMeal }: { onClose: () => void; onStage: (stage: RecordStage) => void; onMeal: (meal: MealKey) => void }) {
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

    const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    const focusableElements = () => Array.from(sheetRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])
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
      previousFocus?.focus({ preventScroll: true })
    }
  }, [])

  const meal = (value: MealKey) => { onMeal(value); onClose() }
  const stage = (value: RecordStage) => { onStage(value); onClose() }
  return createPortal(<div className="quick-add-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section ref={sheetRef} className="quick-add-sheet" role="dialog" aria-modal="true" aria-labelledby="quick-add-title" tabIndex={-1}><header><div><span>快速新增</span><h2 id="quick-add-title">今天要更新什麼？</h2></div><button type="button" aria-label="關閉快速新增" onClick={onClose}><X aria-hidden="true" /></button></header><div className="quick-add-grid">{([['breakfast', '早餐'], ['lunch', '午餐'], ['dinner', '晚餐'], ['evening', '點心']] as const).map(([key, label], index) => <button type="button" data-autofocus={index === 0 ? '' : undefined} onClick={() => meal(key)} key={key}><Utensils aria-hidden="true" /><strong>新增{label}</strong></button>)}<button type="button" onClick={() => stage('food')}><Droplets aria-hidden="true" /><strong>更新飲水</strong></button><button type="button" onClick={() => stage('evening')}><Activity aria-hidden="true" /><strong>更新活動</strong></button><button type="button" onClick={() => stage('morning')}><Scale aria-hidden="true" /><strong>更新晨重</strong></button></div></section></div>, document.body)
}
