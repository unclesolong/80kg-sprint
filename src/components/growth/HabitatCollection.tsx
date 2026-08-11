import { BookOpen, CircleHelp, MapPin } from 'lucide-react'
import { GrowthArtworkStack } from './GrowthArtworkStack'
import type { GrowthCollectionEntryView, GrowthHabitatView, GrowthResidentView } from './types'

export interface HabitatCollectionProps {
  habitat: GrowthHabitatView
  onOpenResident?: (residentId: string) => void
  onOpenCollectionEntry?: (entryId: string) => void
  onOpenCompendium?: () => void
}
const ResidentCard = ({ resident, onOpen }: { resident: GrowthResidentView; onOpen?: (residentId: string) => void }) => {
  const content = <>
    <span className="growth-resident-card__art" aria-hidden="true">
      {resident.artworkUrl
        ? <img src={resident.artworkUrl} alt="" loading="lazy" decoding="async" draggable={false} />
        : resident.status === 'undiscovered' ? <CircleHelp /> : <MapPin />}
    </span>
    <span><strong>{resident.name}</strong><small>{resident.description}</small></span>
  </>
  return onOpen
    ? <button className={`growth-touch-target growth-resident-card growth-resident-card--${resident.status}`} type="button" onClick={() => onOpen(resident.id)}>{content}</button>
    : <article className={`growth-resident-card growth-resident-card--${resident.status}`}>{content}</article>
}

const CollectionEntry = ({ entry, onOpen }: { entry: GrowthCollectionEntryView; onOpen?: (entryId: string) => void }) => {
  const content = <>
    <span className="growth-collection-entry__art" aria-hidden="true">
      {entry.artworkUrl
        ? <img src={entry.artworkUrl} alt="" loading="lazy" decoding="async" draggable={false} />
        : entry.unlocked ? <BookOpen /> : <CircleHelp />}
    </span>
    <span><strong>{entry.unlocked ? entry.name : '尚未發現'}</strong><small>{entry.description}</small></span>
  </>
  return onOpen
    ? <button className="growth-touch-target growth-collection-entry" type="button" onClick={() => onOpen(entry.id)} aria-label={`${entry.unlocked ? entry.name : '尚未發現'}圖鑑項目`}>{content}</button>
    : <article className="growth-collection-entry">{content}</article>
}

export function HabitatCollection({
  habitat,
  onOpenResident,
  onOpenCollectionEntry,
  onOpenCompendium
}: HabitatCollectionProps) {
  const unlockedCount = habitat.collection.filter((entry) => entry.unlocked).length

  return <section className="growth-section growth-habitat standard-card" aria-labelledby="growth-habitat-title">
    <header className="growth-section__header">
      <div><p className="eyebrow">HABITAT</p><h2 id="growth-habitat-title">{habitat.name}</h2></div>
      <span>{unlockedCount}／{habitat.collection.length} 圖鑑</span>
    </header>
    <p>{habitat.description}</p>

    {habitat.artworkLayers && habitat.artworkLayers.length > 0 && <GrowthArtworkStack
      className="growth-habitat__artwork"
      layers={habitat.artworkLayers}
      label={`${habitat.name}棲境`}
    />}

    <section className="growth-habitat__residents" aria-labelledby="growth-residents-title">
      <h3 id="growth-residents-title">棲境居民</h3>
      {habitat.residents.length === 0
        ? <p className="growth-section__empty">完成任務與週回顧後，新的居民可能來訪。</p>
        : <ul>{habitat.residents.map((resident) => <li key={resident.id}><ResidentCard resident={resident} onOpen={onOpenResident} /></li>)}</ul>}
    </section>

    <section className="growth-habitat__compendium" aria-labelledby="growth-compendium-title">
      <div className="growth-habitat__subheader"><h3 id="growth-compendium-title">收藏圖鑑</h3>{onOpenCompendium && <button className="growth-touch-target" type="button" onClick={onOpenCompendium}><BookOpen aria-hidden="true" />查看完整圖鑑</button>}</div>
      {habitat.collection.length === 0
        ? <p className="growth-section__empty">尚未收錄收藏物。</p>
        : <ul>{habitat.collection.map((entry) => <li key={entry.id}><CollectionEntry entry={entry} onOpen={onOpenCollectionEntry} /></li>)}</ul>}
    </section>
  </section>
}
