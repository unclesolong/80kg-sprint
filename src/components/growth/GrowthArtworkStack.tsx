import { useEffect, useRef } from 'react'
import type { GrowthArtworkLayer, GrowthArtworkSlot } from './types'
import {
  useGrowthArtworkLoadBarrier,
  useGrowthMotionEnvironment,
  useGrowthTransitionLifecycle,
  type GrowthArtworkLoadBarrier,
  type GrowthArtworkMotion
} from './growthArtworkMotion'
import './growthArtworkMotion.css'

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
  /** The complete current-stage snapshot, including every equipped accessory layer. */
  layers: readonly GrowthArtworkLayer[]
  /** The complete previous-stage snapshot; mounted only during level/form transitions. */
  previousLayers?: readonly GrowthArtworkLayer[]
  label: string
  className?: string
  emptyLabel?: string
  motion?: GrowthArtworkMotion
  /** Must change for consecutive events of the same motion type. */
  motionEventId?: string
  motionPaused?: boolean
  onMotionComplete?: (motion: GrowthArtworkMotion, eventId: string, result?: 'completed' | 'failed') => void
}

const orderLayers = (layers: readonly GrowthArtworkLayer[]) => layers
  .map((layer, originalIndex) => ({ layer, originalIndex }))
  .sort((left, right) => slotOrder[left.layer.slot] - slotOrder[right.layer.slot] || left.originalIndex - right.originalIndex)

const layerSignature = (layers: readonly GrowthArtworkLayer[]): string => layers
  .map((layer) => `${layer.id}:${layer.slot}:${layer.url}`)
  .join('|')

const layerAssetId = (layer: GrowthArtworkLayer): string => `${layer.id}:${layer.url}`

/**
 * Displays pre-rendered artwork only. Every visual layer is an image asset;
 * CSS controls stacking and sizing but never draws the companion.
 */
export function GrowthArtworkStack({
  layers,
  previousLayers = [],
  label,
  className = '',
  emptyLabel = '美術資產尚未加入',
  motion = 'idle',
  motionEventId,
  motionPaused = false,
  onMotionComplete
}: GrowthArtworkStackProps) {
  const orderedLayers = orderLayers(layers)
  const orderedPreviousLayers = orderLayers(previousLayers)
  const resolvedEventId = motionEventId ?? `${layerSignature(previousLayers)}->${layerSignature(layers)}`
  const environment = useGrowthMotionEnvironment(motionPaused)
  const transformationRequested = motion === 'level_transition' || motion === 'form_metamorphosis'
  const loadBarrierEnabled = transformationRequested && orderedPreviousLayers.length > 0
  const targetBarrier = useGrowthArtworkLoadBarrier(
    `${resolvedEventId}:target:${layerSignature(layers)}`,
    orderedLayers.map(({ layer }) => layerAssetId(layer)),
    loadBarrierEnabled
  )
  const previousBarrier = useGrowthArtworkLoadBarrier(
    `${resolvedEventId}:previous:${layerSignature(previousLayers)}`,
    orderedPreviousLayers.map(({ layer }) => layerAssetId(layer)),
    loadBarrierEnabled
  )
  const transitionAssetsFailed = targetBarrier.status === 'failed' || previousBarrier.status === 'failed'
  const waitingForTransitionAssets = loadBarrierEnabled && !transitionAssetsFailed &&
    (targetBarrier.status === 'loading' || previousBarrier.status === 'loading')
  const lifecycleMotion: GrowthArtworkMotion = transitionAssetsFailed ? 'idle' : motion
  const transitionPlayState = environment.playState === 'paused' || waitingForTransitionAssets ? 'paused' : 'running'
  const lifecycle = useGrowthTransitionLifecycle({
    motion: orderedLayers.length > 0 ? lifecycleMotion : 'idle',
    eventId: resolvedEventId,
    hasPrevious: orderedPreviousLayers.length > 0 && !transitionAssetsFailed,
    paused: transitionPlayState === 'paused',
    reducedMotion: environment.reducedMotion && !waitingForTransitionAssets,
    onComplete: onMotionComplete
  })
  const completedFailureRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!transformationRequested || !transitionAssetsFailed) return
    const failureKey = `${motion}:${resolvedEventId}`
    if (completedFailureRef.current === failureKey) return
    completedFailureRef.current = failureKey
    onMotionComplete?.(motion, resolvedEventId, 'failed')
  }, [motion, onMotionComplete, resolvedEventId, transformationRequested, transitionAssetsFailed])
  const motionAttributes = {
    'data-growth-motion': lifecycle.activeMotion,
    'data-growth-motion-event': resolvedEventId,
    'data-growth-motion-play-state': transitionPlayState,
    'data-growth-reduced-motion': environment.reducedMotion,
    'data-growth-transition-active': lifecycle.transitionActive,
    'data-growth-target-status': targetBarrier.status,
    'data-growth-previous-status': previousBarrier.status
  }

  if (orderedLayers.length === 0) {
    return <div
      className={`growth-artwork-stack growth-artwork-stack--empty growth-motion-surface ${className}`.trim()}
      role="img"
      aria-label={`${label}；${emptyLabel}`}
      {...motionAttributes}
    >
      <span>{emptyLabel}</span>
    </div>
  }

  const renderSnapshot = (
    snapshot: 'previous' | 'current',
    snapshotLayers: typeof orderedLayers,
    loadBarrier?: GrowthArtworkLoadBarrier
  ) => <span
    className={`growth-motion-snapshot growth-motion-snapshot--${snapshot}`}
    aria-hidden="true"
    key={`${snapshot}:${resolvedEventId}`}
  >
    {snapshotLayers.map(({ layer }) => <img
        className={`growth-artwork-stack__layer growth-artwork-stack__layer--${layer.slot}`}
        src={layer.url}
        alt=""
        aria-hidden="true"
        loading={loadBarrier ? 'eager' : layer.loading ?? 'eager'}
        decoding="async"
        draggable={false}
        onLoad={loadBarrier ? (event) => loadBarrier.markLoaded(layerAssetId(layer), event.currentTarget) : undefined}
        onError={loadBarrier ? () => loadBarrier.markFailed(layerAssetId(layer)) : undefined}
        key={layer.id}
      />)}
  </span>

  return <figure
    className={`growth-artwork-stack growth-artwork-stack--motion-${lifecycle.activeMotion.replaceAll('_', '-')} growth-motion-surface ${className}`.trim()}
    role="img"
    aria-label={label}
    {...motionAttributes}
  >
    {lifecycle.showPrevious && renderSnapshot('previous', orderedPreviousLayers, previousBarrier)}
    {targetBarrier.status === 'failed' && previousBarrier.status !== 'failed'
      ? renderSnapshot('current', orderedPreviousLayers)
      : renderSnapshot('current', orderedLayers, targetBarrier)}
    {lifecycle.showCoreFlare && <span className="growth-motion-core-flare" aria-hidden="true" />}
  </figure>
}
