import { useRef, useState, type ChangeEvent } from 'react'
import { AppMark } from './AppMark'

type WelcomeAction = () => void | Promise<void>

export interface WelcomePageProps {
  onStartTracking: WelcomeAction
  onStartAIPlan: WelcomeAction
  onImportBackup: (file: File) => void | Promise<void>
}

type PendingAction = 'tracking' | 'ai-plan' | 'import'

/**
 * Public first-run entry point. It deliberately does not collect or invent any
 * health targets: each choice hands control to the relevant setup flow.
 */
export function WelcomePage({ onStartTracking, onStartAIPlan, onImportBackup }: WelcomePageProps) {
  const importInput = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<PendingAction>()
  const [actionError, setActionError] = useState(false)

  const run = async (kind: PendingAction, action: WelcomeAction) => {
    setPending(kind)
    setActionError(false)
    try {
      await action()
    } catch {
      setActionError(true)
    } finally {
      setPending(undefined)
    }
  }

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    try {
      await run('import', () => onImportBackup(file))
    } finally {
      input.value = ''
    }
  }

  const busy = pending !== undefined

  return <main className="onboarding v6-onboarding v6-recovery-gate v6-welcome">
    <div className="onboarding-mark onboarding-mark-neutral"><AppMark size={64} decorative /></div>
    <p className="eyebrow onboarding-brand__english">FAT LOSS JOURNAL</p>
    <h1 className="onboarding-brand__title">歡迎使用減脂追蹤</h1>
    <p className="lede onboarding-intro">從單純記錄開始，或回答問卷建立個人計畫。你可以隨時調整目標，不會套用其他使用者的熱量或活動設定。</p>

    <section className="report-actions v6-welcome__actions" aria-label="開始使用方式">
      <button className="report-action v6-welcome__choice" type="button" disabled={busy} onClick={() => { void run('ai-plan', onStartAIPlan) }}>
        <span aria-hidden="true">AI</span>
        <div>
          <strong>{pending === 'ai-plan' ? '正在開啟問卷…' : '建立個人計畫'}</strong>
          <small>安全問卷＋可選 AI 分析，產生熱量、靜止能量、活動能量與階段目標</small>
        </div>
      </button>
      <button className="report-action v6-welcome__choice" type="button" disabled={busy} onClick={() => { void run('tracking', onStartTracking) }}>
        <span aria-hidden="true">LOG</span>
        <div>
          <strong>{pending === 'tracking' ? '正在開啟設定…' : '先開始每日記錄'}</strong>
          <small>只設定基本追蹤資料，完成計畫前不提供個人熱量處方</small>
        </div>
      </button>
      <input ref={importInput} hidden type="file" accept=".json,application/json" onChange={(event) => { void importBackup(event) }} />
      <button className="report-action v6-welcome__choice" type="button" disabled={busy} onClick={() => importInput.current?.click()}>
        <span aria-hidden="true">JSON</span>
        <div>
          <strong>{pending === 'import' ? '正在匯入備份…' : '匯入追蹤與培育備份'}</strong>
          <small>恢復每日紀錄、基本設定、自訂食物與培育進度；長期計畫備份可稍後於設定匯入</small>
        </div>
      </button>
    </section>

    {actionError && <p className="error" role="alert">操作未完成，目前資料沒有被清除。請稍後再試。</p>}

    <aside className="panel install-card v6-welcome__privacy" aria-label="資料與連線說明">
      <h2>你的資料由你決定</h2>
      <p>日常紀錄預設保留在這台裝置，沒有網路也能繼續記錄。只有在你同意使用 AI 分析時，問卷與計畫所需資料才會透過已部署的服務送出。</p>
      <p className="health-note">AI 計畫提供一般健康管理參考，不能取代醫師或營養師的診斷與治療。</p>
    </aside>
    <p className="privacy-line">本機優先 · 可離線記錄 · AI 分析需網路與明確同意</p>
  </main>
}
