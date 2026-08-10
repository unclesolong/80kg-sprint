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
import { AppMark } from './components/AppMark'
import { AppErrorFallback } from './components/AppErrorBoundary'
import { RecoveryGate } from './components/RecoveryGate'
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
import { buildFirstRunState } from './viewModels/firstRun'
import { applyDocumentTheme, markAppReady } from './theme'
import { validateBackup } from './validation'
import { CoreWriteCoordinator } from './coreWriteCoordinator'

const TrendsPage = lazy(() => import('./pages/TrendsPage').then((module) => ({ default: module.TrendsPage })))
const aiClient = createAIClient()

type Tab = 'today' | 'record' | 'trends' | 'settings'
type PlannerPage = 'onboarding' | 'detail' | 'weekly' | 'history'
type FirstRunRoute = 'review' | 'continue' | 'new'

const readInstallHint = () => {
  try {
    return localStorage.getItem('80kg-install-hint-dismissed') !== '1'
  } catch {
    return true
  }
}

const clearIntegritySession = () => {
  try { clearUpdateIntegritySessionPayload(window.sessionStorage) } catch { /* Optional storage may be blocked. */ }
}

export default function App() {
  const today = localDateString()
  const [loaded, setLoaded] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [firstRunRoute, setFirstRunRoute] = useState<FirstRunRoute>('review')
  const [settings, setSettings] = useState<ChallengeSettings>(defaultSettings)
  const persistedSettingsRef = useRef<ChallengeSettings>(defaultSettings)
  const settingsSaveSequence = useRef(0)
  const [logs, setLogs] = useState<DailyLog[]>([])
  const logsRef = useRef<DailyLog[]>([])
  const persistedLogsRef = useRef<DailyLog[]>([])
  const coreWrites = useRef(new CoreWriteCoordinator())
  const [foods, setFoods] = useState<CustomFood[]>([])
  const persistedFoodsRef = useRef<CustomFood[]>([])
  const [tab, setTab] = useState<Tab>('today')
  const [selectedDate, setSelectedDate] = useState(today)
  const [recordStage, setRecordStage] = useState<RecordStage>('morning')
  const [recordFoodIntent, setRecordFoodIntent] = useState<{ meal: MealKey; templateId?: string }>()
  const [planner, setPlanner] = useState<PlannerSnapshot>(() => emptyPlannerSnapshot())
  const [plannerError, setPlannerError] = useState<string>()
  const [plannerPage, setPlannerPage] = useState<PlannerPage>()
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [installHint, setInstallHint] = useState(readInstallHint)
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
      applyDocumentTheme(legacy.settings.theme)
      setSettings(legacy.settings)
      persistedSettingsRef.current = legacy.settings
      logsRef.current = legacy.logs
      persistedLogsRef.current = legacy.logs
      setLogs(legacy.logs)
      setFoods(legacy.foods)
      persistedFoodsRef.current = legacy.foods
      setPlanner(plannerData)
      setPlannerError(loadError)
      setLoaded(true)
      let previous: ReturnType<typeof readUpdateIntegritySessionPayload>
      try {
        previous = readUpdateIntegritySessionPayload(window.sessionStorage)
      } catch {
        // Update integrity storage is optional during ordinary app startup.
        previous = undefined
      }
      if (previous) {
        void compareUpdateIntegritySessionPayload(previous, legacy.logs).then((comparison) => {
          setIntegrityComparison(comparison)
          // A matching snapshot is single-use; a mismatch remains persisted so
          // the warning survives reloads until the user restores their data.
          if (comparison.status === 'match') clearIntegritySession()
        }).catch(() => setIntegrityComparison(undefined))
      }
    }).catch((error) => {
      if (import.meta.env.DEV) console.error('Application data failed to load', error)
      setLoadFailed(true)
    })
    const onlineHandler = () => setOnline(true)
    const offlineHandler = () => setOnline(false)
    window.addEventListener('online', onlineHandler)
    window.addEventListener('offline', offlineHandler)
    const updateSW = registerSW({ immediate: true, onNeedRefresh() { setUpdateReady(true) }, onOfflineReady() { /* UI already explains offline state */ } })
    setApplyUpdate(() => updateSW)
    return () => { window.removeEventListener('online', onlineHandler); window.removeEventListener('offline', offlineHandler) }
  }, [])

  useEffect(() => {
    if (loaded && !loadFailed) markAppReady()
  }, [loaded, loadFailed])
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
  const firstRunState = useMemo(() => buildFirstRunState({
    settings,
    logs,
    foods,
    planner,
    plannerLoadFailed: Boolean(plannerError)
  }), [foods, logs, planner, plannerError, settings])
  const selectedPlanVersion = useMemo(() => activePlan ? selectPlanVersionForDate(planner.planVersions, activePlan.id, selectedDate) : undefined, [activePlan, planner.planVersions, selectedDate])
  const trendSettings = useMemo(() => activePlan && activePlanVersion
    ? settingsWithDailyTargets(settings, buildDailyTargetContext(today, settings, activePlanVersion), { startDate: activePlan.startDate, endDate: activePlanVersion.goalDate, baselineWeightKg: planner.profile?.currentWeightKg, targetWeightKg: activePlan.goalWeightKg })
    : settings, [activePlan, activePlanVersion, planner.profile, settings, today])

  const updateLog = (date: string, patch: Partial<DailyLog>) => {
    if (coreWrites.current.isBulkMutationActive) {
      setRecordSaveStates((states) => ({ ...states, [date]: 'error' }))
      return Promise.resolve(false)
    }
    const sequence = ++saveSequence.current
    latestSaveByDate.current.set(date, sequence)
    setRecordSaveStates((states) => ({ ...states, [date]: 'saving' }))
    const original = logsRef.current.find((log) => log.date === date) ?? emptyLog(date)
    const next = applyLogPatch(original, patch)
    const nextLogs = [...logsRef.current.filter((item) => item.id !== date), next].sort((a, b) => a.date.localeCompare(b.date))
    logsRef.current = nextLogs
    setLogs(nextLogs)
    return coreWrites.current.run(async () => {
      try {
        await saveLog(next)
        persistedLogsRef.current = [...persistedLogsRef.current.filter((item) => item.id !== date), next].sort((a, b) => a.date.localeCompare(b.date))
        if (latestSaveByDate.current.get(date) === sequence) setRecordSaveStates((states) => ({ ...states, [date]: 'saved' }))
        return true
      } catch {
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
      }
    }).catch(() => false)
  }
  const updateSettings = (next: ChallengeSettings) => {
    if (coreWrites.current.isBulkMutationActive) return Promise.resolve(false)
    const sequence = ++settingsSaveSequence.current
    setSettings(next)
    return coreWrites.current.run(async () => {
      try {
        await saveSettings(next)
        persistedSettingsRef.current = next
        applyDocumentTheme(next.theme)
        return true
      } catch {
        if (settingsSaveSequence.current === sequence) {
          setSettings(persistedSettingsRef.current)
          applyDocumentTheme(persistedSettingsRef.current.theme)
        }
        return false
      }
    }).catch(() => false)
  }
  const completeOnboarding = (next: ChallengeSettings) => {
    if (coreWrites.current.isBulkMutationActive) return Promise.resolve(false)
    const sequence = ++settingsSaveSequence.current
    return coreWrites.current.run(async () => {
      try {
        await saveSettings(next)
        persistedSettingsRef.current = next
        applyDocumentTheme(next.theme)
        if (settingsSaveSequence.current === sequence) setSettings(next)
        return true
      } catch {
        return false
      }
    }).catch(() => false)
  }
  const downloadPersistedCoreBackup = () => downloadText(
    `80kg-sprint-backup-${today}.json`,
    JSON.stringify(makeBackup(persistedSettingsRef.current, persistedLogsRef.current, persistedFoodsRef.current), null, 2),
    'application/json'
  )
  const hasPersistedCoreData = () => persistedLogsRef.current.length > 0
    || persistedFoodsRef.current.length > 0
    || JSON.stringify(persistedSettingsRef.current) !== JSON.stringify(defaultSettings)
  const addFood = (food: CustomFood) => coreWrites.current.run(async () => {
    await saveFood(food)
    const nextFoods = [...persistedFoodsRef.current.filter((item) => item.id !== food.id), food]
    persistedFoodsRef.current = nextFoods
    setFoods(nextFoods)
  })
  const removeFood = (id: string) => coreWrites.current.run(async () => {
    await deleteFood(id)
    const nextFoods = persistedFoodsRef.current.filter((item) => item.id !== id)
    persistedFoodsRef.current = nextFoods
    setFoods(nextFoods)
  })
  const importData = async (nextSettings: ChallengeSettings, nextLogs: DailyLog[], nextFoods: CustomFood[]) => {
    const migratedSettings = migrateSettings(nextSettings)
    const migratedLogs = nextLogs.map(migrateLog)
    await coreWrites.current.runBulk(async () => {
      if (hasPersistedCoreData()) downloadPersistedCoreBackup()
      await replaceAllData(migratedSettings, migratedLogs, nextFoods)
      logsRef.current = migratedLogs
      persistedLogsRef.current = migratedLogs
      persistedSettingsRef.current = migratedSettings
      persistedFoodsRef.current = nextFoods
      applyDocumentTheme(migratedSettings.theme)
      setSettings(migratedSettings)
      setLogs(migratedLogs)
      setFoods(nextFoods)
      setRecordSaveStates({})
      setFirstRunRoute('review')
    })
  }
  const clearData = async () => {
    await coreWrites.current.runBulk(async () => {
      if (hasPersistedCoreData()) downloadPersistedCoreBackup()
      await clearAllData()
      logsRef.current = []
      persistedLogsRef.current = []
      persistedSettingsRef.current = defaultSettings
      persistedFoodsRef.current = []
      applyDocumentTheme(defaultSettings.theme)
      setSettings(defaultSettings)
      setLogs([])
      setFoods([])
      setRecordSaveStates({})
      // Planner data is deliberately preserved by this legacy clear action.
      setFirstRunRoute('continue')
      setTab('today')
    })
  }
  const requirePlannerWritable = () => {
    if (plannerError) throw new Error('Planner data is unavailable; reload before writing')
  }
  const createPlanner = async (profile: UserProfile, screen: SafetyScreen, decision: SafetyDecision, draft: PlannerDraft, source: 'manual' | 'ai_assisted', consent?: PlannerConsent) => {
    requirePlannerWritable()
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
    requirePlannerWritable()
    const existingVersion = selectPlanVersionByEffectiveDate(planner.planVersions, version.planId, version.effectiveFrom)
    const appliedVersion = existingVersion ?? version
    const appliedReview = existingVersion ? { ...review, suggestedVersionDraft: { ...existingVersion } } : review
    if (!existingVersion) await savePlanVersion(version)
    await saveWeeklyReview(appliedReview)
    setPlanner((current) => ({ ...appendPlanVersion(current, appliedVersion), weeklyReviews: [...current.weeklyReviews.filter((item) => item.id !== review.id), appliedReview] }))
    setPlannerPage('detail')
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }))
  }
  const importPlanner = async (snapshot: PlannerSnapshot) => { requirePlannerWritable(); await replacePlannerSnapshot(snapshot); setPlanner(snapshot) }
  const enableAI = async () => {
    requirePlannerWritable()
    const consent: PlannerConsent = { id: 'ai-data-sharing-v1', aiEnabled: true, acceptedAt: new Date().toISOString() }
    await savePlannerConsent(consent)
    setPlanner((current) => ({ ...current, consents: [...current.consents.filter((item) => item.id !== consent.id), consent] }))
  }
  const withdrawAI = async (clearRuns: boolean) => {
    requirePlannerWritable()
    const consent: PlannerConsent = { id: 'ai-data-sharing-v1', aiEnabled: false, acceptedAt: aiConsent?.acceptedAt, withdrawnAt: new Date().toISOString() }
    await savePlannerConsent(consent)
    setPlanner((current) => ({ ...current, consents: [...current.consents.filter((item) => item.id !== consent.id), consent] }))
    if (clearRuns) await clearAIRuns()
  }
  const recordAIRun = (kind: AIRun['kind'], status: AIRun['status'], errorCode?: string) => {
    if (plannerError) return
    const run: AIRun = { id: `ai-run-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`, kind, status, schemaVersion: 1, errorCode, createdAt: new Date().toISOString() }
    void saveAIRun(run).catch(() => undefined)
  }
  const commitFoodMetadata = async (metadata: FoodMetadata) => {
    requirePlannerWritable()
    await saveFoodMetadata(metadata)
    setPlanner((current) => ({ ...current, foodMetadata: [...current.foodMetadata.filter((item) => item.id !== metadata.id), metadata] }))
  }
  const openRecordStage = (stage: RecordStage) => { setRecordStage(stage); setSelectedDate(today); setTab('record') }
  const openMeal = (meal: MealKey) => { setRecordStage('food'); setSelectedDate(today); setRecordFoodIntent({ meal }); setTab('record') }
  const dismissInstallHint = () => {
    try { localStorage.setItem('80kg-install-hint-dismissed', '1') } catch { /* UI preference failure is non-blocking. */ }
    setInstallHint(false)
  }
  const updateSummary = useMemo(() => buildDataIntegritySummary(logs), [logs])
  const exportCoreBackup = () => coreWrites.current.run(async () => { downloadPersistedCoreBackup() })
  const exportPlannerBackup = () => downloadText(`fat-loss-planner-backup-${today}.json`, JSON.stringify(makePlannerBackup(planner), null, 2), 'application/json')
  const importFirstRunBackup = async (file: File) => {
    const parsed: unknown = JSON.parse(await file.text())
    if (!validateBackup(parsed)) throw new Error('invalid core backup')
    await importData(parsed.settings, parsed.logs, parsed.foods)
  }
  const confirmUpdate = async () => {
    if (!applyUpdate) throw new Error('update unavailable')
    setUpdateBusy(true)
    setUpdateError(undefined)
    try {
      await coreWrites.current.runBulk(async () => {
        const payload = await createUpdateIntegritySessionPayload(persistedLogsRef.current)
        writeUpdateIntegritySessionPayload(window.sessionStorage, payload)
        await applyUpdate(true)
      }, { retainOnSuccess: true })
    } catch {
      clearIntegritySession()
      setUpdateError('無法建立更新前完整性摘要；為保護資料，本次未更新。')
      setUpdateBusy(false)
      throw new Error('update integrity preparation failed')
    }
  }

  if (loadFailed) return <AppErrorFallback />
  if (!loaded) return <div className="loading" role="status"><div className="loading-mark"><AppMark size={72} decorative /></div><p>正在讀取此裝置的紀錄…</p></div>
  if (!settings.onboarded && (firstRunState.shouldShowWelcome || firstRunRoute === 'new')) {
    return <Onboarding initial={settings} onComplete={completeOnboarding} onImportBackup={importFirstRunBackup} />
  }
  if (!settings.onboarded && firstRunState.shouldBypassLegacyOnboarding && firstRunRoute === 'review') {
    return <RecoveryGate
      state={firstRunState}
      onContinueExisting={() => setFirstRunRoute('continue')}
      onImportBackup={importFirstRunBackup}
      onCreateNew={() => setFirstRunRoute('new')}
    />
  }

  return <div className="app-shell">
    {!online && <div className="offline-banner">目前離線 · 資料仍會儲存在此裝置</div>}
    {updateReady && <button className="update-banner" onClick={() => { setUpdateError(undefined); setUpdateSafetyOpen(true) }}>有新版本可用</button>}
    {integrityComparison?.status === 'match' && <div className="v6-integrity-banner match" role="status"><span>更新完成，歷史資料完整</span><button type="button" onClick={() => { clearIntegritySession(); setIntegrityComparison(undefined) }}>知道了</button></div>}
    {integrityComparison?.status === 'mismatch' && <div className="v6-integrity-banner mismatch" role="alert"><span><strong>資料摘要不一致</strong>請先不要新增或修改紀錄。</span><button type="button" onClick={() => setTab('settings')}>前往設定與匯入備份</button></div>}
    {installHint && <div className="install-hint"><span>在 iPhone Safari 按分享，再選擇「加入主畫面」。</span><button aria-label="關閉安裝提示" onClick={dismissInstallHint}>×</button></div>}
    <main className={plannerPage ? 'planner-main' : ''}>
      {plannerPage === 'onboarding' && <PlannerOnboardingPage today={today} settings={settings} logs={logs} online={online} onCancel={() => setPlannerPage(undefined)} onCreate={createPlanner} />}
      {plannerPage === 'detail' && activePlan && activePlanVersion && <PlanDetailPage plan={activePlan} version={activePlanVersion} onBack={() => setPlannerPage(undefined)} onWeeklyReview={() => setPlannerPage('weekly')} onHistory={() => setPlannerPage('history')} />}
      {plannerPage === 'weekly' && activePlan && activePlanVersion && <WeeklyReviewPage today={today} logs={logs} plan={activePlan} version={activePlanVersion} online={online} aiEnabled={aiEnabled} onEnableAI={enableAI} onAIRun={(status, errorCode) => recordAIRun('weekly_review', status, errorCode)} onBack={() => setPlannerPage('detail')} onApply={applyWeeklyReview} />}
      {plannerPage === 'history' && <PlanHistoryPage settings={settings} plans={planner.plans} versions={planner.planVersions} onBack={() => setPlannerPage(activePlan ? 'detail' : undefined)} />}
      {!plannerPage && tab === 'today' && <TodayPage today={today} log={todayLog} logs={logs} settings={settings} plan={activePlan} planVersion={activePlanVersion} latestWeeklyReview={latestWeeklyReview} plannerProfile={planner.profile} plannerError={plannerError} onOpenPlanner={() => { if (!plannerError) setPlannerPage(activePlan ? 'detail' : 'onboarding') }} onOpenWeeklyReview={() => setPlannerPage('weekly')} onQuickAdd={(patch) => updateLog(today, patch)} onOpenRecord={openRecordStage} onOpenFoodTemplate={(template: FoodTemplate) => { setRecordStage('food'); setSelectedDate(today); setRecordFoodIntent({ meal: template.meal, templateId: template.id }); setTab('record') }} />}
      {!plannerPage && tab === 'record' && <RecordPage date={selectedDate} log={currentLog} logs={logs} foods={foods} settings={settings} planVersion={selectedPlanVersion} online={online} aiEnabled={aiEnabled} foodMetadata={planner.foodMetadata} initialStage={recordStage} initialFoodIntent={recordFoodIntent} saveState={recordSaveStates[selectedDate] ?? 'saved'} onDate={setSelectedDate} onChange={(patch) => updateLog(selectedDate, patch)} onEnableAI={enableAI} onAIRun={(status, errorCode) => recordAIRun('food_parse', status, errorCode)} onCommitMetadata={commitFoodMetadata} onFoodIntentConsumed={() => setRecordFoodIntent(undefined)} />}
      {!plannerPage && tab === 'trends' && <Suspense fallback={<div className="loading-inline">載入趨勢圖表…</div>}><TrendsPage logs={logs} settings={trendSettings} /></Suspense>}
      {!plannerPage && tab === 'settings' && <SettingsPage today={today} settings={settings} logs={logs} foods={foods} planner={planner} onboardingIncomplete={!settings.onboarded && firstRunState.shouldBypassLegacyOnboarding} plannerDataUnavailable={Boolean(plannerError)} aiConfigured={aiClient.configured} online={online} onEnableAI={enableAI} onWithdrawAI={withdrawAI} onOpenPlanner={() => { if (!plannerError) setPlannerPage(activePlan ? 'detail' : 'onboarding') }} onOpenPlanHistory={() => setPlannerPage('history')} onPlannerImport={importPlanner} onSettings={updateSettings} onImport={importData} onClear={clearData} onExportCore={exportCoreBackup} onSaveFood={addFood} onDeleteFood={removeFood} />}
    </main>
    {!plannerPage && <nav className="bottom-nav bottom-nav-five" aria-label="主要導覽"><button className={tab === 'today' ? 'active' : ''} onClick={() => setTab('today')}><Home />今日</button><button className={tab === 'record' ? 'active' : ''} onClick={() => setTab('record')}><NotebookPen />紀錄</button><button className="quick-add-nav" aria-label="快速新增" onClick={() => setQuickAddOpen(true)}><span><Plus /></span>新增</button><button className={tab === 'trends' ? 'active' : ''} onClick={() => setTab('trends')}><ChartNoAxesCombined />趨勢</button><button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}><Settings />設定</button></nav>}
    {quickAddOpen && <QuickAddSheet onClose={() => setQuickAddOpen(false)} onStage={openRecordStage} onMeal={openMeal} />}
    {updateSafetyOpen && <UpdateSafetySheet summary={updateSummary} hasPlanner={hasPlannerData} busy={updateBusy} errorMessage={updateError} onExportCore={exportCoreBackup} onExportPlanner={exportPlannerBackup} onClose={() => { if (!updateBusy) setUpdateSafetyOpen(false) }} onConfirmUpdate={confirmUpdate} />}
  </div>
}
