import { Component, useId, useState, type CSSProperties, type ErrorInfo, type ReactNode } from 'react'

interface AppErrorBoundaryProps {
  children: ReactNode
  onReload?: () => void
}

interface AppErrorBoundaryState {
  hasError: boolean
}

interface AppErrorFallbackProps {
  onReload?: () => void
}

const reloadPage = () => {
  if (typeof window !== 'undefined') window.location.reload()
}

const errorPalette = () => {
  const light = typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light'
  return light
    ? { page: '#f3f5f2', surface: '#ffffff', text: '#172019', muted: '#5f6b63', border: 'rgba(23, 32, 25, .17)' }
    : { page: '#0a0d0c', surface: '#121714', text: '#f5f7f5', muted: '#a2aca5', border: 'rgba(244, 247, 244, .15)' }
}

export function AppErrorFallback({ onReload = reloadPage }: AppErrorFallbackProps) {
  const [showBackupHelp, setShowBackupHelp] = useState(false)
  const titleId = useId()
  const backupHelpId = useId()
  const palette = errorPalette()
  const buttonStyle: CSSProperties = {
    minHeight: 48,
    padding: '10px 16px',
    borderRadius: 12,
    border: `1px solid ${palette.border}`,
    font: '700 16px/1.3 -apple-system, BlinkMacSystemFont, sans-serif',
    cursor: 'pointer'
  }

  return <main
    className="v6-app-error"
    role="alert"
    aria-labelledby={titleId}
    style={{
      minHeight: '100dvh',
      display: 'grid',
      placeItems: 'center',
      boxSizing: 'border-box',
      padding: 'max(24px, env(safe-area-inset-top)) 20px max(24px, env(safe-area-inset-bottom))',
      backgroundColor: palette.page,
      color: palette.text,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }}
  >
    <section style={{ width: 'min(100%, 560px)', boxSizing: 'border-box', padding: 24, border: `1px solid ${palette.border}`, borderRadius: 22, backgroundColor: palette.surface }}>
      <div aria-hidden="true" style={{ width: 56, height: 56, display: 'grid', placeItems: 'center', marginBottom: 18, borderRadius: 17, backgroundColor: '#65d38e', color: '#082113', fontSize: 28, fontWeight: 900 }}>!</div>
      <h1 id={titleId} style={{ margin: '0 0 14px', color: palette.text, fontSize: 26, lineHeight: 1.2, letterSpacing: '-.025em' }}>減脂追蹤無法完成載入</h1>
      <p style={{ margin: '0 0 8px', color: palette.text, fontSize: 16, lineHeight: 1.6 }}>你的裝置紀錄沒有因這個畫面自動刪除。</p>
      <p style={{ margin: '0 0 20px', color: palette.muted, fontSize: 16, lineHeight: 1.6 }}>請先不要清除網站資料。</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <button type="button" onClick={onReload} style={{ ...buttonStyle, backgroundColor: '#65d38e', color: '#082113' }}>重新載入</button>
        <button
          type="button"
          aria-expanded={showBackupHelp}
          aria-controls={backupHelpId}
          onClick={() => setShowBackupHelp((visible) => !visible)}
          style={{ ...buttonStyle, backgroundColor: palette.surface, color: palette.text }}
        >查看備份說明</button>
      </div>
      {showBackupHelp && <p id={backupHelpId} style={{ margin: '18px 0 0', paddingTop: 16, borderTop: `1px solid ${palette.border}`, color: palette.muted, fontSize: 15, lineHeight: 1.6 }}>
        若先前已匯出 JSON，重新載入後可到「設定」匯入。現在請勿清除 Safari 網站資料或移除 App。
      </p>}
    </section>
  </main>
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error('App render failed', error, info)
  }

  render() {
    if (this.state.hasError) return <AppErrorFallback onReload={this.props.onReload} />
    return this.props.children
  }
}

/** Renders a visible, dependency-free last resort when the expected mount node is absent. */
export function showMissingRootError(container: HTMLElement, onReload: () => void = reloadPage): HTMLElement {
  const documentRef = container.ownerDocument
  const palette = documentRef.documentElement.dataset.theme === 'light'
    ? { page: '#f3f5f2', surface: '#ffffff', text: '#172019', muted: '#5f6b63', border: 'rgba(23, 32, 25, .17)' }
    : { page: '#0a0d0c', surface: '#121714', text: '#f5f7f5', muted: '#a2aca5', border: 'rgba(244, 247, 244, .15)' }
  const shell = documentRef.createElement('main')
  shell.className = 'v6-app-error v6-missing-root-error'
  shell.setAttribute('role', 'alert')
  shell.style.cssText = `min-height:100dvh;display:grid;place-items:center;box-sizing:border-box;padding:24px 20px;background:${palette.page};color:${palette.text};font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`

  const card = documentRef.createElement('section')
  card.style.cssText = `width:min(100%,560px);box-sizing:border-box;padding:24px;border:1px solid ${palette.border};border-radius:22px;background:${palette.surface}`
  const title = documentRef.createElement('h1')
  title.textContent = '減脂追蹤無法完成載入'
  title.style.cssText = 'margin:0 0 14px;font-size:26px;line-height:1.2'
  const message = documentRef.createElement('p')
  message.textContent = '找不到必要的頁面掛載點。你的裝置紀錄沒有被自動刪除，請先不要清除網站資料。'
  message.style.cssText = `margin:0 0 18px;color:${palette.muted};font-size:16px;line-height:1.6`
  const reload = documentRef.createElement('button')
  reload.type = 'button'
  reload.textContent = '重新載入'
  reload.style.cssText = 'min-height:48px;padding:10px 16px;border:0;border-radius:12px;background:#65d38e;color:#082113;font:700 16px/1.3 -apple-system,BlinkMacSystemFont,sans-serif;cursor:pointer'
  reload.addEventListener('click', onReload)
  const help = documentRef.createElement('details')
  help.style.cssText = `margin-top:18px;padding-top:14px;border-top:1px solid ${palette.border};color:${palette.muted};font-size:15px;line-height:1.6`
  const helpTitle = documentRef.createElement('summary')
  helpTitle.textContent = '查看備份說明'
  const helpText = documentRef.createElement('p')
  helpText.textContent = '若先前已匯出 JSON，重新載入後可到「設定」匯入。現在請勿清除 Safari 網站資料或移除 App。'
  helpText.style.marginBottom = '0'
  help.append(helpTitle, helpText)
  card.append(title, message, reload, help)
  shell.append(card)
  container.append(shell)
  return shell
}
