import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { GrowthNotificationKind } from '../../viewModels/growthNotification'

export type GrowthArtworkMotion = 'idle' | 'xp_pulse' | 'level_transition' | 'form_metamorphosis'
export type GrowthMotionPlayState = 'running' | 'paused'

export const GROWTH_ARTWORK_MOTION_DURATION_MS: Readonly<Record<GrowthArtworkMotion, number | null>> = {
  idle: null,
  xp_pulse: 720,
  level_transition: 1_050,
  form_metamorphosis: 1_450
}

/** Prevents a missing browser load/error event from freezing the motion and notice timers forever. */
export const GROWTH_ARTWORK_LOAD_TIMEOUT_MS = 6_000

export const growthArtworkMotionForNotification = (kind: GrowthNotificationKind): GrowthArtworkMotion => {
  if (kind === 'form') return 'form_metamorphosis'
  if (kind === 'level') return 'level_transition'
  return 'xp_pulse'
}

export interface GrowthMotionEnvironment {
  documentHidden: boolean
  reducedMotion: boolean
  playState: GrowthMotionPlayState
}

const readsReducedMotion = (): boolean => typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Shares one explicit animation policy between the full artwork and its notification preview. */
export const useGrowthMotionEnvironment = (manuallyPaused = false): GrowthMotionEnvironment => {
  const [documentHidden, setDocumentHidden] = useState(() => typeof document !== 'undefined' && document.hidden)
  const [reducedMotion, setReducedMotion] = useState(readsReducedMotion)

  useEffect(() => {
    const onVisibilityChange = () => setDocumentHidden(document.hidden)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches)
    setReducedMotion(query.matches)
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', onChange)
      return () => query.removeEventListener('change', onChange)
    }
    query.addListener(onChange)
    return () => query.removeListener(onChange)
  }, [])

  return {
    documentHidden,
    reducedMotion,
    playState: manuallyPaused || documentHidden ? 'paused' : 'running'
  }
}

export interface GrowthTransitionLifecycleOptions {
  motion: GrowthArtworkMotion
  eventId: string
  hasPrevious: boolean
  paused: boolean
  reducedMotion: boolean
  onComplete?: (motion: GrowthArtworkMotion, eventId: string) => void
}

export interface GrowthTransitionLifecycle {
  activeMotion: GrowthArtworkMotion
  transitionActive: boolean
  showPrevious: boolean
  showCoreFlare: boolean
}

export type GrowthArtworkTargetStatus = 'loading' | 'ready' | 'failed'

export interface GrowthArtworkLoadBarrier {
  status: GrowthArtworkTargetStatus
  markLoaded: (assetId: string, image: HTMLImageElement) => void
  markFailed: (assetId: string) => void
}

interface GrowthArtworkLoadBarrierState {
  key: string
  loadedIds: string[]
  failed: boolean
}

/**
 * Holds a stage transition until every target bitmap has loaded and decoded.
 * A load event is accepted when decode() is unavailable or rejects after the
 * browser has already confirmed a successful image load.
 */
export const useGrowthArtworkLoadBarrier = (
  key: string,
  expectedAssetIds: readonly string[],
  enabled: boolean
): GrowthArtworkLoadBarrier => {
  const [state, setState] = useState<GrowthArtworkLoadBarrierState>(() => ({ key, loadedIds: [], failed: false }))
  const activeKeyRef = useRef(key)
  const expectedIds = [...new Set(expectedAssetIds)]
  const currentState = state.key === key ? state : { key, loadedIds: [], failed: false }
  const status: GrowthArtworkTargetStatus = !enabled || expectedIds.length === 0
    ? 'ready'
    : currentState.failed
      ? 'failed'
      : expectedIds.every((assetId) => currentState.loadedIds.includes(assetId)) ? 'ready' : 'loading'

  useLayoutEffect(() => {
    activeKeyRef.current = key
    setState((current) => current.key === key ? current : { key, loadedIds: [], failed: false })
  }, [key])

  useEffect(() => {
    if (!enabled || status !== 'loading') return
    const timeout = window.setTimeout(() => {
      setState((current) => {
        if (activeKeyRef.current !== key) return current
        const matching = current.key === key ? current : { key, loadedIds: [], failed: false }
        return { ...matching, failed: true }
      })
    }, GROWTH_ARTWORK_LOAD_TIMEOUT_MS)
    return () => window.clearTimeout(timeout)
  }, [enabled, key, status])

  const recordLoaded = (assetId: string) => setState((current) => {
    if (activeKeyRef.current !== key) return current
    const matching = current.key === key ? current : { key, loadedIds: [], failed: false }
    if (matching.loadedIds.includes(assetId)) return matching
    return { ...matching, loadedIds: [...matching.loadedIds, assetId] }
  })

  const markLoaded = (assetId: string, image: HTMLImageElement) => {
    if (typeof image.decode !== 'function') {
      recordLoaded(assetId)
      return
    }
    void image.decode().catch(() => undefined).then(() => recordLoaded(assetId))
  }

  const markFailed = (assetId: string) => setState((current) => {
    if (activeKeyRef.current !== key) return current
    const matching = current.key === key ? current : { key, loadedIds: [], failed: false }
    return { ...matching, failed: true, loadedIds: matching.loadedIds.filter((id) => id !== assetId) }
  })

  return { status, markLoaded, markFailed }
}

/**
 * Runs a pausable, one-shot transition. Once it completes, `activeMotion`
 * returns to idle and `showPrevious` becomes false so the old bitmap unmounts.
 * A unique eventId is required to replay the same motion consecutively.
 */
export const useGrowthTransitionLifecycle = ({
  motion,
  eventId,
  hasPrevious,
  paused,
  reducedMotion,
  onComplete
}: GrowthTransitionLifecycleOptions): GrowthTransitionLifecycle => {
  const eventKey = `${motion}:${eventId}`
  const duration = GROWTH_ARTWORK_MOTION_DURATION_MS[motion]
  const [completedEventKey, setCompletedEventKey] = useState<string>()
  const remainingMsRef = useRef<number | null>(duration)
  const onCompleteRef = useRef(onComplete)
  const completionReportedRef = useRef<string | undefined>(undefined)

  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])

  useEffect(() => {
    remainingMsRef.current = duration
  }, [duration, eventKey])

  const isTransformation = motion === 'level_transition' || motion === 'form_metamorphosis'
  const transitionRequested = duration != null && (!isTransformation || hasPrevious)
  const transitionActive = transitionRequested && completedEventKey !== eventKey && !reducedMotion

  useEffect(() => {
    if (transitionRequested) return
    completionReportedRef.current = undefined
    setCompletedEventKey(undefined)
  }, [eventKey, transitionRequested])

  useEffect(() => {
    if (!transitionRequested || !reducedMotion || completedEventKey === eventKey) return
    if (completionReportedRef.current === eventKey) return
    completionReportedRef.current = eventKey
    remainingMsRef.current = 0
    setCompletedEventKey(eventKey)
    onCompleteRef.current?.(motion, eventId)
  }, [completedEventKey, eventId, eventKey, motion, reducedMotion, transitionRequested])

  useEffect(() => {
    const remainingMs = remainingMsRef.current
    if (!transitionActive || paused || remainingMs == null) return

    const startedAt = Date.now()
    const timeout = window.setTimeout(() => {
      if (completionReportedRef.current === eventKey) return
      completionReportedRef.current = eventKey
      remainingMsRef.current = 0
      setCompletedEventKey(eventKey)
      onCompleteRef.current?.(motion, eventId)
    }, remainingMs)

    return () => {
      window.clearTimeout(timeout)
      remainingMsRef.current = Math.max(0, remainingMs - (Date.now() - startedAt))
    }
  }, [eventId, eventKey, motion, paused, transitionActive])

  return {
    activeMotion: transitionActive ? motion : 'idle',
    transitionActive,
    showPrevious: transitionActive && isTransformation && hasPrevious,
    showCoreFlare: transitionActive && isTransformation
  }
}
