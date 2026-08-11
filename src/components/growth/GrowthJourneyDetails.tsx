import { useId } from 'react'
import { Eye, MoonStar, Sprout, Wind } from 'lucide-react'
import {
  GROWTH_AFFINITIES,
  GROWTH_AFFINITY_DEFINITIONS,
  GROWTH_NODE_DEFINITIONS,
  type GrowthAffinity,
  type GrowthCompanionView
} from './types'

const affinityIcons = {
  awareness: Eye,
  nourishment: Sprout,
  activity: Wind,
  recovery: MoonStar
} satisfies Record<GrowthAffinity, typeof Eye>

const chapters = [
  { name: '光滴', range: 'Lv1–3', first: 1, last: 3 },
  { name: '潤團', range: 'Lv4–6', first: 4, last: 6 },
  { name: '流環', range: 'Lv7–9', first: 7, last: 9 },
  { name: '星潮', range: 'Lv10–12', first: 10, last: 12 }
] as const

export interface GrowthJourneyDetailsProps {
  companion: GrowthCompanionView
}

export function GrowthJourneyDetails({ companion }: GrowthJourneyDetailsProps) {
  const affinityTitleId = useId()
  const affinityMaximum = Math.max(1, ...GROWTH_AFFINITIES.map((affinity) => companion.affinities[affinity]))

  return <div className="growth-journey-details">
    <ol className="growth-chapter-rail" aria-label="四個成長型態">
      {chapters.map((chapter) => {
        const state = companion.growthNode > chapter.last ? 'complete' : companion.growthNode >= chapter.first ? 'current' : 'upcoming'
        return <li className={`growth-chapter-rail__item growth-chapter-rail__item--${state}`} key={chapter.name}>
          <span aria-hidden="true">{chapter.first}</span>
          <strong>{chapter.name}</strong>
          <small>{chapter.range}</small>
        </li>
      })}
    </ol>

    <div className="growth-journey-details__explanation">
      <strong>每三階會進入一個新主型態</strong>
      <p>XP 決定成長階段；Lv4 與 Lv7 選擇的印記，只影響輪廓與故事方向。</p>
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

    <section className="growth-affinities" aria-labelledby={affinityTitleId}>
      <header>
        <h3 id={affinityTitleId}>四種親和力</h3>
        <p>親和力來自任務種類，只改變外觀與故事，不影響強弱或成長速度。</p>
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
  </div>
}
