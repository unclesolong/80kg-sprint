import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useGrowthMotionEnvironment } from './growthArtworkMotion'
import {
  GROWTH_STAGE_ANIMATION_PROFILES,
  resolveGrowthAmbientEffectSpriteUrl
} from './growthStageAnimationManifest'
import {
  advanceGrowthStageMotionSchedule,
  createGrowthStageMotionSchedule,
  permitsGrowthStageSecondaryPrewarm,
  type GrowthStageMotionSchedule
} from './growthStageMotionScheduler'
import { GrowthAmbientStars } from './GrowthAmbientStars'
import type { GrowthNode } from './types'
import './growthStageAnimation.css'

export interface GrowthStageAnimationProps {
  node: GrowthNode
  atlasUrl: string
  /** Optional authored action played between deterministic runs of the primary clip. */
  secondaryAtlasUrl?: string
  posterUrl: string
  label: string
  className?: string
  paused?: boolean
}

type AtlasStatus = 'poster' | 'loading' | 'ready' | 'failed'
type SecondaryPrewarmStatus = 'idle' | 'loading' | 'ready' | 'failed'

interface GrowthNetworkInformation {
  saveData?: boolean
  effectiveType?: string
  addEventListener?: (type: 'change', listener: () => void) => void
  removeEventListener?: (type: 'change', listener: () => void) => void
}

interface SecondaryPrewarmRequest {
  identity: string
  controller: AbortController
}

const getGrowthNetworkInformation = (): GrowthNetworkInformation | undefined =>
  typeof navigator === 'undefined'
    ? undefined
    : (navigator as Navigator & { connection?: GrowthNetworkInformation }).connection

const readsSecondaryPrewarmPermission = (): boolean => {
  const connection = getGrowthNetworkInformation()
  const prefersReducedData = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-data: reduce)').matches
  return permitsGrowthStageSecondaryPrewarm({
    saveData: connection?.saveData,
    effectiveType: connection?.effectiveType,
    prefersReducedData
  })
}

const isAbortError = (error: unknown): boolean => error instanceof DOMException
  ? error.name === 'AbortError'
  : typeof error === 'object' && error != null && 'name' in error && error.name === 'AbortError'

export function GrowthStageAnimation({
  node,
  atlasUrl,
  secondaryAtlasUrl,
  posterUrl,
  label,
  className = '',
  paused = false
}: GrowthStageAnimationProps) {
  const surfaceRef = useRef<HTMLElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [inViewport, setInViewport] = useState(true)
  const environment = useGrowthMotionEnvironment(paused)
  const profile = GROWTH_STAGE_ANIMATION_PROFILES[node]
  const isVideo = profile?.format === 'video'
  const scheduleIdentity = `${node}:${atlasUrl}:${secondaryAtlasUrl ?? ''}`
  const [motionScheduleState, setMotionScheduleState] = useState<{
    identity: string
    schedule: GrowthStageMotionSchedule
  }>(() => ({ identity: scheduleIdentity, schedule: createGrowthStageMotionSchedule(node) }))
  const motionSchedule = motionScheduleState.identity === scheduleIdentity
    ? motionScheduleState.schedule
    : createGrowthStageMotionSchedule(node)
  const [failedSecondaryIdentity, setFailedSecondaryIdentity] = useState<string>()
  const [secondaryPrewarmState, setSecondaryPrewarmState] = useState<{
    identity: string
    status: SecondaryPrewarmStatus
  }>(() => ({ identity: scheduleIdentity, status: 'idle' }))
  const secondaryPrewarmStatus = secondaryPrewarmState.identity === scheduleIdentity
    ? secondaryPrewarmState.status
    : 'idle'
  const secondaryPrewarmRequestRef = useRef<SecondaryPrewarmRequest | undefined>(undefined)
  const [secondaryPrewarmPermitted, setSecondaryPrewarmPermitted] = useState(readsSecondaryPrewarmPermission)
  const secondaryAvailable = isVideo
    && Boolean(secondaryAtlasUrl)
    && failedSecondaryIdentity !== scheduleIdentity
  const activeMotion = secondaryAvailable ? motionSchedule.motion : 'primary'
  const activeVideoUrl = activeMotion === 'secondary' ? secondaryAtlasUrl! : atlasUrl
  const activeVideoUrlRef = useRef(activeVideoUrl)
  activeVideoUrlRef.current = activeVideoUrl
  const [playbackRevision, setPlaybackRevision] = useState(0)
  const hasAmbientStars = profile?.format === 'video'
    && profile.sceneComposition === 'embedded_habitat'
    && profile.ambientEffect === 'star_tide_perimeter_v1'
  const [atlasStatus, setAtlasStatus] = useState<AtlasStatus>(() =>
    environment.reducedMotion || !profile ? 'poster' : 'loading'
  )

  useEffect(() => {
    setMotionScheduleState((current) => current.identity === scheduleIdentity
      ? current
      : { identity: scheduleIdentity, schedule: createGrowthStageMotionSchedule(node) })
  }, [node, scheduleIdentity])

  useEffect(() => {
    const connection = getGrowthNetworkInformation()
    const reducedDataQuery = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-data: reduce)')
      : undefined
    const updatePermission = () => setSecondaryPrewarmPermitted(readsSecondaryPrewarmPermission())
    updatePermission()
    connection?.addEventListener?.('change', updatePermission)
    reducedDataQuery?.addEventListener?.('change', updatePermission)
    return () => {
      connection?.removeEventListener?.('change', updatePermission)
      reducedDataQuery?.removeEventListener?.('change', updatePermission)
    }
  }, [])

  useEffect(() => {
    if (typeof IntersectionObserver !== 'function' || !surfaceRef.current) return
    const observer = new IntersectionObserver(([entry]) => setInViewport(entry.isIntersecting), {
      rootMargin: '80px',
      threshold: 0.05
    })
    observer.observe(surfaceRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (environment.reducedMotion || !profile) {
      setAtlasStatus('poster')
      return
    }

    setAtlasStatus('loading')
    if (isVideo) return

    let active = true
    const image = new Image()
    image.onload = () => {
      const ready = () => { if (active) setAtlasStatus('ready') }
      if (typeof image.decode === 'function') void image.decode().catch(() => undefined).then(ready)
      else ready()
    }
    image.onerror = () => { if (active) setAtlasStatus('failed') }
    image.src = atlasUrl
    return () => {
      active = false
      image.onload = null
      image.onerror = null
    }
  }, [atlasUrl, environment.reducedMotion, isVideo, profile, secondaryAtlasUrl])

  const playbackAllowed = inViewport && environment.playState === 'running' && !environment.reducedMotion
  const running = atlasStatus === 'ready' && playbackAllowed
  const shouldPlayVideo = isVideo && playbackAllowed && atlasStatus !== 'failed' && atlasStatus !== 'poster'
  const shouldPlayVideoRef = useRef(shouldPlayVideo)
  shouldPlayVideoRef.current = shouldPlayVideo
  const frameStyle = atlasStatus === 'ready' && profile?.format === 'atlas'
    ? {
        '--growth-stage-atlas': `url("${atlasUrl.replaceAll('"', '%22')}")`,
        '--growth-stage-duration': `${profile.durationMs}ms`,
        '--growth-stage-delay': `${Math.round(-profile.durationMs * profile.phaseOffset)}ms`
      } as CSSProperties
    : undefined

  const recoverFromVideoFailure = useCallback((failedMotion: 'primary' | 'secondary') => {
    if (failedMotion === 'secondary' && secondaryAvailable) {
      setFailedSecondaryIdentity(scheduleIdentity)
      setMotionScheduleState({
        identity: scheduleIdentity,
        schedule: createGrowthStageMotionSchedule(node)
      })
      setAtlasStatus('loading')
      return
    }
    setAtlasStatus('failed')
  }, [node, scheduleIdentity, secondaryAvailable])

  const primaryCyclesUntilSecondary = motionSchedule.primaryCycleTarget - motionSchedule.primaryCyclesCompleted
  const secondaryPrewarmEligible = secondaryAvailable
    && activeMotion === 'primary'
    && primaryCyclesUntilSecondary <= 2
    && playbackAllowed
    && secondaryPrewarmPermitted

  useEffect(() => {
    const activeRequest = secondaryPrewarmRequestRef.current
    if (activeRequest && activeRequest.identity !== scheduleIdentity) {
      activeRequest.controller.abort()
      secondaryPrewarmRequestRef.current = undefined
    }

    if (!secondaryPrewarmEligible || !secondaryAtlasUrl) {
      const request = secondaryPrewarmRequestRef.current
      if (request) {
        request.controller.abort()
        secondaryPrewarmRequestRef.current = undefined
      }
      setSecondaryPrewarmState((current) => current.identity === scheduleIdentity && current.status === 'loading'
        ? { identity: scheduleIdentity, status: 'idle' }
        : current)
      return
    }

    if (secondaryPrewarmStatus !== 'idle' || typeof fetch !== 'function') return

    const controller = new AbortController()
    const request = { identity: scheduleIdentity, controller }
    secondaryPrewarmRequestRef.current = request
    setSecondaryPrewarmState({ identity: scheduleIdentity, status: 'loading' })

    void fetch(secondaryAtlasUrl, { signal: controller.signal })
      .then(async (response) => {
        if (response.status !== 200) throw new Error(`Secondary motion prewarm returned ${response.status}`)
        await response.arrayBuffer()
      })
      .then(() => {
        if (secondaryPrewarmRequestRef.current !== request || controller.signal.aborted) return
        secondaryPrewarmRequestRef.current = undefined
        setSecondaryPrewarmState({ identity: scheduleIdentity, status: 'ready' })
      })
      .catch((error: unknown) => {
        if (secondaryPrewarmRequestRef.current !== request) return
        secondaryPrewarmRequestRef.current = undefined
        if (controller.signal.aborted || isAbortError(error)) return
        setSecondaryPrewarmState({ identity: scheduleIdentity, status: 'failed' })
      })
  }, [scheduleIdentity, secondaryAtlasUrl, secondaryPrewarmEligible, secondaryPrewarmStatus])

  useEffect(() => () => {
    secondaryPrewarmRequestRef.current?.controller.abort()
    secondaryPrewarmRequestRef.current = undefined
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!isVideo || !video) return
    if (!shouldPlayVideo) {
      video.pause()
      return
    }

    try {
      const expectedUrl = activeVideoUrl
      const expectedMotion = activeMotion
      const playAttempt = video.play()
      if (playAttempt) void playAttempt.catch((error: unknown) => {
        if (isAbortError(error)
          || !shouldPlayVideoRef.current
          || videoRef.current !== video
          || activeVideoUrlRef.current !== expectedUrl) return
        recoverFromVideoFailure(expectedMotion)
      })
    } catch (error: unknown) {
      if (isAbortError(error)
        || !shouldPlayVideoRef.current
        || videoRef.current !== video
        || activeVideoUrlRef.current !== activeVideoUrl) return
      recoverFromVideoFailure(activeMotion)
    }
  }, [activeMotion, activeVideoUrl, isVideo, playbackRevision, recoverFromVideoFailure, shouldPlayVideo])

  const handleVideoEnded = () => {
    if (!secondaryAvailable) return
    const nextSchedule = advanceGrowthStageMotionSchedule(
      node,
      motionSchedule,
      secondaryPrewarmStatus === 'ready'
    )
    const changesSource = nextSchedule.motion !== motionSchedule.motion
    setMotionScheduleState({ identity: scheduleIdentity, schedule: nextSchedule })
    if (changesSource) setAtlasStatus('loading')
    else if (videoRef.current) videoRef.current.currentTime = 0
    setPlaybackRevision((revision) => revision + 1)
  }

  return <figure
    ref={surfaceRef}
    className={`growth-artwork-stack growth-stage-animation ${className}`.trim()}
    role="img"
    aria-label={label}
    data-growth-stage-node={node}
    data-growth-stage-status={atlasStatus}
    data-growth-scene-composition={profile?.format === 'video' ? profile.sceneComposition : 'poster_only'}
    data-growth-motion-play-state={running ? 'running' : 'paused'}
    data-growth-authored-motion={isVideo ? activeMotion : 'primary'}
    data-growth-primary-cycle={`${motionSchedule.primaryCyclesCompleted}/${motionSchedule.primaryCycleTarget}`}
    data-growth-secondary-prewarm={secondaryAvailable ? secondaryPrewarmStatus : 'unavailable'}
    data-growth-reduced-motion={environment.reducedMotion}
  >
    <span
      className="growth-stage-animation__visual"
      aria-hidden="true"
      data-growth-stage-node={node}
      data-growth-stage-status={atlasStatus}
      data-growth-scene-composition={profile?.format === 'video' ? profile.sceneComposition : 'poster_only'}
      data-growth-motion-play-state={running ? 'running' : 'paused'}
      data-growth-authored-motion={isVideo ? activeMotion : 'primary'}
      data-growth-reduced-motion={environment.reducedMotion}
    >
      <img
        className="growth-stage-animation__poster"
        src={posterUrl}
        alt=""
        aria-hidden="true"
        loading="eager"
        decoding="async"
        draggable={false}
      />
      {isVideo && !environment.reducedMotion && atlasStatus !== 'failed' && <video
        key={activeVideoUrl}
        ref={videoRef}
        className="growth-stage-animation__video"
        src={activeVideoUrl}
        poster={posterUrl}
        muted
        loop={!secondaryAvailable}
        playsInline
        autoPlay={playbackAllowed}
        preload="auto"
        aria-hidden="true"
        onLoadedData={() => setAtlasStatus('ready')}
        onCanPlay={() => setAtlasStatus('ready')}
        onEnded={handleVideoEnded}
        onError={() => recoverFromVideoFailure(activeMotion)}
      />}
      {!isVideo && atlasStatus === 'ready' && <span
        className="growth-stage-animation__frames"
        style={frameStyle}
        aria-hidden="true"
      />}
      {hasAmbientStars && atlasStatus !== 'failed' && !environment.reducedMotion && <GrowthAmbientStars
        node={node}
        spriteUrl={resolveGrowthAmbientEffectSpriteUrl()}
      />}
    </span>
  </figure>
}
