import { CircleHelp } from 'lucide-react'
import { GrowthArtworkStack } from './GrowthArtworkStack'
import {
  GROWTH_NODE_DEFINITIONS,
  type GrowthArtworkLayer,
  type GrowthCompanionView
} from './types'

export interface CompanionJourneyProps {
  companion: GrowthCompanionView
  fallbackArtworkUrl: string
  onOpenXpHistory?: () => void
}

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value))

export function CompanionJourney({ companion, fallbackArtworkUrl, onOpenXpHistory }: CompanionJourneyProps) {
  const current = GROWTH_NODE_DEFINITIONS[companion.growthNode - 1]
  const next = GROWTH_NODE_DEFINITIONS[companion.growthNode]
  const companionName = companion.displayName?.trim() || '潤光'
  const progressMaximum = next ? next.minimumXp - current.minimumXp : 1
  const progressValue = next ? clamp(companion.xp - current.minimumXp, 0, progressMaximum) : 1
  const progressText = next
    ? `${companion.xp} XP，距離 ${next.name} 還有 ${Math.max(0, next.minimumXp - companion.xp)} XP`
    : `${companion.xp} XP，已達完全共鳴`
  const providedLayers = companion.artworkLayers?.filter((layer) => layer.url.trim()) ?? []
  const artworkLayers: readonly GrowthArtworkLayer[] = providedLayers.length > 0
    ? providedLayers
    : [{
        id: 'luminous-companion-fallback',
        url: companion.artworkUrl?.trim() || fallbackArtworkUrl,
        slot: 'body',
        loading: 'eager'
      }]
  const artworkLabel = companion.artworkLabel?.trim() || `${companionName}目前型態：${current.name}`

  return <section className="growth-companion standard-card" aria-labelledby="growth-companion-title">
    <header className="growth-companion__header">
      <div>
        <p className="eyebrow">目前潤光</p>
        <h2 id="growth-companion-title">{companionName}</h2>
        <p>Lv{current.node} · {current.name}</p>
      </div>
      {onOpenXpHistory
        ? <button
            className="growth-companion__xp growth-companion__xp-button growth-touch-target"
            type="button"
            aria-haspopup="dialog"
            onClick={onOpenXpHistory}
          >
            <span><strong>{companion.xp.toLocaleString('zh-TW')} XP</strong><small>查看來源</small></span>
            <CircleHelp aria-hidden="true" />
          </button>
        : <strong className="growth-companion__xp">{companion.xp.toLocaleString('zh-TW')} XP</strong>}
    </header>

    <GrowthArtworkStack layers={artworkLayers} label={artworkLabel} className="growth-companion__artwork" />

    <div className="growth-companion__progress">
      <div><strong>第 {current.node}／12 階</strong><span>{progressText}</span></div>
      <progress max={progressMaximum} value={progressValue} aria-label={progressText}>{progressValue} / {progressMaximum}</progress>
      <p className="growth-companion__stage-note">完成生活任務會獲得 XP；體重下降、少吃或超額運動不會額外加分。</p>
    </div>
  </section>
}
