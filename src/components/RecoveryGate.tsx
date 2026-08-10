import { useRef, useState, type ChangeEvent } from 'react'
import type { FirstRunState } from '../viewModels/firstRun'
import { AppMark } from './AppMark'

type RecoveryAction = () => void | Promise<void>

export interface RecoveryGateProps {
  state: FirstRunState
  onContinueExisting: RecoveryAction
  onImportBackup: (file: File) => void | Promise<void>
  onCreateNew: RecoveryAction
}

export function RecoveryGate({ state, onContinueExisting, onImportBackup, onCreateNew }: RecoveryGateProps) {
  const importInput = useRef<HTMLInputElement>(null)
  const [confirmingNew, setConfirmingNew] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(false)

  const run = async (action: RecoveryAction) => {
    setBusy(true)
    setActionError(false)
    try {
      await action()
    } catch {
      setActionError(true)
    } finally {
      setBusy(false)
    }
  }

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    try {
      await run(() => onImportBackup(file))
    } finally {
      input.value = ''
    }
  }

  return <main className="onboarding v6-recovery-gate">
    <div className="onboarding-mark onboarding-mark-neutral"><AppMark size={64} decorative /></div>
    <p className="eyebrow">FAT LOSS JOURNAL</p>
    <h1>發現這台裝置可能曾有紀錄</h1>
    <p className="lede">請先確認資料是否仍存在。不要直接建立新設定，以免改變歷史目標顯示。</p>

    {state.plannerDataUnavailable && <p className="v6-recovery-gate__warning" role="alert">Planner 資料暫時無法確認；目前數量可能不完整，系統不會把此裝置當成全新裝置。</p>}

    <dl className="panel v6-recovery-gate__counts" aria-label="目前偵測到的資料">
      <div><dt>DailyLog</dt><dd>{state.counts.dailyLogs} 筆</dd></div>
      <div><dt>MealLine</dt><dd>{state.counts.mealLines} 項</dd></div>
      <div><dt>自訂食物</dt><dd>{state.counts.foods} 項</dd></div>
      <div><dt>Planner 計畫</dt><dd>{state.counts.plannerPlans} 個</dd></div>
      <div><dt>Planner 全部紀錄</dt><dd>{state.counts.plannerRecords} 項</dd></div>
    </dl>

    <div className="v6-recovery-gate__actions">
      <button className="primary" type="button" disabled={busy} onClick={() => { void run(onContinueExisting) }}>繼續使用既有紀錄</button>
      <input ref={importInput} className="v6-recovery-gate__import-input" hidden type="file" accept=".json,application/json" onChange={(event) => { void importBackup(event) }} />
      <button type="button" disabled={busy} onClick={() => importInput.current?.click()}>匯入 JSON 備份</button>
      {!confirmingNew
        ? <button className="v6-recovery-gate__new" type="button" disabled={busy} onClick={() => setConfirmingNew(true)}>建立全新設定</button>
        : <section className="v6-recovery-gate__confirmation" role="alert">
            <strong>再次確認建立全新設定</strong>
            <p>這個動作不會清除任何既有紀錄；請只在你確認要重新填寫基本設定時繼續。</p>
            <div>
              <button type="button" disabled={busy} onClick={() => setConfirmingNew(false)}>取消</button>
              <button className="primary" type="button" disabled={busy} onClick={() => { void run(onCreateNew) }}>確認建立全新設定</button>
            </div>
          </section>}
    </div>
    {actionError && <p className="error" role="alert">操作未完成；目前資料沒有被清除，請稍後再試。</p>}
  </main>
}
