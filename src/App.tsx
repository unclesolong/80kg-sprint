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
import { loadPlannerSnapshotIfExists, replacePlannerSnapshot, saveInitialPlannerBundle, savePlanVersion, saveWeeklyReview } from './planner/plannerDb'
import type { PlannerDraft, PlannerSnapshot, SafetyDecision, SafetyScreen, UserProfile, WeeklyReview } from './planner/types'

const TrendsPage = lazy(() => import('./pages/TrendsPage').then((module) => ({ default: module.TrendsPage })))

type Tab = 'today' | 'record' | 'trends' | 'settings'
type PlannerPage = 'onboarding' | 'detail' | 'weekly' | 'history'

export default function App() {
  const today = localDateString()
  const [loaded, setLoaded] = useState(false)
  const [settings, setSettings] = useState<ChallengeSettings>(defaultSettings)
  const [logs, setLogs] = useState<DailyLog[]>([])
  const logsRef = useRef<DailyLog[]>([])
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
  const [recordSaveState, setRecordSaveState] = useState<'saved' | 'saving' | 'error'>('saved')
  const saveSequence = useRef(0)

  useEffect(() => {
    loadApplicationData(loadAll, loadPlannerSnapshotIfExists).then(({ legacy, planner: plannerData, plannerError: loadError }) => { setSettings(legacy.settings); logsRef.current = legacy.logs; setLogs(legacy.logs); setFoods(legacy.foods); setPlanner(plannerData); setPlannerError(loadError); setLoaded(true) })
    const onlineHandler = () => setOnline(true)
    const offlineHandler = () => setOnline(false)
    window.addEventListener('online', onlineHandler)
    window.addEventListener('offline', offlineHandler)
    const updateSW = registerSW({ immediate: true, onNeedRefresh() { setUpdateReady(true) }, onOfflineReady() { /* UI already explains offline state */ } })
    setApplyUpdate(() => updateSW)
    return () => { window.removeEventListener('online', onlineHandler); window.removeEventListener('offline', offlineHandler) }
  }, [])

  useEffect(() => { document.documentElement.dataset.theme = settings.theme; document.querySelector('meta[name="theme-color"]')?.setAttribute('content', settings.theme === 'dark' ? '#0a0d0c' : '#f3f5f2') }, [settings.theme])

  const currentLog = useMemo(() => logs.find((log) => log.date === selectedDate) ?? emptyLog(selectedDate), [logs, selectedDate])
  const todayLog = useMemo(() => logs.find((log) => log.date === today) ?? emptyLog(today), [logs, today])
  const activePlan = useMemo(() => selectActivePlan(planner), [planner])
  const activePlanVersion = useMemo(() => activePlan ? selectPlanVersionForDate(planner.planVersions, activePlan.id, today) : undefined, [activePlan, planner.planVersions, today])
  const selectedPlanVersion = useMemo(() => activePlan ? selectPlanVersionForDate(planner.planVersions, activePlan.id, selectedDate) : undefined, [activePlan, planner.planVersions, selectedDate])
  const trendSettings = useMemo(() => activePlan && activePlanVersion ? { ...settings, startDate: activePlan.startDate, finalWeighInDate: activePlanVersion.goalDate, baselineWeightKg: planner.profile?.currentWeightKg ?? settings.baselineWeightKg, targetWeightKg: activePlan.goalWeightKg, intakeKcalMinimum: activePlanVersion.calorieRangeMinKcal, intakeKcalMaximum: activePlanVersion.calorieTargetKcal, proteinMinimumG: activePlanVersion.proteinMinG, proteinMaximumG: activePlanVersion.proteinMaxG, waterMinimumMl: activePlanVersion.waterTargetMl } : settings, [activePlan, activePlanVersion, planner.profile, settings])

  const updateLog = (date: string, patch: Partial<DailyLog>) => {
    const sequence = ++saveSequence.current
    setRecordSaveState('saving')
    const original = logsRef.current.find((log) => log.date === date) ?? emptyLog(date)
    const next = applyLogPatch(original, patch)
    const nextLogs = [...logsRef.current.filter((item) => item.id !== date), next].sort((a, b) => a.date.localeCompare(b.date))
    logsRef.current = nextLogs
    setLogs(nextLogs)
    return saveLog(next).then(() => {
      if (saveSequence.current === sequence) setRecordSaveState('saved')
      return true
    }).catch(() => {
      if (saveSequence.current === sequence) setRecordSaveState('error')
      return false
    })
  }
  const updateSettings = (next: ChallengeSettings) => { setSettings(next); void saveSettings(next) }
  const addFood = (food: CustomFood) => { setFoods((items) => [...items.filter((item) => item.id !== food.id), food]); void saveFood(food) }
  const removeFood = (id: string) => { setFoods((items) => items.filter((item) => item.id !== id)); void deleteFood(id) }
  const importData = async (nextSettings: ChallengeSettings, nextLogs: DailyLog[], nextFoods: CustomFood[]) => { const migratedSettings = migrateSettings(nextSettings); const migratedLogs = nextLogs.map(migrateLog); await replaceAllData(migratedSettings, migratedLogs, nextFoods); logsRef.current = migratedLogs; setSettings(migratedSettings); setLogs(migratedLogs); setFoods(nextFoods) }
  const clearData = async () => { await clearAllData(); logsRef.current = []; setSettings(defaultSettings); setLogs([]); setFoods([]); setTab('today') }
  const createPlanner = async (profile: UserProfile, screen: SafetyScreen, decision: SafetyDecision, draft: PlannerDraft) => {
    const { plan, version } = buildInitialPlanBundle(profile, decision, draft, today)
    await saveInitialPlannerBundle(profile, screen, plan, version)
    setPlanner((current) => ({ ...current, profile, safety: screen, plans: [...current.plans.filter((item) => item.id !== plan.id), plan], planVersions: [...current.planVersions, version] }))
    setPlannerError(undefined)
    setPlannerPage(undefined)
    setTab('today')
  }
  const applyWeeklyReview = async (version: NonNullable<typeof activePlanVersion>, review: WeeklyReview) => {
    const existingVersion = selectPlanVersionByEffectiveDate(planner.planVersions, version.planId, version.effectiveFrom)
    const appliedVersion = existingVersion ?? version
    const appliedReview = existingVersion ? { ...review, suggestedVersionDraft: { ...existingVersion } } : review
    if (!existingVersion) await savePlanVersion(version)
    await saveWeeklyReview(appliedReview)
    setPlanner((current) => ({ ...appendPlanVersion(current, appliedVersion), weeklyReviews: [...current.weeklyReviews.filter((item) => item.id !== review.id), appliedReview] }))
    setPlannerPage('detail')
  }
  const importPlanner = async (snapshot: PlannerSnapshot) => { await replacePlannerSnapshot(snapshot); setPlanner(snapshot); setPlannerError(undefined) }
  const openRecordStage = (stage: RecordStage) => { setRecordStage(stage); setSelectedDate(today); setTab('record') }
  const openMeal = (meal: MealKey) => { setRecordStage('food'); setSelectedDate(today); setRecordFoodIntent({ meal }); setTab('record') }

  if (!loaded) return <div className="loading"><div className="pulse">80</div><p>載入你的計畫…</p></div>
  if (!settings.onboarded) return <Onboarding initial={settings} onComplete={updateSettings} />

  return <div className="app-shell">
    {!online && <div className="offline-banner">目前離線 · 資料仍會儲存在此裝置</div>}
    {updateReady && <button className="update-banner" onClick={() => void applyUpdate?.(true)}>有新版本，點此更新</button>}
    {installHint && <div className="install-hint"><span>在 iPhone Safari 按分享，再選擇「加入主畫面」。</span><button aria-label="關閉安裝提示" onClick={() => { localStorage.setItem('80kg-install-hint-dismissed', '1'); setInstallHint(false) }}>×</button></div>}
    <main className={plannerPage ? 'planner-main' : ''}>
      {plannerPage === 'onboarding' && <PlannerOnboardingPage today={today} settings={settings} logs={logs} onCancel={() => setPlannerPage(undefined)} onCreate={createPlanner} />}
      {plannerPage === 'detail' && activePlan && activePlanVersion && <PlanDetailPage plan={activePlan} version={activePlanVersion} onBack={() => setPlannerPage(undefined)} onWeeklyReview={() => setPlannerPage('weekly')} onHistory={() => setPlannerPage('history')} />}
      {plannerPage === 'weekly' && activePlan && activePlanVersion && <WeeklyReviewPage today={today} logs={logs} plan={activePlan} version={activePlanVersion} onBack={() => setPlannerPage('detail')} onApply={applyWeeklyReview} />}
      {plannerPage === 'history' && <PlanHistoryPage settings={settings} plans={planner.plans} versions={planner.planVersions} onBack={() => setPlannerPage(activePlan ? 'detail' : undefined)} />}
      {!plannerPage && tab === 'today' && <TodayPage today={today} log={todayLog} logs={logs} settings={settings} plan={activePlan} planVersion={activePlanVersion} plannerProfile={planner.profile} plannerError={plannerError} onOpenPlanner={() => setPlannerPage(activePlan ? 'detail' : 'onboarding')} onOpenWeeklyReview={() => setPlannerPage('weekly')} onQuickAdd={(patch) => updateLog(today, patch)} onOpenRecord={openRecordStage} onOpenFoodTemplate={(template: FoodTemplate) => { setRecordStage('food'); setSelectedDate(today); setRecordFoodIntent({ meal: template.meal, templateId: template.id }); setTab('record') }} />}
      {!plannerPage && tab === 'record' && <RecordPage date={selectedDate} log={currentLog} logs={logs} foods={foods} settings={settings} planVersion={selectedPlanVersion} initialStage={recordStage} initialFoodIntent={recordFoodIntent} saveState={recordSaveState} onDate={setSelectedDate} onChange={(patch) => updateLog(selectedDate, patch)} onSaveFood={addFood} onDeleteFood={removeFood} onFoodIntentConsumed={() => setRecordFoodIntent(undefined)} />}
      {!plannerPage && tab === 'trends' && <Suspense fallback={<div className="loading-inline">載入趨勢圖表…</div>}><TrendsPage logs={logs} settings={trendSettings} /></Suspense>}
      {!plannerPage && tab === 'settings' && <SettingsPage today={today} settings={settings} logs={logs} foods={foods} planner={planner} onOpenPlanner={() => setPlannerPage(activePlan ? 'detail' : 'onboarding')} onOpenPlanHistory={() => setPlannerPage('history')} onPlannerImport={importPlanner} onSettings={updateSettings} onImport={importData} onClear={clearData} />}
    </main>
    {!plannerPage && <nav className="bottom-nav bottom-nav-five" aria-label="主要導覽"><button className={tab === 'today' ? 'active' : ''} onClick={() => setTab('today')}><Home />今日</button><button className={tab === 'record' ? 'active' : ''} onClick={() => setTab('record')}><NotebookPen />紀錄</button><button className="quick-add-nav" aria-label="快速新增" onClick={() => setQuickAddOpen(true)}><span><Plus /></span>新增</button><button className={tab === 'trends' ? 'active' : ''} onClick={() => setTab('trends')}><ChartNoAxesCombined />趨勢</button><button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}><Settings />設定</button></nav>}
    {quickAddOpen && <QuickAddSheet onClose={() => setQuickAddOpen(false)} onStage={openRecordStage} onMeal={openMeal} />}
  </div>
}
