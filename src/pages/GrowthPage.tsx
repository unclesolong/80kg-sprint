import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Award, ChevronRight, ListChecks, Map, Route, Sparkles } from 'lucide-react'
import {
  AchievementWall,
  CompanionJourney,
  GrowthJourneyDetails,
  GrowthSheet,
  GrowthXpBreakdown,
  HabitatCollection,
  ImprintChoice,
  resolveGrowthStageAnimationPosterUrl,
  resolveGrowthStageAnimationUrl,
  TodayGrowthMissions,
  type GrowthAchievementView,
  type GrowthAffinity,
  type GrowthCompanionView,
  type GrowthHabitatView,
  type GrowthImprintChoiceView,
  type GrowthMissionView,
  type GrowthXpBreakdownView
} from '../components/growth'
import '../components/growth/growth.css'

export const getDefaultLuminousStageArtworkUrl = (growthNode: GrowthCompanionView['growthNode']) =>
  `${import.meta.env.BASE_URL}art/growth/luminous-stage-${String(growthNode).padStart(2, '0')}.webp`

export interface GrowthPageProps {
  companion: GrowthCompanionView
  missions: readonly GrowthMissionView[]
  xpBreakdown: GrowthXpBreakdownView
  imprintChoice?: GrowthImprintChoiceView
  achievements: readonly GrowthAchievementView[]
  habitat: GrowthHabitatView
  artworkFallbackUrl?: string
  onOpenMission?: (missionId: string) => void
  onSelectImprint?: (affinity: GrowthAffinity) => void
  onConfirmImprint?: (affinity: GrowthAffinity) => void
  onOpenAchievement?: (achievementId: string) => void
  onOpenResident?: (residentId: string) => void
  onOpenCollectionEntry?: (entryId: string) => void
  onOpenCompendium?: () => void
}

type GrowthSection = 'missions' | 'journey' | 'collection'
type GrowthOpenSheet = 'xp' | 'journey' | 'achievements' | 'habitat' | 'imprint'

const sectionOrder: readonly GrowthSection[] = ['missions', 'journey', 'collection']

export function GrowthPage({
  companion,
  missions,
  xpBreakdown,
  imprintChoice,
  achievements,
  habitat,
  artworkFallbackUrl,
  onOpenMission,
  onSelectImprint,
  onConfirmImprint,
  onOpenAchievement,
  onOpenResident,
  onOpenCollectionEntry,
  onOpenCompendium
}: GrowthPageProps) {
  const tabsId = useId()
  const tabRefs = useRef<Record<GrowthSection, HTMLButtonElement | null>>({ missions: null, journey: null, collection: null })
  const [activeSection, setActiveSection] = useState<GrowthSection>('missions')
  const [openSheet, setOpenSheet] = useState<GrowthOpenSheet>()
  const defaultArtworkUrl = artworkFallbackUrl ?? getDefaultLuminousStageArtworkUrl(companion.growthNode)
  const completedMissionCount = missions.filter((mission) => mission.status === 'completed' || mission.status === 'superseded').length
  const earnedAchievementCount = achievements.filter((achievement) => achievement.status !== 'locked').length
  const unlockedCollectionCount = habitat.collection.filter((entry) => entry.unlocked).length
  const residentCount = habitat.residents.filter((resident) => resident.status !== 'undiscovered').length
  const tabs = [
    { id: 'missions' as const, label: '任務', badge: `${completedMissionCount}/${missions.length}`, Icon: ListChecks },
    { id: 'journey' as const, label: '旅程', badge: `Lv${companion.growthNode}`, Icon: Route },
    { id: 'collection' as const, label: '收藏', badge: `${earnedAchievementCount}/${achievements.length}`, Icon: Award }
  ]

  useEffect(() => {
    if (!imprintChoice && openSheet === 'imprint') setOpenSheet(undefined)
  }, [imprintChoice, openSheet])

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | undefined
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % sectionOrder.length
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + sectionOrder.length) % sectionOrder.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = sectionOrder.length - 1
    if (nextIndex == null) return
    event.preventDefault()
    const next = sectionOrder[nextIndex]
    setActiveSection(next)
    tabRefs.current[next]?.focus()
  }

  return <section className="page growth-page" aria-labelledby="growth-page-title">
    <header className="growth-page__header">
      <p className="eyebrow">微光棲地</p>
      <h1 id="growth-page-title" tabIndex={-1}>培育與成就</h1>
      <p>每天只要完成生活紀錄與安全任務，就能讓潤光逐步成長。</p>
      <ol className="growth-page__guide" aria-label="潤光培育方式">
        <li><span>1</span><strong>留下紀錄</strong></li>
        <li><span>2</span><strong>任務自動判定</strong></li>
        <li><span>3</span><strong>XP 推進 12 階</strong></li>
      </ol>
    </header>

    <CompanionJourney
      companion={companion}
      fallbackArtworkUrl={defaultArtworkUrl}
      animationAtlasUrl={resolveGrowthStageAnimationUrl(companion.growthNode)}
      animationPosterUrl={resolveGrowthStageAnimationPosterUrl(companion.growthNode)}
      onOpenXpHistory={() => setOpenSheet('xp')}
      paused={openSheet != null}
    />

    {imprintChoice && <aside className="growth-imprint-alert standard-card">
      <span aria-hidden="true"><Sparkles /></span>
      <div><strong>Lv{imprintChoice.milestone} 新印記已可選</strong><p>它會改變潤光的輪廓與故事，不影響強弱。</p></div>
      <button className="growth-touch-target" type="button" aria-haspopup="dialog" onClick={() => setOpenSheet('imprint')}>前往選擇<ChevronRight aria-hidden="true" /></button>
    </aside>}

    <div className="growth-page__tabs" role="tablist" aria-label="培育頁分頁">
      {tabs.map(({ id, label, badge, Icon }, index) => <button
        ref={(node) => { tabRefs.current[id] = node }}
        className={activeSection === id ? 'growth-page__tab growth-page__tab--active' : 'growth-page__tab'}
        type="button"
        role="tab"
        id={`${tabsId}-${id}-tab`}
        aria-selected={activeSection === id}
        aria-controls={`${tabsId}-${id}-panel`}
        tabIndex={activeSection === id ? 0 : -1}
        onClick={() => setActiveSection(id)}
        onKeyDown={(event) => handleTabKeyDown(event, index)}
        key={id}
      ><Icon aria-hidden="true" /><span>{label}</span><small>{badge}</small></button>)}
    </div>

    <div
      className="growth-page__panel"
      role="tabpanel"
      id={`${tabsId}-${activeSection}-panel`}
      aria-labelledby={`${tabsId}-${activeSection}-tab`}
    >
      {activeSection === 'missions' && <TodayGrowthMissions missions={missions} onOpenMission={onOpenMission} />}

      {activeSection === 'journey' && <section className="growth-section growth-overview-sheet standard-card" aria-labelledby="growth-journey-summary-title">
        <header className="growth-section__header">
          <div><p className="eyebrow">JOURNEY</p><h2 id="growth-journey-summary-title">十二階旅程</h2></div>
          <span>第 {companion.growthNode}／12 階</span>
        </header>
        <p>光滴 → 潤團 → 流環 → 星潮，每個主型態包含三個成長階段。</p>
        <button className="growth-overview-sheet__action growth-touch-target" type="button" aria-haspopup="dialog" onClick={() => setOpenSheet('journey')}>
          <span><Route aria-hidden="true" /><span><strong>查看完整階段與親和力</strong><small>包含 12 階、珊芽、疾潮、月幕與星絡</small></span></span><ChevronRight aria-hidden="true" />
        </button>
      </section>}

      {activeSection === 'collection' && <section className="growth-section growth-collection-overview standard-card" aria-labelledby="growth-collection-summary-title">
        <header className="growth-section__header">
          <div><p className="eyebrow">COLLECTION</p><h2 id="growth-collection-summary-title">收藏與棲境</h2></div>
        </header>
        <p>成就與成熟居民分開收納；只有點開時才顯示完整內容。</p>
        <div className="growth-collection-overview__grid">
          <button className="growth-summary-entry growth-touch-target" type="button" aria-haspopup="dialog" onClick={() => setOpenSheet('achievements')}>
            <Award aria-hidden="true" /><span><strong>成就牆</strong><small>已解鎖 {earnedAchievementCount}／{achievements.length}</small></span><ChevronRight aria-hidden="true" />
          </button>
          <button className="growth-summary-entry growth-touch-target" type="button" aria-haspopup="dialog" onClick={() => setOpenSheet('habitat')}>
            <Map aria-hidden="true" /><span><strong>{habitat.name}</strong><small>{residentCount} 位居民・{unlockedCollectionCount} 件收藏</small></span><ChevronRight aria-hidden="true" />
          </button>
        </div>
      </section>}
    </div>

    {openSheet === 'xp' && <GrowthSheet eyebrow="XP HISTORY" title="你的 XP 從哪裡來？" description="逐筆對照已完成任務與目前累積 XP。" onClose={() => setOpenSheet(undefined)}>
      <GrowthXpBreakdown breakdown={xpBreakdown} />
    </GrowthSheet>}
    {openSheet === 'journey' && <GrowthSheet eyebrow="12 STAGES" title="十二階與四印記" description="目前階段、接下來的型態與親和力都集中在這裡。" onClose={() => setOpenSheet(undefined)}>
      <GrowthJourneyDetails companion={companion} />
    </GrowthSheet>}
    {openSheet === 'achievements' && <GrowthSheet eyebrow="ACHIEVEMENTS" title={`成就牆・${earnedAchievementCount}/${achievements.length}`} onClose={() => setOpenSheet(undefined)}>
      <AchievementWall achievements={achievements} onOpenAchievement={onOpenAchievement} />
    </GrowthSheet>}
    {openSheet === 'habitat' && <GrowthSheet eyebrow="HABITAT" title={habitat.name} onClose={() => setOpenSheet(undefined)}>
      <HabitatCollection
        habitat={habitat}
        onOpenResident={onOpenResident}
        onOpenCollectionEntry={onOpenCollectionEntry}
        onOpenCompendium={onOpenCompendium}
      />
    </GrowthSheet>}
    {openSheet === 'imprint' && imprintChoice && <GrowthSheet eyebrow="IMPRINT" title={`選擇 Lv${imprintChoice.milestone} 印記`} description="推薦來自你的任務親和力，最後選擇由你決定。" onClose={() => setOpenSheet(undefined)}>
      <ImprintChoice choice={imprintChoice} onSelect={onSelectImprint} onConfirm={onConfirmImprint} />
    </GrowthSheet>}
  </section>
}
