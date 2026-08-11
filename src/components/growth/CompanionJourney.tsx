import { Eye, MoonStar, Sprout, Wind } from 'lucide-react'
import { GrowthArtworkStack } from './GrowthArtworkStack'
import {
  GROWTH_AFFINITIES,
  GROWTH_AFFINITY_DEFINITIONS,
  GROWTH_NODE_DEFINITIONS,
  type GrowthAffinity,
  type GrowthArtworkLayer,
  type GrowthCompanionView
} from './types'

const affinityIcons = {
  awareness: Eye,
  nourishment: Sprout,
  activity: Wind,
  recovery: MoonStar
} satisfies Record<GrowthAffinity, typeof Eye>

export interface CompanionJourneyProps {
  companion: GrowthCompanionView
  fallbackArtworkUrl: string
}

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value))

export function CompanionJourney({ companion, fallbackArtworkUrl }: CompanionJourneyProps) {
  const current = GROWTH_NODE_DEFINITIONS[companion.growthNode - 1]
  const next = GROWTH_NODE_DEFINITIONS[companion.growthNode]
  const companionName = companion.displayName?.trim() || '潤光'
  const progressMaximum = next ? next.minimumXp - current.minimumXp : 1
  const progressValue = next ? clamp(companion.xp - current.minimumXp, 0, progressMaximum) : 1
  const progressText = next
    ? `${companion.xp} XP，距離 ${next.name} 還有 ${Math.max(0, next.minimumXp - companion.xp)} XP`
    : `${companion.xp} XP，已達完全共鳴`
  const affinityMaximum = Math.max(1, ...GROWTH_AFFINITIES.map((affinity) => companion.affinities[affinity]))
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
      <strong className="growth-companion__xp">{companion.xp.toLocaleString('zh-TW')} XP</strong>
    </header>

    <GrowthArtworkStack layers={artworkLayers} label={artworkLabel} className="growth-companion__artwork" />

    <div className="growth-companion__progress">
      <div><strong>十二階成長</strong><span>{progressText}</span></div>
      <progress max={progressMaximum} value={progressValue} aria-label={progressText}>{progressValue} / {progressMaximum}</progress>
    </div>

    <ol className="growth-node-rail" aria-label="潤光十二階成長進度">
      {GROWTH_NODE_DEFINITIONS.map((definition) => {
        const state = definition.node < companion.growthNode ? 'complete' : definition.node === companion.growthNode ? 'current' : 'upcoming'
        return <li
          className={`growth-node-rail__item growth-node-rail__item--${state}`}
          aria-current={state === 'current' ? 'step' : undefined}
          key={definition.node}
        >
          <span aria-hidden="true">{definition.node}</span>
          <small>Lv{definition.node}</small>
          <strong>{definition.shortName}</strong>
        </li>
      })}
    </ol>

    <section className="growth-affinities" aria-labelledby="growth-affinities-title">
      <header>
        <h3 id="growth-affinities-title">親和力</h3>
        <p>只改變外觀與故事，不影響成長速度或角色強弱。</p>
      </header>
      <dl className="growth-affinities__grid">
        {GROWTH_AFFINITIES.map((affinity) => {
          const definition = GROWTH_AFFINITY_DEFINITIONS[affinity]
          const Icon = affinityIcons[affinity]
          const value = companion.affinities[affinity]
          return <div className={`growth-affinity growth-affinity--${affinity}`} key={affinity}>
            <dt><Icon aria-hidden="true" /><span>{definition.label}・{definition.imprintName}</span></dt>
            <dd><strong>{value}</strong><meter min={0} max={affinityMaximum} value={value} aria-label={`${definition.label}親和力 ${value}`} /></dd>
          </div>
        })}
      </dl>
      {(companion.firstImprint || companion.secondImprint || companion.recentAuraLabel) && <dl className="growth-companion__imprints">
        {companion.firstImprint && <div><dt>第一印記</dt><dd>{GROWTH_AFFINITY_DEFINITIONS[companion.firstImprint].imprintName}</dd></div>}
        {companion.secondImprint && <div><dt>第二印記</dt><dd>{GROWTH_AFFINITY_DEFINITIONS[companion.secondImprint].imprintName}</dd></div>}
        {companion.recentAuraLabel && <div><dt>近期光環</dt><dd>{companion.recentAuraLabel}</dd></div>}
      </dl>}
    </section>
  </section>
}
