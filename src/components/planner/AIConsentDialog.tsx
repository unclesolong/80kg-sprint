import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ShieldCheck, X } from 'lucide-react'

const sentItems = [
  '年齡、身高、目前與目標體重',
  '活動、睡眠、飲食與疼痛的彙整數字',
  '安全篩檢結果與本地安全範圍',
  '你主動輸入、要解析的食物文字'
]

const excludedItems = [
  '姓名、Email、地址、公司與聯絡人',
  '完整生日、原始每日紀錄與匯出檔',
  '與這次建議無關的自由筆記',
  '任何 API 金鑰或裝置識別資訊'
]

export function AIConsentDialog({ busy = false, onAccept, onDecline }: {
  busy?: boolean
  onAccept: () => void
  onDecline: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const declineRef = useRef(onDecline)
  const busyRef = useRef(busy)

  useEffect(() => { declineRef.current = onDecline; busyRef.current = busy }, [busy, onDecline])

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    const previousRootOverflow = document.documentElement.style.overflow
    const appShell = document.querySelector<HTMLElement>('.app-shell')
    const shellWasInert = appShell?.hasAttribute('inert') ?? false
    const previousAriaHidden = appShell?.getAttribute('aria-hidden')
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    appShell?.setAttribute('inert', '')
    appShell?.setAttribute('aria-hidden', 'true')
    const dialog = dialogRef.current
    const focusable = () => [...(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled])') ?? [])]
    focusable()[0]?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyRef.current) { event.preventDefault(); declineRef.current(); return }
      if (event.key !== 'Tab') return
      const items = focusable()
      if (!items.length) return
      const first = items[0]
      const last = items.at(-1)!
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      document.documentElement.style.overflow = previousRootOverflow
      if (!shellWasInert) appShell?.removeAttribute('inert')
      if (previousAriaHidden == null) appShell?.removeAttribute('aria-hidden')
      else appShell?.setAttribute('aria-hidden', previousAriaHidden)
      previousFocus.current?.focus()
    }
  }, [])

  const dialog = <div className="ai-consent-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onDecline() }}>
    <div ref={dialogRef} className="ai-consent-dialog health-card" role="dialog" aria-modal="true" aria-labelledby="ai-consent-title" aria-describedby="ai-consent-description">
      <header><div className="ai-consent-icon"><ShieldCheck aria-hidden="true" /></div><div><p className="eyebrow">OPTIONAL AI</p><h2 id="ai-consent-title">先確認要分享的資料</h2></div><button type="button" className="icon-button" aria-label="暫不使用 AI" disabled={busy} onClick={onDecline}><X /></button></header>
      <p id="ai-consent-description">AI 只在你主動按下按鈕時連線；不啟用也能完整使用本地計畫、飲食與趨勢。</p>
      <div className="ai-consent-columns">
        <section><h3>會送出</h3><ul>{sentItems.map((item) => <li key={item}>{item}</li>)}</ul></section>
        <section><h3>不會送出</h3><ul>{excludedItems.map((item) => <li key={item}>{item}</li>)}</ul></section>
      </div>
      <p className="ai-consent-note">請求會使用 <code>store: false</code>，代表不儲存為模型回應紀錄；這不等於任何網路服務都保證絕對零留存。食物搜尋也可能將查詢詞送到外部資料來源。</p>
      <footer><button type="button" disabled={busy} onClick={onDecline}>暫不使用 AI</button><button type="button" className="primary" disabled={busy} onClick={onAccept}>{busy ? '正在啟用…' : '同意並啟用 AI'}</button></footer>
    </div>
  </div>
  return createPortal(dialog, document.body)
}
