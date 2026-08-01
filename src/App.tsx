import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { localDateString } from './calculations'
import { clearAllData, deleteFood, loadAll, replaceAllData, saveFood, saveLog, saveSettings } from './db'
import { defaultSettings, emptyLog } from './defaults'
import type { ChallengeSettings, CustomFood, DailyLog } from './types'
import { Onboarding } from './components/Onboarding'
import { TodayPage } from './pages/TodayPage'
import { RecordPage } from './pages/RecordPage'
import { SettingsPage } from './pages/SettingsPage'

const TrendsPage = lazy(() => import('./pages/TrendsPage').then((module) => ({ default: module.TrendsPage })))

type Tab = 'today' | 'record' | 'trends' | 'settings'

export default function App() {
  const today = localDateString()
  const [loaded, setLoaded] = useState(false)
  const [settings, setSettings] = useState<ChallengeSettings>(defaultSettings)
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [foods, setFoods] = useState<CustomFood[]>([])
  const [tab, setTab] = useState<Tab>('today')
  const [selectedDate, setSelectedDate] = useState(today)
  const [online, setOnline] = useState(navigator.onLine)
  const [installHint, setInstallHint] = useState(() => localStorage.getItem('80kg-install-hint-dismissed') !== '1')
  const [updateReady, setUpdateReady] = useState(false)
  const [applyUpdate, setApplyUpdate] = useState<((reloadPage?: boolean) => Promise<void>) | null>(null)

  useEffect(() => {
    loadAll().then((data) => { setSettings(data.settings); setLogs(data.logs); setFoods(data.foods); setLoaded(true) })
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

  const updateLog = (date: string, patch: Partial<DailyLog>) => {
    const original = logs.find((log) => log.date === date) ?? emptyLog(date)
    const next = { ...original, ...patch, id: date, date, updatedAt: new Date().toISOString() }
    setLogs((items) => [...items.filter((item) => item.id !== date), next].sort((a, b) => a.date.localeCompare(b.date)))
    void saveLog(next)
  }
  const updateSettings = (next: ChallengeSettings) => { setSettings(next); void saveSettings(next) }
  const addFood = (food: CustomFood) => { setFoods((items) => [...items.filter((item) => item.id !== food.id), food]); void saveFood(food) }
  const removeFood = (id: string) => { setFoods((items) => items.filter((item) => item.id !== id)); void deleteFood(id) }
  const importData = async (nextSettings: ChallengeSettings, nextLogs: DailyLog[], nextFoods: CustomFood[]) => { await replaceAllData(nextSettings, nextLogs, nextFoods); setSettings(nextSettings); setLogs(nextLogs); setFoods(nextFoods) }
  const clearData = async () => { await clearAllData(); setSettings(defaultSettings); setLogs([]); setFoods([]); setTab('today') }

  if (!loaded) return <div className="loading"><div className="pulse">80</div><p>載入你的計畫…</p></div>
  if (!settings.onboarded) return <Onboarding initial={settings} onComplete={updateSettings} />

  return <div className="app-shell">
    {!online && <div className="offline-banner">目前離線 · 資料仍會儲存在此裝置</div>}
    {updateReady && <button className="update-banner" onClick={() => void applyUpdate?.(true)}>有新版本，點此更新</button>}
    {installHint && <div className="install-hint"><span>在 iPhone Safari 按分享，再選擇「加入主畫面」。</span><button aria-label="關閉安裝提示" onClick={() => { localStorage.setItem('80kg-install-hint-dismissed', '1'); setInstallHint(false) }}>×</button></div>}
    <main>
      {tab === 'today' && <TodayPage today={today} log={todayLog} logs={logs} settings={settings} onQuickAdd={(patch) => updateLog(today, patch)} onOpenRecord={() => { setSelectedDate(today); setTab('record') }} />}
      {tab === 'record' && <RecordPage date={selectedDate} log={currentLog} foods={foods} onDate={setSelectedDate} onChange={(patch) => updateLog(selectedDate, patch)} onSaveFood={addFood} onDeleteFood={removeFood} />}
      {tab === 'trends' && <Suspense fallback={<div className="loading-inline">載入趨勢圖表…</div>}><TrendsPage logs={logs} settings={settings} /></Suspense>}
      {tab === 'settings' && <SettingsPage today={today} settings={settings} logs={logs} foods={foods} onSettings={updateSettings} onImport={importData} onClear={clearData} />}
    </main>
    <nav className="bottom-nav" aria-label="主要導覽">
      {([
        ['today', '⌂', '今日'], ['record', '＋', '紀錄'], ['trends', '↗', '趨勢'], ['settings', '⚙', '設定']
      ] as const).map(([key, icon, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}><span>{icon}</span>{label}</button>)}
    </nav>
  </div>
}
