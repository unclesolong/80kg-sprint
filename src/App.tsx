import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { ChartNoAxesCombined, Home, NotebookPen, Plus, Settings } from 'lucide-react'
import { registerSW } from 'virtual:pwa-register'
import { localDateString } from './calculations'
import { clearAllData, deleteFood, loadAll, replaceAllData, saveFood, saveLog, saveSettings } from './db'
import { defaultSettings, emptyLog, migrateLog, migrateSettings } from './defaults'
import { applyLogPatch } from './logUpdates'
import type { ChallengeSettings, CustomFood, DailyLog, FoodTemplate, RecordStage } from './types'
import type { MealKey } from './mealOperations'
import { Onboarding } from './components/Onboarding'
import { TodayPage } from './pages/TodayPage'
import { RecordPage } from './pages/RecordPage'
import { SettingsPage } from './pages/SettingsPage'
import { loadApplicationData } from './appData'
import { QuickAddSheet } from './components/QuickAddSheet'
import { PlannerOnboardingPage } from './pages/PlannerOnboardingPage'
import { PlanDetailPage } from './pages/PlanDetailPage'
import { WeeklyReviewPage } from './pages/WeeklyReviewPage'
import { PlanHistoryPage } from './pages/PlanHistoryPage'
import { appendPlanVersion, emptyPlannerSnapshot, selectActivePlan, selectPlanVersionByEffectiveDate, selectPlanVersionForDate } from './planner/planSelectors'
import { buildInitialPlanBundle } from './planner/plannerRepository'
import { clearAIRuns, loadPlannerSnapshotIfExists, replacePlannerSnapshot, saveAIRun, saveFoodMetadata, saveInitialPlannerBundle, savePlanVersion, savePlannerConsent, saveWeeklyReview } from './planner/plannerDb'
import type { AIRun, FoodMetadata, PlannerConsent, PlannerDraft, PlannerSnapshot, SafetyDecision, SafetyScreen, UserProfile, WeeklyReview } from './planner/types'
import { createAIClient } from './services/aiClient'
import { downloadText, makeBackup } from './export'
import { makePlannerBackup } from './planner/plannerBackup'
import { UpdateSafetySheet } from './components/UpdateSafetySheet'
import { buildDataIntegritySummary, clearUpdateIntegritySessionPayload, compareUpdateIntegritySessionPayload, createUpdateIntegritySessionPayload, readUpdateIntegritySessionPayload, writeUpdateIntegritySessionPayload, type UpdateIntegrityComparison } from './utils/dataIntegrity'
import { buildDailyTargetContext, settingsWithDailyTargets } from './viewModels/dailyTargetContext'

const TrendsPage = lazy(() => import('./pages/TrendsPage').then((module) => ({ default: module.TrendsPage })))
const aiClient = createAIClient()

type Tab = 'today' | 'record' | 'trends' | 'settings'
type PlannerPage = 'onboarding' | 'detail' | 'weekly' | 'history'

export default function App() {
  const today = localDateString()
  const [loaded, setLoaded] = useState(false)
  const [settings, setSettings] = useState<ChallengeSettings>(defaultSettings)
  const persistedSettingsRef = useRef<ChallengeSettings>(defaultSettings)
  const settingsSaveQueue = useRef<Promise<void>>(Promise.resolve())
  const settingsSaveSequence = useRef(0)
  const [logs, setLogs] = useState<DailyLog[]>([])
  const logsRef = useRef<DailyLog[]>([])
  const persistedLogsRef = useRef<DailyLog[]>([])
  const logSaveQueue = useRef<Promise<void>>(Promise.resolve())
  const [foods, setFoods] = useState<CustomFood[]>([])
  const [tab, setTab] = useState<Tab>('today')
  const [selectedDate, setSelectedDate] = useState(today)
  const [recordStage, setRecordStage] = useState<RecordStage>('morning')
  const [recordFoodIntent, setRecordFoodIntent] = useState<{ meal: MealKey; templateId?: string }>()
  const [planner, setPlanner] = useState<PlannerSnapshot>(() => emptyPlannerSnapshot())
  const [plannerError, setPlannerError] = useState<string>()
  const [plannerPage, setPlannerPage] = useState<PlannerPage>()
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [installHint, setInstallHint] = useState(() => localStorage.getItem('80kg-install-hint-dismissed') !== '1')
  const [updateReady, setUpdateReady] = useState(false)
  const [applyUpdate, setApplyUpdate] = useState<((reloadPage?: boolean) => Promise<void>) | null>(null)
  const [updateSafetyOpen, setUpdateSafetyOpen] = useState(false)
  const [updateBusy, setUpdateBusy] = useState(false)
  const [updateError, setUpdateError] = useState<string>()
  const [integrityComparison, setIntegrityComparison] = useState<UpdateIntegrityComparison>()
  const [recordSaveStates, setRecordSaveStates] = useState<Record<string, 'saved' | 'saving' | 'error'>>({})
  const saveSequence = useRef(0)
  const latestSaveByDate = useRef(new Map<string, number>())

  useEffect(() => {
    loadApplicationData(loadAll, loadPlannerSnapshotIfExists).then(({ legacy, planner: plannerData, plannerError: loadError }) => {
      setSettings(legacy.settings)
      persistedSettingsRef.current = legacy.settings
      logsRef.current = legacy.logs
      persistedLogsRef.current = legacy.logs
      setLogs(legacy.logs)
      setFoods(legacy.foods)
      setPlanner(plannerData)
      setPlannerError(loadError)
      setLoaded(true)
      const previous = readUpdateIntegritySessionPayload(sessionStorage)
      if (previous) {
        void compareUpdateIntegritySessionPayload(previous, legacy.logs).then((comparison) => {
          setIntegrityComparison(comparison)
          // A matching snapshot is single-use; a mismatch remains persisted so
          // the warning survives reloads until the user restores their data.
          if (comparison.status === 'match') clearUpdateIntegritySessionPayload(sessionStorage)
        }).catch(() => setIntegrityComparison(undefined))
      }
    })
    const onlineHandler = () => setOnline(true)
    const offlineHandler = () => setOnline(false)
    window.addEventListener('online', onlineHandler)
    window.addEventListener('offline', offlineHandler)
    const updateSW = registerSW({ immediate: true, onNeedRefresh() { setUpdateReady(true) }, onOfflineReady() { /* UI already explains offline state */ } })
    setApplyUpdate(() => updateSW)
    return () => { window.removeEventListener('online', onlineHandler); window.removeEventListener('offline', offlineHandler) }
  }, [])

  useEffect(() => { document.documentElement.dataset.theme = settings.theme; document.querySelector('meta[name="theme-color"]')?.setAttribute('content', settings.theme === 'dark' ? '#0a0d0c' : '#f3f5f2') }, [settings.theme])
  useEffect(() => {
    if (!plannerPage) return
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }))
  }, [plannerPage])

  const currentLog = useMemo(() => logs.find((log) => log.date === selectedDate) ?? emptyLog(selectedDate), [logs, selectedDate])
  const todayLog = useMemo(() => logs.find((log) => log.date === today) ?? emptyLog(today), [logs, today])
  const activePlan = useMemo(() => selectActivePlan(planner), [planner])
  const activePlanVersion = useMemo(() => activePlan ? selectPlanVersionForDate(planner.planVersions, activePlan.id, today) : undefined, [activePlan, planner.planVersions, today])
  const latestWeeklyReview = useMemo(() => activePlan ? planner.weeklyReviews.filter((review) => review.planId === activePlan.id && review.status === 'applied').sort((left, right) => left.createdAt.localeCompare(right.createdAt)).at(-1) : undefined, [activePlan, planner.weeklyReviews])
  const aiConsent = useMemo(() => planner.consents.find((item) => item.id === 'ai-data-sharing-v1'), [planner.consents])
  const aiEnabled = Boolean(aiConsent?.aiEnabled)
  const hasPlannerData = Boolean(planner.profile || planner.safety || planner.plans.length || planner.planVersions.length || planner.weeklyReviews.length || planner.consents.length || planner.foodMetadata.length)
  const selectedPlanVersion = useMemo(() => activePlan ? selectPlanVersionForDate(planner.planVersions, activePlan.id, selectedDate) : undefined, [activePlan, planner.planVersions, selectedDate])
  const trendSettings = useMemo(() => activePlan && activePlanVersion
    ? settingsWithDailyTargets(settings, buildDailyTargetContext(today, settings, activePlanVersion), { startDate: activePlan.startDate, endDate: activePlanVersion.goalDate, baselineWeightKg: planner.profile?.currentWeightKg, targetWeightKg: activePlan.goalWeightKg })
    : settings, [activePlan, activePlanVersion, planner.profile, settings, today])

  const updateLog = (date: string, patch: Partial<DailyLog>) => {
    const sequence = ++saveSequence.current
    latestSaveByDate.current.set(date, sequence)
    setRecordSaveStates((states) => ({ ...states, [date]: 'saving' }))
    const original = logsRef.current.find((log) => log.date === date) ?? emptyLog(date)
    const next = applyLogPatch(original, patch)
    const nextLogs = [...logsRef.current.filter((item) => item.id !== date), next].sort((a, b) => a.date.localeCompare(b.date))
    logsRef.current = nextLogs
    setLogs(nextLogs)
    // Serialize IndexedDB writes. This keeps the persisted snapshot ordered and
    // lets the latest failed optimistic edit roll back to the last confirmed row.
    const saveOperation = logSaveQueue.current.then(() => saveLog(next))
    logSaveQueue.current = saveOperation.then(() => undefined, () => undefined)
    return saveOperation.then(() => {
      persistedLogsRef.current = [...persistedLogsRef.current.filter((item) => item.id !== date), next].sort((a, b) => a.date.localeCompare(b.date))
      if (latestSaveByDate.current.get(date) === sequence) setRecordSaveStates((states) => ({ ...states, [date]: 'saved' }))
      return true
    }).catch(() => {
      if (latestSaveByDate.current.get(date) === sequence) {
        const persisted = persistedLogsRef.current.find((item) => item.id === date)
        const rolledBack = [
          ...logsRef.current.filter((item) => item.id !== date),
          ...(persisted ? [persisted] : [])
        ].sort((a, b) => a.date.localeCompare(b.date))
        logsRef.current = rolledBack
        setLogs(rolledBack)
        setRecordSaveStates((states) => ({ ...states, [date]: 'error' }))
      }
      return false
    })
  }
  const updateSettings = (next: ChallengeSettings) => {
    const sequence = ++settingsSaveSequence.current
    setSettings(next)
    const operation = settingsSaveQueue.current.then(() => saveSettings(next))
    settingsSaveQueue.current = operation.then(() => undefined, () => undefined)
    return operation.then(() => {
      persistedSettingsRef.current = next
      return true
    }).catch(() => {
      if (settingsSaveSequence.current === sequence) setSettings(persistedSettingsRef.current)
      return false
    })
  }
  const addFood = async (food: CustomFood) => { await saveFood(food); setFoods((items) => [...items.filter((item) => item.id !== food.id), food]) }
  const removeFood = async (id: string) => { await deleteFood(id); setFoods((items) => items.filter((item) => item.id !== id)) }
  const importData = async (nextSettings: ChallengeSettings, nextLogs: DailyLog[], nextFoods: CustomFood[]) => { const migratedSettings = migrateSettings(nextSettings); const migratedLogs = nextLogs.map(migrateLog); await Promise.all([logSaveQueue.current, settingsSaveQueue.current]); await replaceAllData(migratedSettings, migratedLogs, nextFoods); logsRef.current = migratedLogs; persistedLogsRef.current = migratedLogs; persistedSettingsRef.current = migratedSettings; setSettings(migratedSettings); setLogs(migratedLogs); setFoods(nextFoods) }
  const clearData = async () => { await Promise.all([logSaveQueue.current, settingsSaveQueue.current]); await clearAllData(); logsRef.current = []; persistedLogsRef.current = []; persistedSettingsRef.current = defaultSettings; setSettings(defaultSettings); setLogs([]); setFoods([]); setTab('today') }
  const createPlanner = async (profile: UserProfile, screen: SafetyScreen, decision: SafetyDecision, draft: PlannerDraft, source: 'manual' | 'ai_assisted', consent?: PlannerConsent) => {
    const { plan, version } = buildInitialPlanBundle(profile, decision, draft, today, new Date().toISOString(), source)
    await saveInitialPlannerBundle(profile, screen, plan, version, consent)
    setPlanner((current) => ({ ...current, profile, safety: screen, plans: [...current.plans.filter((item) => item.id !== plan.id), plan], planVersions: [...current.planVersions, version], consents: consent ? [...current.consents.filter((item) => item.id !== consent.id), consent] : current.consents }))
    if (source === 'ai_assisted') void recordAIRun('plan', 'success')
    setPlannerError(undefined)
    setPlannerPage(undefined)
    setTab('today')
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }))
  }
  const applyWeeklyReview = async (version: NonNullable<typeof activePlanVersion>, review: WeeklyReview) => {
    const existingVersion = selectPlanVersionByEffectiveDate(planner.planVersions, version.planId, version.effectiveFrom)
    const appliedVersion = existingVersion ?? version
    const appliedReview = existingVersion ? { ...review, suggestedVersionDraft: { ...existingVersion } } : review
    if (!existingVersion) await savePlanVersion(version)
    await saveWeeklyReview(appliedReview)
    setPlanner((current) => ({ ...appendPlanVersion(current, appliedVersion), weeklyReviews: [...current.weeklyReviews.filter((item) => item.id !== review.id), appliedReview] }))
    setPlannerPage('detail')
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }))
  }
  const importPlanner = async (snapshot: PlannerSnapshot) => { await replacePlannerSnapshot(snapshot); setPlanner(snapshot); setPlannerError(undefined) }
  const enableAI = async () => {
    const consent: PlannerConsent = { id: 'ai-data-sharing-v1', aiEnabled: true, acceptedAt: new Date().toISOString() }
    await savePlannerConsent(consent)
    setPlanner((current) => ({ ...current, consents: [...current.consents.filter((item) => item.id !== consent.id), consent] }))
  }
  const withdrawAI = async (clearRuns: boolean) => {
    const consent: PlannerConsent = { id: 'ai-data-sharing-v1', aiEnabled: false, acceptedAt: aiConsent?.acceptedAt, withdrawnAt: new Date().toISOString() }
    await savePlannerConsent(consent)
    setPlanner((current) => ({ ...current, consents: [...current.consents.filter((item) => item.id !== consent.id), consent] }))
    if (clearRuns) await clearAIRuns()
  }
  const recordAIRun = (kind: AIRun['kind'], status: AIRun['status'], errorCode?: string) => {
    const run: AIRun = { id: `ai-run-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`, kind, status, schemaVersion: 1, errorCode, createdAt: new Date().toISOString() }
    void saveAIRun(run).catch(() => undefined)
  }
  const commitFoodMetadata = async (metadata: FoodMetadata) => {
    await saveFoodMetadata(metadata)
    setPlanner((current) => ({ ...current, foodMetadata: [...current.foodMetadata.filter((item) => item.id !== metadata.id), metadata] }))
  }
  const openRecordStage = (stage: RecordStage) => { setRecordStage(stage); setSelectedDate(today); setTab('record') }
  const openMeal = (meal: MealKey) => { setRecordStage('food'); setSelectedDate(today); setRecordFoodIntent({ meal }); setTab('record') }
  const updateSummary = useMemo(() => buildDataIntegritySummary(logs), [logs])
  const exportCoreBackup = () => downloadText(`80kg-sprint-backup-${today}.json`, JSON.stringify(makeBackup(settings, logs, foods), null, 2), 'application/json')
  const exportPlannerBackup = () => downloadText(`fat-loss-planner-backup-${today}.json`, JSON.stringify(makePlannerBackup(planner), null, 2), 'application/json')
  const confirmUpdate = async () => {
    if (!applyUpdate) throw new Error('update unavailable')
    setUpdateBusy(true)
    setUpdateError(undefined)
    try {
      await Promise.all([logSaveQueue.current, settingsSaveQueue.current])
      const payload = await createUpdateIntegritySessionPayload(persistedLogsRef.current)
      writeUpdateIntegritySessionPayload(sessionStorage, payload)
      await applyUpdate(true)
    } catch {
      clearUpdateIntegritySessionPayload(sessionStorage)
      setUpdateError('無法建立更新前完整性摘要；為保護資料，本次未更新。')
      setUpdateBusy(false)
      throw new Error('update integrity preparation failed')
    }
  }

  if (!loaded) return <div className="loading"><div className="pulse">80</div><p>載入你的計畫…</p></div>
  if (!settings.onboarded) return <Onboarding initial={settings} onComplete={updateSettings} />

  return <div className="app-shell">
    {!online && <div className="offline-banner">目前離線 · 資料仍會儲存在此裝置</div>}
    {updateReady && <button className="update-banner" onClick={() => { setUpdateError(undefined); setUpdateSafetyOpen(true) }}>有新版本可用</button>}
    {integrityComparison?.status === 'match' && <div className="v6-integrity-banner match" role="status"><span>更新完成，歷史資料完整</span><button type="button" onClick={() => { clearUpdateIntegritySessionPayload(sessionStorage); setIntegrityComparison(undefined) }}>知道了</button></div>}
    {integrityComparison?.status === 'mismatch' && <div className="v6-integrity-banner mismatch" role="alert"><span><strong>資料摘要不一致</strong>請先不要新增或修改紀錄。</span><button type="button" onClick={() => setTab('settings')}>前往設定與匯入備份</button></div>}
    {installHint && <div className="install-hint"><span>在 iPhone Safari 按分享，再選擇「加入主畫面」。</span><button aria-label="關閉安裝提示" onClick={() => { localStorage.setItem('80kg-install-hint-dismissed', '1'); setInstallHint(false) }}>×</button></div>}
    <main className={plannerPage ? 'planner-main' : ''}>
      {plannerPage === 'onboarding' && <PlannerOnboardingPage today={today} settings={settings} logs={logs} online={online} onCancel={() => setPlannerPage(undefined)} onCreate={createPlanner} />}
      {plannerPage === 'detail' && activePlan && activePlanVersion && <PlanDetailPage plan={activePlan} version={activePlanVersion} onBack={() => setPlannerPage(undefined)} onWeeklyReview={() => setPlannerPage('weekly')} onHistory={() => setPlannerPage('history')} />}
      {plannerPage === 'weekly' && activePlan && activePlanVersion && <WeeklyReviewPage today={today} logs={logs} plan={activePlan} version={activePlanVersion} online={online} aiEnabled={aiEnabled} onEnableAI={enableAI} onAIRun={(status, errorCode) => recordAIRun('weekly_review', status, errorCode)} onBack={() => setPlannerPage('detail')} onApply={applyWeeklyReview} />}
      {plannerPage === 'history' && <PlanHistoryPage settings={settings} plans={planner.plans} versions={planner.planVersions} onBack={() => setPlannerPage(activePlan ? 'detail' : undefined)} />}
      {!plannerPage && tab === 'today' && <TodayPage today={today} log={todayLog} logs={logs} settings={settings} plan={activePlan} planVersion={activePlanVersion} latestWeeklyReview={latestWeeklyReview} plannerProfile={planner.profile} plannerError={plannerError} onOpenPlanner={() => setPlannerPage(activePlan ? 'detail' : 'onboarding')} onOpenWeeklyReview={() => setPlannerPage('weekly')} onQuickAdd={(patch) => updateLog(today, patch)} onOpenRecord={openRecordStage} onOpenFoodTemplate={(template: FoodTemplate) => { setRecordStage('food'); setSelectedDate(today); setRecordFoodIntent({ meal: template.meal, templateId: template.id }); setTab('record') }} />}
      {!plannerPage && tab === 'record' && <RecordPage date={selectedDate} log={currentLog} logs={logs} foods={foods} settings={settings} planVersion={selectedPlanVersion} online={online} aiEnabled={aiEnabled} foodMetadata={planner.foodMetadata} initialStage={recordStage} initialFoodIntent={recordFoodIntent} saveState={recordSaveStates[selectedDate] ?? 'saved'} onDate={setSelectedDate} onChange={(patch) => updateLog(selectedDate, patch)} onEnableAI={enableAI} onAIRun={(status, errorCode) => recordAIRun('food_parse', status, errorCode)} onCommitMetadata={commitFoodMetadata} onFoodIntentConsumed={() => setRecordFoodIntent(undefined)} />}
      {!plannerPage && tab === 'trends' && <Suspense fallback={<div className="loading-inline">載入趨勢圖表…</div>}><TrendsPage logs={logs} settings={trendSettings} /></Suspense>}
      {!plannerPage && tab === 'settings' && <SettingsPage today={today} settings={settings} logs={logs} foods={foods} planner={planner} aiConfigured={aiClient.configured} online={online} onEnableAI={enableAI} onWithdrawAI={withdrawAI} onOpenPlanner={() => setPlannerPage(activePlan ? 'detail' : 'onboarding')} onOpenPlanHistory={() => setPlannerPage('history')} onPlannerImport={importPlanner} onSettings={updateSettings} onImport={importData} onClear={clearData} onSaveFood={addFood} onDeleteFood={removeFood} />}
    </main>
    {!plannerPage && <nav className="bottom-nav bottom-nav-five" aria-label="主要導覽"><button className={tab === 'today' ? 'active' : ''} onClick={() => setTab('today')}><Home />今日</button><button className={tab === 'record' ? 'active' : ''} onClick={() => setTab('record')}><NotebookPen />紀錄</button><button className="quick-add-nav" aria-label="快速新增" onClick={() => setQuickAddOpen(true)}><span><Plus /></span>新增</button><button className={tab === 'trends' ? 'active' : ''} onClick={() => setTab('trends')}><ChartNoAxesCombined />趨勢</button><button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}><Settings />設定</button></nav>}
    {quickAddOpen && <QuickAddSheet onClose={() => setQuickAddOpen(false)} onStage={openRecordStage} onMeal={openMeal} />}
    {updateSafetyOpen && <UpdateSafetySheet summary={updateSummary} hasPlanner={hasPlannerData} busy={updateBusy} errorMessage={updateError} onExportCore={exportCoreBackup} onExportPlanner={exportPlannerBackup} onClose={() => { if (!updateBusy) setUpdateSafetyOpen(false) }} onConfirmUpdate={confirmUpdate} />}
  </div>
}
