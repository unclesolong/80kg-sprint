import { useRef, useState } from 'react'
import { buildCsv, buildWeeklySummary, downloadText, makeBackup } from '../export'
import { shareReportPdf, shareReportPng } from '../report'
import { validateBackup } from '../validation'
import type { ChallengeSettings, CustomFood, DailyLog } from '../types'

const SettingNumber = ({ label, value, unit, step = 1, onChange }: { label: string; value: number; unit: string; step?: number; onChange: (value: number) => void }) => <label className="setting-row"><span>{label}</span><div><input inputMode="decimal" type="number" min="0" step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /><small>{unit}</small></div></label>

export function SettingsPage({ today, settings, logs, foods, onSettings, onImport, onClear }: {
  today: string; settings: ChallengeSettings; logs: DailyLog[]; foods: CustomFood[]
  onSettings: (settings: ChallengeSettings) => void
  onImport: (settings: ChallengeSettings, logs: DailyLog[], foods: CustomFood[]) => Promise<void>
  onClear: () => Promise<void>
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  const [generatingReport, setGeneratingReport] = useState<'png' | 'pdf'>()
  const set = <K extends keyof ChallengeSettings>(key: K, value: ChallengeSettings[K]) => onSettings({ ...settings, [key]: value })
  const backup = () => downloadText(`80kg-sprint-backup-${today}.json`, JSON.stringify(makeBackup(settings, logs, foods), null, 2), 'application/json')
  const share = async () => {
    const text = buildWeeklySummary(settings, logs, today)
    try {
      if (navigator.share) await navigator.share({ title: '80KG Sprint 一週紀錄', text })
      else if (navigator.clipboard) { await navigator.clipboard.writeText(text); setMessage('摘要已複製到剪貼簿。') }
      else downloadText(`80kg-sprint-summary-${today}.txt`, text)
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') { downloadText(`80kg-sprint-summary-${today}.txt`, text); setMessage('已改為下載 TXT。') }
    }
  }
  const exportReport = async (kind: 'png' | 'pdf') => {
    setGeneratingReport(kind)
    setMessage(kind === 'png' ? '正在產生分析圖卡…' : '正在產生 PDF…')
    try {
      const result = kind === 'png'
        ? await shareReportPng(settings, logs, today)
        : await shareReportPdf(settings, logs, today)
      setMessage(result === 'shared' ? '報告已送出分享。' : result === 'downloaded' ? '報告已下載到此裝置。' : '已取消分享。')
    } catch (error) {
      setMessage(`報告產生失敗：${error instanceof Error ? error.message : '瀏覽器不支援此功能'}`)
    } finally {
      setGeneratingReport(undefined)
    }
  }
  const importFile = async (file?: File) => {
    if (!file) return
    try {
      const parsed: unknown = JSON.parse(await file.text())
      if (!validateBackup(parsed)) throw new Error('格式不符合 80KG Sprint 備份規格')
      backup()
      await onImport(parsed.settings, parsed.logs, parsed.foods)
      setMessage('匯入成功；匯入前的資料已自動下載備份。')
    } catch (error) {
      setMessage(`匯入失敗：${error instanceof Error ? error.message : '無法讀取檔案'}。原有資料未變更。`)
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }
  const clear = async () => {
    if (!confirm('第一次確認：確定要清除所有健康紀錄與設定嗎？')) return
    if (!confirm('第二次確認：此動作無法復原。建議先匯出 JSON，仍要清除嗎？')) return
    await onClear()
  }

  return <section className="page settings-page">
    <header className="page-header"><div><p className="eyebrow">掌握你的資料</p><h1>設定</h1></div></header>
    <div className="privacy-card panel"><span aria-hidden="true">⌁</span><div><strong>資料只儲存在此裝置</strong><p>刪除瀏覽器資料或移除網站資料可能造成資料遺失，請定期匯出 JSON 備份。</p></div></div>

    <div className="settings-group panel"><h3>挑戰</h3><label className="setting-row"><span>起始日期</span><input type="date" value={settings.startDate} onChange={(event) => set('startDate', event.target.value)} /></label><label className="setting-row"><span>最終秤重日</span><input type="date" value={settings.finalWeighInDate} onChange={(event) => set('finalWeighInDate', event.target.value)} /></label><SettingNumber label="基準體重" value={settings.baselineWeightKg} unit="kg" step={0.1} onChange={(value) => set('baselineWeightKg', value)} /><SettingNumber label="目標體重" value={settings.targetWeightKg} unit="kg" step={0.1} onChange={(value) => set('targetWeightKg', value)} /><SettingNumber label="身高" value={settings.heightCm} unit="cm" onChange={(value) => set('heightCm', value)} /></div>
    <div className="settings-group panel"><h3>每日目標</h3><SettingNumber label="活動目標" value={settings.activeKcalTarget} unit="kcal" onChange={(value) => set('activeKcalTarget', value)} /><SettingNumber label="活動下限" value={settings.activeKcalMinimum} unit="kcal" onChange={(value) => set('activeKcalMinimum', value)} /><SettingNumber label="活動上限" value={settings.activeKcalMaximum} unit="kcal" onChange={(value) => set('activeKcalMaximum', value)} /><SettingNumber label="攝取下限" value={settings.intakeKcalMinimum} unit="kcal" onChange={(value) => set('intakeKcalMinimum', value)} /><SettingNumber label="攝取上限" value={settings.intakeKcalMaximum} unit="kcal" onChange={(value) => set('intakeKcalMaximum', value)} /><SettingNumber label="蛋白質下限" value={settings.proteinMinimumG} unit="g" onChange={(value) => set('proteinMinimumG', value)} /><SettingNumber label="蛋白質上限" value={settings.proteinMaximumG} unit="g" onChange={(value) => set('proteinMaximumG', value)} /><SettingNumber label="飲水下限" value={settings.waterMinimumMl} unit="ml" onChange={(value) => set('waterMinimumMl', value)} /><SettingNumber label="飲水上限" value={settings.waterMaximumMl} unit="ml" onChange={(value) => set('waterMaximumMl', value)} /><SettingNumber label="睡眠下限" value={settings.sleepMinimumHours} unit="小時" step={0.25} onChange={(value) => set('sleepMinimumHours', value)} /><SettingNumber label="步數下限" value={settings.stepsMinimum} unit="步" onChange={(value) => set('stepsMinimum', value)} /><SettingNumber label="步數上限" value={settings.stepsMaximum} unit="步" onChange={(value) => set('stepsMaximum', value)} /><SettingNumber label="運動分鐘下限" value={settings.exerciseMinutesMinimum} unit="分" onChange={(value) => set('exerciseMinutesMinimum', value)} /><SettingNumber label="運動分鐘上限" value={settings.exerciseMinutesMaximum} unit="分" onChange={(value) => set('exerciseMinutesMaximum', value)} /></div>
    <div className="settings-group panel"><h3>外觀</h3><div className="segmented"><button className={settings.theme === 'dark' ? 'selected' : ''} onClick={() => set('theme', 'dark')}>深色</button><button className={settings.theme === 'light' ? 'selected' : ''} onClick={() => set('theme', 'light')}>淺色</button></div></div>
    <div className="settings-group report-group panel"><h3>分析與分享</h3><p className="group-intro">報告完全在此裝置產生。PNG 適合截圖或傳訊息；PDF 與 CSV／JSON 更適合交給 ChatGPT 做完整分析。</p><div className="report-actions"><button className="primary report-action" disabled={Boolean(generatingReport)} onClick={() => void exportReport('png')}><span>▣</span><div><strong>{generatingReport === 'png' ? '正在產生…' : '分享分析圖卡 PNG'}</strong><small>固定淺色版面，手機閱讀清楚</small></div></button><button className="report-action" disabled={Boolean(generatingReport)} onClick={() => void exportReport('pdf')}><span>PDF</span><div><strong>{generatingReport === 'pdf' ? '正在產生…' : '分享／下載 PDF 報告'}</strong><small>A4 挑戰摘要與逐日資料</small></div></button><button className="report-action" onClick={share}><span>AI</span><div><strong>分享文字摘要給 ChatGPT</strong><small>結構化文字最適合精確分析</small></div></button></div>{message && <p className="status-message" role="status">{message}</p>}</div>
    <div className="settings-group panel"><h3>資料備份</h3><p className="group-intro">CSV 便於分析，JSON 可完整備份與還原。健康紀錄請勿 commit 到 GitHub。</p><div className="action-list"><button onClick={() => downloadText(`80kg-sprint-${today}.csv`, buildCsv(logs), 'text/csv;charset=utf-8')}>匯出 CSV</button><button onClick={backup}>匯出 JSON 備份</button><button onClick={() => fileRef.current?.click()}>匯入 JSON</button><input ref={fileRef} hidden type="file" accept="application/json,.json" onChange={(event) => importFile(event.target.files?.[0])} /><button className="danger" onClick={clear}>清除所有資料</button></div></div>
    <div className="install-card panel"><h3>加入 iPhone 主畫面</h3><ol><li>使用 Safari 開啟此網站。</li><li>點選底部的「分享」圖示。</li><li>選擇「加入主畫面」，再按「加入」。</li></ol><p>安裝後可離線查看與輸入；資料仍只在這台裝置。</p></div>
    <p className="health-note">80KG Sprint 提供紀錄與估算，不是醫療診斷。若出現劇烈腹痛、嘔吐、腹脹或血便，請就醫。</p>
  </section>
}
