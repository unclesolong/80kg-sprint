import { useRef, useState } from 'react'
import { Bot, Database, FileText, ImageDown, MessageSquareText, ShieldCheck, Smartphone } from 'lucide-react'
import { AIConsentDialog } from '../components/planner/AIConsentDialog'
import { DestructiveActionSheet } from '../components/DestructiveActionSheet'
import { defaultFoodTemplates } from '../defaults'
import { buildCsv, buildWeeklySummary, downloadText, makeBackup } from '../export'
import { shareReportPdf, shareReportPng } from '../report'
import type { ChallengeSettings, CustomFood, DailyLog, FoodTemplate } from '../types'
import { validateBackup } from '../validation'
import { makePlannerBackup, normalizePlannerBackup, validatePlannerBackup } from '../planner/plannerBackup'
import type { PlannerSnapshot } from '../planner/types'

const SettingNumber = ({ label, value, unit, step = 1, onChange }: { label: string; value: number; unit: string; step?: number; onChange: (value: number) => void }) => <label className="setting-row"><span>{label}</span><div><input inputMode="decimal" type="number" min="0" step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /><small>{unit}</small></div></label>
const blankFood = (): Omit<CustomFood, 'id'> => ({ name: '', basis: '100g', kcal: 0, proteinG: 0, defaultAmount: 100 })
const optionalFoodNutrients = new Set<keyof Omit<CustomFood, 'id'>>(['carbsG', 'fatG', 'fiberG', 'sodiumMg'])

export function SettingsPage({ today, settings, logs, foods, planner, aiConfigured, online, onEnableAI, onWithdrawAI, onOpenPlanner, onOpenPlanHistory, onPlannerImport, onSettings, onImport, onClear, onSaveFood, onDeleteFood }: {
  today: string; settings: ChallengeSettings; logs: DailyLog[]; foods: CustomFood[]
  planner: PlannerSnapshot
  aiConfigured: boolean
  online: boolean
  onEnableAI: () => Promise<void>
  onWithdrawAI: (clearRuns: boolean) => Promise<void>
  onOpenPlanner: () => void
  onOpenPlanHistory: () => void
  onPlannerImport: (planner: PlannerSnapshot) => Promise<void>
  onSettings: (settings: ChallengeSettings) => Promise<boolean>
  onImport: (settings: ChallengeSettings, logs: DailyLog[], foods: CustomFood[]) => Promise<void>
  onClear: () => Promise<void>
  onSaveFood: (food: CustomFood) => Promise<void>
  onDeleteFood: (id: string) => Promise<void>
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const plannerFileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  const [showConsent, setShowConsent] = useState(false)
  const [aiBusy, setAIBusy] = useState(false)
  const [generatingReport, setGeneratingReport] = useState<'png' | 'pdf'>()
  const [newFood, setNewFood] = useState<Omit<CustomFood, 'id'>>(blankFood)
  const [editingFoodId, setEditingFoodId] = useState<string>()
  const [foodBusy, setFoodBusy] = useState(false)
  const [destructive, setDestructive] = useState<{ kind: 'clear' } | { kind: 'withdraw'; clearRuns: boolean }>()
  const set = <K extends keyof ChallengeSettings>(key: K, value: ChallengeSettings[K]) => {
    void onSettings({ ...settings, [key]: value }).then((saved) => {
      if (!saved) setMessage('設定儲存失敗，已還原為上次成功儲存的內容。')
    })
  }
  const templates = settings.foodTemplates ?? defaultFoodTemplates()
  const updateTemplate = (id: string, patch: Partial<FoodTemplate>) => set('foodTemplates', templates.map((template) => template.id === id ? { ...template, ...patch } : template))
  const backup = () => downloadText(`80kg-sprint-backup-${today}.json`, JSON.stringify(makeBackup(settings, logs, foods), null, 2), 'application/json')
  const plannerBackup = () => downloadText(`fat-loss-planner-backup-${today}.json`, JSON.stringify(makePlannerBackup(planner), null, 2), 'application/json')
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
    setGeneratingReport(kind); setMessage(kind === 'png' ? '正在產生分析圖卡…' : '正在產生 PDF…')
    try {
      const result = kind === 'png' ? await shareReportPng(settings, logs, today) : await shareReportPdf(settings, logs, today)
      setMessage(result === 'shared' ? '報告已送出分享。' : result === 'downloaded' ? '報告已下載到此裝置。' : '已取消分享。')
    } catch (error) { setMessage(`報告產生失敗：${error instanceof Error ? error.message : '瀏覽器不支援此功能'}`) }
    finally { setGeneratingReport(undefined) }
  }
  const importFile = async (file?: File) => {
    if (!file) return
    try {
      const parsed: unknown = JSON.parse(await file.text())
      if (!validateBackup(parsed)) throw new Error('格式不符合 80KG Sprint 備份規格')
      backup(); await onImport(parsed.settings, parsed.logs, parsed.foods); setMessage('匯入成功；匯入前的資料已自動下載備份。')
    } catch (error) { setMessage(`匯入失敗：${error instanceof Error ? error.message : '無法讀取檔案'}。原有資料未變更。`) }
    finally { if (fileRef.current) fileRef.current.value = '' }
  }
  const importPlannerFile = async (file?: File) => {
    if (!file) return
    try {
      const parsed: unknown = JSON.parse(await file.text())
      if (!validatePlannerBackup(parsed)) throw new Error('格式不符合長期計畫備份規格')
      if (planner.plans.length || planner.profile || planner.safety || planner.planVersions.length || planner.weeklyReviews.length || planner.consents.length || planner.foodMetadata.length) plannerBackup()
      await onPlannerImport(normalizePlannerBackup(parsed))
      setMessage('長期計畫匯入成功；legacy 健康紀錄未變更。')
    } catch (error) { setMessage(`長期計畫匯入失敗：${error instanceof Error ? error.message : '無法讀取檔案'}。原有資料未變更。`) }
    finally { if (plannerFileRef.current) plannerFileRef.current.value = '' }
  }
  const saveFoodEntry = async () => {
    if (!newFood.name.trim()) return
    const wasEditing = Boolean(editingFoodId)
    setFoodBusy(true)
    try {
      await onSaveFood({ ...newFood, name: newFood.name.trim(), id: editingFoodId ?? crypto.randomUUID() })
      setNewFood(blankFood())
      setEditingFoodId(undefined)
      setMessage(wasEditing ? '食物資料已更新。' : '食物已加入「我的食物」。')
    } catch {
      setMessage('食物儲存失敗；輸入內容仍保留，請稍後再試。')
    } finally { setFoodBusy(false) }
  }
  const deleteFoodEntry = async (id: string) => {
    setFoodBusy(true)
    try { await onDeleteFood(id); setMessage('食物已刪除。') }
    catch { setMessage('食物刪除失敗；原資料仍保留。') }
    finally { setFoodBusy(false) }
  }
  const editFood = (food: CustomFood) => {
    setEditingFoodId(food.id)
    setNewFood({ name: food.name, basis: food.basis, kcal: food.kcal, proteinG: food.proteinG, carbsG: food.carbsG, fatG: food.fatG, fiberG: food.fiberG, sodiumMg: food.sodiumMg, defaultAmount: food.defaultAmount })
  }
  const consent = planner.consents.find((item) => item.id === 'ai-data-sharing-v1')
  const aiEnabled = Boolean(consent?.aiEnabled)
  const enableAI = async () => {
    setAIBusy(true)
    try { await onEnableAI(); setShowConsent(false); setMessage('AI 已啟用。只有你主動要求時才會送出白名單資料。') }
    catch { setMessage('AI 設定儲存失敗，原設定未變更。') }
    finally { setAIBusy(false) }
  }
  const withdrawAI = async (clearRuns: boolean) => {
    setAIBusy(true)
    try { await onWithdrawAI(clearRuns); setDestructive(undefined); setMessage(clearRuns ? '已撤回 AI 同意並清除本機 AI 執行紀錄；每日紀錄與計畫保持不變。' : '已撤回 AI 同意；之後不會再發出 AI 請求。') }
    catch { setMessage(clearRuns ? '已優先撤回 AI 同意；本機 AI 執行紀錄可能尚未清除，請稍後再試。' : 'AI 設定更新失敗，請稍後再試。'); throw new Error('withdraw failed') }
    finally { setAIBusy(false) }
  }

  return <section className="page settings-page">
    <header className="page-header"><div><p className="eyebrow">只保留每天會用到的</p><h1>設定</h1></div></header>
    <div className="privacy-card standard-card"><ShieldCheck aria-hidden="true" /><div><strong>{aiEnabled ? '日常資料留在裝置；AI 僅在你主動要求時連線' : '目前資料只儲存在此裝置'}</strong><p>{aiEnabled ? 'AI 只接收畫面列明的白名單彙整資料；GitHub 只保存程式碼。' : 'GitHub 只保存程式碼。刪除網站資料前，請先匯出 JSON。'}</p></div></div>

    <div className="settings-group planner-settings-card health-card"><h3>長期減脂計畫</h3><p className="group-intro">Planner 使用獨立的 IndexedDB 與備份，不會覆蓋 7 日 Sprint。</p><div className="action-list"><button className="primary" onClick={onOpenPlanner}>{planner.plans.length ? '查看目前計畫' : '建立長期計畫'}</button><button onClick={onOpenPlanHistory}>計畫歷史</button><button disabled={!planner.plans.length} onClick={plannerBackup}>匯出 Planner JSON</button><button onClick={() => plannerFileRef.current?.click()}>匯入 Planner JSON</button><input ref={plannerFileRef} hidden type="file" accept="application/json,.json" onChange={(event) => void importPlannerFile(event.target.files?.[0])} /></div></div>

    <div className="settings-group ai-settings-card health-card"><div className="settings-card-title"><Bot aria-hidden="true" /><div><h3>可選 AI 功能</h3><p className="group-intro">計畫草稿、每週檢討與食物文字解析；全部都有本地／手動替代流程。</p></div></div><dl><div><dt>狀態</dt><dd>{!aiConfigured ? '網站尚未設定 AI 服務' : aiEnabled ? '已啟用' : '未啟用'}</dd></div>{consent?.acceptedAt && <div><dt>同意時間</dt><dd>{new Date(consent.acceptedAt).toLocaleString('zh-TW')}</dd></div>}</dl><div className="action-list">{!aiEnabled ? <button className="primary" disabled={!aiConfigured || !online || aiBusy} onClick={() => setShowConsent(true)}>{!aiConfigured ? 'AI 尚未設定' : !online ? '連線後可啟用' : '查看資料範圍並啟用'}</button> : <><button disabled={aiBusy} onClick={() => setDestructive({ kind: 'withdraw', clearRuns: false })}>撤回 AI 同意</button><button className="danger" disabled={aiBusy} onClick={() => setDestructive({ kind: 'withdraw', clearRuns: true })}>撤回並清除 AI 執行紀錄</button></>} </div><p className="ai-consent-note"><code>store: false</code> 不代表所有網路服務都保證絕對零留存；食物搜尋也可能將查詢詞送至外部資料來源。</p></div>

    <div className="settings-group standard-card"><h3>這次 7 日衝刺</h3><label className="setting-row"><span>起始日期</span><input type="date" value={settings.startDate} onChange={(event) => set('startDate', event.target.value)} /></label><label className="setting-row"><span>最終秤重日</span><input type="date" value={settings.finalWeighInDate} onChange={(event) => set('finalWeighInDate', event.target.value)} /></label><SettingNumber label="基準體重" value={settings.baselineWeightKg} unit="kg" step={0.1} onChange={(value) => set('baselineWeightKg', value)} /><SettingNumber label="目標體重" value={settings.targetWeightKg} unit="kg" step={0.1} onChange={(value) => set('targetWeightKg', value)} /></div>
    <div className="settings-group standard-card"><h3>每天主要目標</h3><SettingNumber label="攝取下限" value={settings.intakeKcalMinimum} unit="kcal" onChange={(value) => set('intakeKcalMinimum', value)} /><SettingNumber label="攝取上限" value={settings.intakeKcalMaximum} unit="kcal" onChange={(value) => set('intakeKcalMaximum', value)} /><SettingNumber label="活動目標" value={settings.activeKcalTarget} unit="kcal" onChange={(value) => set('activeKcalTarget', value)} /><SettingNumber label="蛋白質至少" value={settings.proteinMinimumG} unit="g" onChange={(value) => set('proteinMinimumG', value)} /><SettingNumber label="喝水至少" value={settings.waterMinimumMl} unit="ml" onChange={(value) => set('waterMinimumMl', value)} /><SettingNumber label="睡眠至少" value={settings.sleepMinimumHours} unit="小時" step={0.25} onChange={(value) => set('sleepMinimumHours', value)} /></div>

    <details className="settings-details standard-card"><summary>進階目標</summary><div className="details-body"><SettingNumber label="身高" value={settings.heightCm} unit="cm" onChange={(value) => set('heightCm', value)} /><SettingNumber label="活動下限" value={settings.activeKcalMinimum} unit="kcal" onChange={(value) => set('activeKcalMinimum', value)} /><SettingNumber label="活動上限" value={settings.activeKcalMaximum} unit="kcal" onChange={(value) => set('activeKcalMaximum', value)} /><SettingNumber label="蛋白質上限" value={settings.proteinMaximumG} unit="g" onChange={(value) => set('proteinMaximumG', value)} /><SettingNumber label="飲水上限" value={settings.waterMaximumMl} unit="ml" onChange={(value) => set('waterMaximumMl', value)} /><SettingNumber label="步數下限" value={settings.stepsMinimum} unit="步" onChange={(value) => set('stepsMinimum', value)} /><SettingNumber label="步數上限" value={settings.stepsMaximum} unit="步" onChange={(value) => set('stepsMaximum', value)} /><SettingNumber label="運動分鐘下限" value={settings.exerciseMinutesMinimum} unit="分" onChange={(value) => set('exerciseMinutesMinimum', value)} /><SettingNumber label="運動分鐘上限" value={settings.exerciseMinutesMaximum} unit="分" onChange={(value) => set('exerciseMinutesMaximum', value)} /></div></details>

    <details className="settings-details standard-card"><summary>飲食快捷模板 <small>{templates.length} 組</small></summary><div className="details-body template-editor"><p className="group-intro">修改後會同步套用到熱量與全部營養素。</p>{templates.map((template) => <article key={template.id} className="template-card"><label>名稱<input value={template.name} onChange={(event) => updateTemplate(template.id, { name: event.target.value })} /></label><label>說明<input value={template.description} onChange={(event) => updateTemplate(template.id, { description: event.target.value })} /></label><div className="template-nutrients">{([['kcal', 'kcal'], ['proteinG', '蛋白 g'], ['carbsG', '碳水 g'], ['fatG', '脂肪 g'], ['fiberG', '纖維 g'], ['sodiumMg', '鈉 mg']] as const).map(([key, label]) => <label key={key}>{label}<input type="number" min="0" value={template[key]} onChange={(event) => updateTemplate(template.id, { [key]: Number(event.target.value) })} /></label>)}</div><label className="template-quick"><input type="checkbox" checked={Boolean(template.quick)} onChange={(event) => updateTemplate(template.id, { quick: event.target.checked })} />顯示在快捷區</label></article>)}</div></details>

    <details className="settings-details report-group standard-card" open><summary>報告與分享</summary><div className="details-body"><p className="group-intro">只有已日結日期會納入最終赤字統計。</p><div className="report-actions"><button className="primary report-action" disabled={Boolean(generatingReport)} onClick={() => void exportReport('png')}><ImageDown /><div><strong>{generatingReport === 'png' ? '正在產生…' : '分享分析圖卡'}</strong><small>PNG · 手機閱讀</small></div></button><button className="report-action" disabled={Boolean(generatingReport)} onClick={() => void exportReport('pdf')}><FileText /><div><strong>{generatingReport === 'pdf' ? '正在產生…' : '分享或下載 PDF'}</strong><small>A4 挑戰摘要</small></div></button><button className="report-action" onClick={share}><MessageSquareText /><div><strong>分享文字摘要</strong><small>適合交給 ChatGPT</small></div></button></div>{message && <p className="status-message" role="status">{message}</p>}</div></details>

    <details className="settings-details standard-card"><summary><span className="summary-with-icon"><Database />資料工具與外觀</span></summary><div className="details-body"><p className="group-intro">JSON 可完整還原。請勿把匯出的健康資料 commit 到 GitHub。</p><div className="action-list"><button onClick={() => downloadText(`80kg-sprint-${today}.csv`, buildCsv(logs), 'text/csv;charset=utf-8')}>匯出 CSV</button><button onClick={backup}>匯出 JSON 備份</button><button onClick={() => fileRef.current?.click()}>匯入 JSON</button><input ref={fileRef} hidden type="file" accept="application/json,.json" onChange={(event) => importFile(event.target.files?.[0])} /></div><h4>我的食物管理</h4><div className="v6-food-manager"><div className="food-form"><input aria-label="食物名稱" placeholder="食物名稱" value={newFood.name} onChange={(event) => setNewFood({ ...newFood, name: event.target.value })} /><select aria-label="計算基準" value={newFood.basis} onChange={(event) => setNewFood({ ...newFood, basis: event.target.value as CustomFood['basis'] })}><option value="100g">每100g</option><option value="serving">每份</option></select>{([['kcal', '熱量 kcal'], ['proteinG', '蛋白質 g'], ['carbsG', '碳水 g'], ['fatG', '脂肪 g'], ['fiberG', '纖維 g'], ['sodiumMg', '鈉 mg'], ['defaultAmount', '預設份量']] as const).map(([key, label]) => <input key={key} aria-label={label} type="number" min="0" placeholder={label} value={newFood[key] ?? ''} onChange={(event) => setNewFood({ ...newFood, [key]: event.target.value === '' && optionalFoodNutrients.has(key) ? undefined : Number(event.target.value) })} />)}<button type="button" className="primary" disabled={!newFood.name.trim() || foodBusy} onClick={() => void saveFoodEntry()}>{foodBusy ? '儲存中…' : editingFoodId ? '儲存食物修改' : '新增食物'}</button>{editingFoodId && <button type="button" disabled={foodBusy} onClick={() => { setEditingFoodId(undefined); setNewFood(blankFood()) }}>取消編輯</button>}</div><div className="food-list">{foods.length === 0 ? <p className="empty">尚未建立自訂食物。</p> : foods.map((food) => <article key={food.id}><span><strong>{food.name}</strong><small>{food.kcal} kcal · P {food.proteinG}g</small></span><div className="food-actions"><button type="button" disabled={foodBusy} onClick={() => editFood(food)}>編輯</button><button type="button" disabled={foodBusy} className="danger-text" onClick={() => void deleteFoodEntry(food.id)}>刪除</button></div></article>)}</div></div><h4>外觀</h4><div className="segmented" role="group" aria-label="外觀主題"><button aria-pressed={settings.theme === 'dark'} className={settings.theme === 'dark' ? 'selected' : ''} onClick={() => set('theme', 'dark')}>深色</button><button aria-pressed={settings.theme === 'light'} className={settings.theme === 'light' ? 'selected' : ''} onClick={() => set('theme', 'light')}>淺色</button></div><button className="danger clear-data" onClick={() => setDestructive({ kind: 'clear' })}>清除 7 日 Sprint 資料</button></div></details>

    <div className="install-card standard-card"><Smartphone /><div><h3>加入 iPhone 主畫面</h3><ol><li>使用 Safari 開啟網站。</li><li>點底部「分享」。</li><li>選「加入主畫面」。</li></ol><p>安裝後可離線輸入；只有你主動使用 AI／外部食物搜尋時才會連線。</p></div></div>
    <p className="health-note">若疼痛持續、加劇或影響步態，請停止加量並尋求專業醫療評估。</p>
    {showConsent && <AIConsentDialog busy={aiBusy} onDecline={() => setShowConsent(false)} onAccept={() => void enableAI()} />}
    {destructive?.kind === 'clear' && <DestructiveActionSheet onClose={() => setDestructive(undefined)} onExportBackup={backup} onConfirm={async () => { await onClear(); setDestructive(undefined) }} />}
    {destructive?.kind === 'withdraw' && <DestructiveActionSheet title={destructive.clearRuns ? '撤回 AI 同意並清除執行紀錄' : '撤回 AI 同意'} description="撤回後不會再發出 AI 請求；這不會刪除每日紀錄或長期計畫。" deleteItems={destructive.clearRuns ? ['AI 資料分享同意', '本機 AI 執行紀錄'] : ['AI 資料分享同意']} preserveItems={['DailyLog', 'Sprint 設定', 'Planner', '食物紀錄']} confirmationPhrase="撤回" confirmLabel="確認撤回" onClose={() => setDestructive(undefined)} onConfirm={() => withdrawAI(destructive.clearRuns)} />}
  </section>
}
