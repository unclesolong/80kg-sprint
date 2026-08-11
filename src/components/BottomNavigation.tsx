import { ChartNoAxesCombined, Home, NotebookPen, Plus, Settings, Sparkles } from 'lucide-react'

export type AppTab = 'today' | 'record' | 'growth' | 'trends' | 'settings'

interface BottomNavigationProps {
  activeTab: AppTab
  onSelectTab: (tab: AppTab) => void
  onQuickAdd: () => void
}

const tabButtonProps = (activeTab: AppTab, tab: AppTab) => ({
  className: activeTab === tab ? 'active' : '',
  'aria-current': activeTab === tab ? ('page' as const) : undefined
})

export function BottomNavigation({ activeTab, onSelectTab, onQuickAdd }: BottomNavigationProps) {
  return <nav
    className="bottom-nav bottom-nav-five bottom-nav-six"
    aria-label="主要導覽"
  >
    <button type="button" {...tabButtonProps(activeTab, 'today')} onClick={() => onSelectTab('today')}><Home />今日</button>
    <button type="button" {...tabButtonProps(activeTab, 'record')} onClick={() => onSelectTab('record')}><NotebookPen />紀錄</button>
    <button type="button" className="quick-add-nav" aria-label="快速新增" onClick={onQuickAdd}><span><Plus /></span>新增</button>
    <button type="button" {...tabButtonProps(activeTab, 'growth')} onClick={() => onSelectTab('growth')}><Sparkles />潤光</button>
    <button type="button" {...tabButtonProps(activeTab, 'trends')} onClick={() => onSelectTab('trends')}><ChartNoAxesCombined />趨勢</button>
    <button type="button" {...tabButtonProps(activeTab, 'settings')} onClick={() => onSelectTab('settings')}><Settings />設定</button>
  </nav>
}
