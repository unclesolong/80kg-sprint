import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useGrowthMotionEnvironment } from './growthArtworkMotion'
import { GROWTH_STAGE_ANIMATION_PROFILES } from './growthStageAnimationManifest'
import type { GrowthNode } from './types'
import './growthStageAnimation.css'

export interface GrowthStageAnimationProps {
  node: GrowthNode
  atlasUrl: string
  posterUrl: string
  label: string
  className?: string
  paused?: boolean
}

type AtlasStatus = 'poster' | 'loading' | 'ready' | 'failed'

export function GrowthStageAnimation({
  node,
  atlasUrl,
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
  const [atlasStatus, setAtlasStatus] = useState<AtlasStatus>(() =>
    environment.reducedMotion || !profile ? 'poster' : 'loading'
  )

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
  }, [atlasUrl, environment.reducedMotion, isVideo, profile])

  const playbackAllowed = inViewport && environment.playState === 'running' && !environment.reducedMotion
  const running = atlasStatus === 'ready' && playbackAllowed
  const shouldPlayVideo = isVideo && playbackAllowed && atlasStatus !== 'failed' && atlasStatus !== 'poster'
  const frameStyle = atlasStatus === 'ready' && profile?.format === 'atlas'
    ? {
        '--growth-stage-atlas': `url("${atlasUrl.replaceAll('"', '%22')}")`,
        '--growth-stage-duration': `${profile.durationMs}ms`,
        '--growth-stage-delay': `${Math.round(-profile.durationMs * profile.phaseOffset)}ms`
      } as CSSProperties
    : undefined

  useEffect(() => {
    const video = videoRef.current
    if (!isVideo || !video) return
    if (!shouldPlayVideo) {
      video.pause()
      return
    }

    try {
      const playAttempt = video.play()
      if (playAttempt) void playAttempt.catch(() => setAtlasStatus('failed'))
    } catch {
      setAtlasStatus('failed')
    }
  }, [atlasUrl, isVideo, shouldPlayVideo])

  return <figure
    ref={surfaceRef}
    className={`growth-artwork-stack growth-stage-animation ${className}`.trim()}
    role="img"
    aria-label={label}
    data-growth-stage-node={node}
    data-growth-stage-status={atlasStatus}
    data-growth-scene-composition={profile?.format === 'video' ? profile.sceneComposition : 'poster_only'}
    data-growth-motion-play-state={running ? 'running' : 'paused'}
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
      key={atlasUrl}
      ref={videoRef}
      className="growth-stage-animation__video"
      src={atlasUrl}
      poster={posterUrl}
      muted
      loop
      playsInline
      autoPlay={playbackAllowed}
      preload="auto"
      aria-hidden="true"
      onLoadedData={() => setAtlasStatus('ready')}
      onCanPlay={() => setAtlasStatus('ready')}
      onError={() => setAtlasStatus('failed')}
    />}
    {!isVideo && atlasStatus === 'ready' && <span
      className="growth-stage-animation__frames"
      style={frameStyle}
      aria-hidden="true"
    />}
  </figure>
}
