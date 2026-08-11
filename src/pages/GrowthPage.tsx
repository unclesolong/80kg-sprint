import {
  AchievementWall,
  CompanionJourney,
  HabitatCollection,
  ImprintChoice,
  TodayGrowthMissions,
  type GrowthAchievementView,
  type GrowthAffinity,
  type GrowthCompanionView,
  type GrowthHabitatView,
  type GrowthImprintChoiceView,
  type GrowthMissionView
} from '../components/growth'
import '../components/growth/growth.css'

export const getDefaultLuminousStageArtworkUrl = (growthNode: GrowthCompanionView['growthNode']) =>
  `${import.meta.env.BASE_URL}art/growth/luminous-stage-${String(growthNode).padStart(2, '0')}.webp`

export interface GrowthPageProps {
  companion: GrowthCompanionView
  missions: readonly GrowthMissionView[]
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

export function GrowthPage({
  companion,
  missions,
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
  const defaultArtworkUrl = artworkFallbackUrl ?? getDefaultLuminousStageArtworkUrl(companion.growthNode)

  return <section className="page growth-page" aria-labelledby="growth-page-title">
    <header className="growth-page__header">
      <p className="eyebrow">微光棲地</p>
      <h1 id="growth-page-title">培育與成就</h1>
      <p>完成與目前計畫一致的任務，讓潤光與棲境留下你的生活印記。</p>
    </header>

    <CompanionJourney
      companion={companion}
      fallbackArtworkUrl={defaultArtworkUrl}
    />
    <TodayGrowthMissions missions={missions} onOpenMission={onOpenMission} />
    {imprintChoice && <ImprintChoice choice={imprintChoice} onSelect={onSelectImprint} onConfirm={onConfirmImprint} />}
    <AchievementWall achievements={achievements} onOpenAchievement={onOpenAchievement} />
    <HabitatCollection
      habitat={habitat}
      onOpenResident={onOpenResident}
      onOpenCollectionEntry={onOpenCollectionEntry}
      onOpenCompendium={onOpenCompendium}
    />
  </section>
}
