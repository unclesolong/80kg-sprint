import type { GrowthArtworkLayer, GrowthArtworkSlot } from './types'

const slotOrder: Readonly<Record<GrowthArtworkSlot, number>> = {
  habitat: 0,
  'rear-fin': 1,
  body: 2,
  core: 3,
  'front-fin': 4,
  orbit: 5,
  aura: 6
}
export interface GrowthArtworkStackProps {
  layers: readonly GrowthArtworkLayer[]
  label: string
  className?: string
  emptyLabel?: string
}

/**
 * Displays pre-rendered artwork only. Every visual layer is an image asset;
 * CSS controls stacking and sizing but never draws the companion.
 */
export function GrowthArtworkStack({
  layers,
  label,
  className = '',
  emptyLabel = '美術資產尚未加入'
}: GrowthArtworkStackProps) {
  const orderedLayers = layers
    .map((layer, originalIndex) => ({ layer, originalIndex }))
    .sort((left, right) => slotOrder[left.layer.slot] - slotOrder[right.layer.slot] || left.originalIndex - right.originalIndex)

  if (orderedLayers.length === 0) {
    return <div
      className={`growth-artwork-stack growth-artwork-stack--empty ${className}`.trim()}
      role="img"
      aria-label={`${label}；${emptyLabel}`}
    >
      <span>{emptyLabel}</span>
    </div>
  }

  return <figure className={`growth-artwork-stack ${className}`.trim()} role="img" aria-label={label}>
    {orderedLayers.map(({ layer }) => <img
      className={`growth-artwork-stack__layer growth-artwork-stack__layer--${layer.slot}`}
      src={layer.url}
      alt=""
      aria-hidden="true"
      loading={layer.loading ?? 'eager'}
      decoding="async"
      draggable={false}
      key={layer.id}
    />)}
  </figure>
}
