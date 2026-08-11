import { ArrowRight, Sparkles, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { GrowthNotification as GrowthNotificationModel, GrowthNotificationKind } from '../viewModels/growthNotification'
import {
  growthArtworkMotionForNotification,
  useGrowthArtworkLoadBarrier,
  useGrowthMotionEnvironment,
  useGrowthTransitionLifecycle
} from './growth/growthArtworkMotion'
import './growth/growthArtworkMotion.css'

export const GROWTH_NOTIFICATION_AUTO_DISMISS_MS: Readonly<Record<GrowthNotificationKind, number | null>> = {
  xp: 5_000,
  level: 8_000,
  form: null
}

export interface GrowthNotificationProps {
  notice?: GrowthNotificationModel | null
  onDismiss: () => void
  onOpenGrowth?: () => void
  /** Hide and pause the notice when another surface would cover it. */
  occluded?: boolean
  /** Alias kept explicit for App call sites that already know modal state. */
  modalOpen?: boolean
}

export function GrowthNotification({
  notice,
  onDismiss,
  onOpenGrowth,
  occluded = false,
  modalOpen = false
}: GrowthNotificationProps) {
  const titleId = useId()
  const messageId = useId()
  const onDismissRef = useRef(onDismiss)
  const cardRef = useRef<HTMLElement | null>(null)
  const remainingMsRef = useRef<number | null>(null)
  const [hovered, setHovered] = useState(false)
  const [focusWithin, setFocusWithin] = useState(false)

  useEffect(() => { onDismissRef.current = onDismiss }, [onDismiss])

  const autoDismissMs = notice ? GROWTH_NOTIFICATION_AUTO_DISMISS_MS[notice.kind] : null
  const hidden = occluded || modalOpen
  const environment = useGrowthMotionEnvironment(hidden || hovered || focusWithin)
  const requestedArtworkMotion = notice ? growthArtworkMotionForNotification(notice.kind) : 'idle'
  const transformationRequested = requestedArtworkMotion === 'level_transition' || requestedArtworkMotion === 'form_metamorphosis'
  const loadBarrierEnabled = Boolean(notice) && transformationRequested
  const targetAssetId = notice?.artworkUrl ?? 'no-target-artwork'
  const previousAssetId = notice?.previousArtworkUrl ?? 'no-previous-artwork'
  const targetBarrier = useGrowthArtworkLoadBarrier(
    `${notice?.id ?? 'no-growth-notice'}:target:${targetAssetId}`,
    notice ? [targetAssetId] : [],
    loadBarrierEnabled
  )
  const previousBarrier = useGrowthArtworkLoadBarrier(
    `${notice?.id ?? 'no-growth-notice'}:previous:${previousAssetId}`,
    notice?.previousArtworkUrl ? [previousAssetId] : [],
    loadBarrierEnabled
  )
  const transitionAssetsFailed = targetBarrier.status === 'failed' || previousBarrier.status === 'failed'
  const waitingForTransitionAssets = loadBarrierEnabled && !transitionAssetsFailed &&
    (targetBarrier.status === 'loading' || previousBarrier.status === 'loading')
  const resolvedArtworkMotion = transitionAssetsFailed ? 'idle' : requestedArtworkMotion
  const transitionPlayState = environment.playState === 'paused' || waitingForTransitionAssets ? 'paused' : 'running'
  const artworkLifecycle = useGrowthTransitionLifecycle({
    motion: resolvedArtworkMotion,
    eventId: notice?.id ?? 'no-growth-notice',
    hasPrevious: Boolean(notice?.previousArtworkUrl) && !transitionAssetsFailed,
    paused: transitionPlayState === 'paused',
    reducedMotion: environment.reducedMotion && !waitingForTransitionAssets
  })
  const paused = hidden || hovered || focusWithin || environment.documentHidden || waitingForTransitionAssets

  useEffect(() => {
    const card = cardRef.current
    setHovered(Boolean(card && !hidden && card.matches(':hover')))
    setFocusWithin(Boolean(card && !hidden && card.contains(document.activeElement)))
  }, [hidden, notice?.id])

  useEffect(() => {
    remainingMsRef.current = autoDismissMs
  }, [notice?.id, autoDismissMs])

  useEffect(() => {
    const remainingMs = remainingMsRef.current
    if (!notice || remainingMs == null || paused) return

    const startedAt = Date.now()
    const timeout = window.setTimeout(() => {
      remainingMsRef.current = 0
      onDismissRef.current()
    }, remainingMs)

    return () => {
      window.clearTimeout(timeout)
      remainingMsRef.current = Math.max(0, remainingMs - (Date.now() - startedAt))
    }
  }, [notice?.id, autoDismissMs, paused])

  const canOpenGrowth = notice?.kind !== 'xp' && onOpenGrowth != null
  const isVisible = notice != null && !hidden

  const artworkMotionAttributes = {
    'data-growth-motion': artworkLifecycle.activeMotion,
    'data-growth-motion-event': notice?.id,
    'data-growth-motion-play-state': transitionPlayState,
    'data-growth-reduced-motion': environment.reducedMotion,
    'data-growth-transition-active': artworkLifecycle.transitionActive,
    'data-growth-target-status': targetBarrier.status,
    'data-growth-previous-status': previousBarrier.status
  }

  return <div
    className="growth-notification-host"
    data-notification-kind={notice?.kind}
    {...artworkMotionAttributes}
  >
    <p
      className="growth-notification-live sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >{isVisible ? notice.announcement : ''}</p>

    {notice ? <section
      ref={cardRef}
      key={notice.id}
      className={`growth-notification-card growth-notification-card--${notice.kind}`}
      aria-labelledby={titleId}
      aria-describedby={messageId}
      hidden={hidden}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocusWithin(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocusWithin(false)
      }}
    >
      <span className="growth-notification-artwork growth-motion-surface" aria-hidden="true" {...artworkMotionAttributes}>
        {artworkLifecycle.showPrevious && <span
          className="growth-motion-snapshot growth-motion-snapshot--previous"
          key={`previous:${notice.id}`}
        ><img
          src={notice.previousArtworkUrl}
          alt=""
          loading="eager"
          decoding="async"
          draggable={false}
          onLoad={(event) => previousBarrier.markLoaded(previousAssetId, event.currentTarget)}
          onError={() => previousBarrier.markFailed(previousAssetId)}
        /></span>}
        <span
          className="growth-motion-snapshot growth-motion-snapshot--current"
          key={`current:${notice.id}`}
        >{targetBarrier.status === 'failed' && previousBarrier.status !== 'failed'
          ? <img src={notice.previousArtworkUrl} alt="" loading="eager" decoding="async" draggable={false} />
          : <img
              src={notice.artworkUrl}
              alt=""
              loading="eager"
              decoding="async"
              draggable={false}
              onLoad={(event) => targetBarrier.markLoaded(targetAssetId, event.currentTarget)}
              onError={() => targetBarrier.markFailed(targetAssetId)}
            />}</span>
        {artworkLifecycle.showCoreFlare && <span className="growth-motion-core-flare" />}
      </span>
      <div className="growth-notification-copy">
        <span className="growth-notification-kicker"><Sparkles aria-hidden="true" /> 潤光成長</span>
        <strong id={titleId} className="growth-notification-title">{notice.title}</strong>
        <p id={messageId} className="growth-notification-message">{notice.message}</p>
        {canOpenGrowth ? <button
          className="growth-notification-open"
          type="button"
          onClick={onOpenGrowth}
        >查看潤光 <ArrowRight aria-hidden="true" /></button> : null}
      </div>
      <button
        className="growth-notification-close"
        type="button"
        aria-label="關閉潤光通知"
        onClick={onDismiss}
      ><X aria-hidden="true" /></button>
    </section> : null}
  </div>
}
