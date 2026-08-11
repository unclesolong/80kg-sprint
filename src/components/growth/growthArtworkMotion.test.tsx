// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  growthArtworkMotionForNotification,
  useGrowthMotionEnvironment,
  useGrowthTransitionLifecycle,
  type GrowthArtworkMotion
} from './growthArtworkMotion'

let reducedMotion = false
const mediaListeners = new Set<(event: MediaQueryListEvent) => void>()

const installMatchMedia = () => vi.stubGlobal('matchMedia', vi.fn().mockImplementation((media: string) => ({
  matches: reducedMotion,
  media,
  onchange: null,
  addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => mediaListeners.add(listener),
  removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => mediaListeners.delete(listener),
  addListener: (listener: (event: MediaQueryListEvent) => void) => mediaListeners.add(listener),
  removeListener: (listener: (event: MediaQueryListEvent) => void) => mediaListeners.delete(listener),
  dispatchEvent: () => true
})))

beforeEach(() => {
  vi.useFakeTimers()
  reducedMotion = false
  mediaListeners.clear()
  installMatchMedia()
  Object.defineProperty(document, 'hidden', { configurable: true, value: false })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function EnvironmentProbe({ paused = false }: { paused?: boolean }) {
  const environment = useGrowthMotionEnvironment(paused)
  return <output
    data-hidden={environment.documentHidden}
    data-reduced={environment.reducedMotion}
    data-play-state={environment.playState}
  />
}

interface LifecycleProbeProps {
  motion: GrowthArtworkMotion
  eventId: string
  paused?: boolean
  onComplete?: (motion: GrowthArtworkMotion, eventId: string) => void
}

function LifecycleProbe({ motion, eventId, paused = false, onComplete }: LifecycleProbeProps) {
  const lifecycle = useGrowthTransitionLifecycle({
    motion,
    eventId,
    paused,
    reducedMotion,
    hasPrevious: true,
    onComplete
  })
  return <output
    data-motion={lifecycle.activeMotion}
    data-active={lifecycle.transitionActive}
    data-previous={lifecycle.showPrevious}
    data-flare={lifecycle.showCoreFlare}
  />
}

describe('growth artwork motion contract', () => {
  it('maps XP, level and form notifications to distinct visual states', () => {
    expect(growthArtworkMotionForNotification('xp')).toBe('xp_pulse')
    expect(growthArtworkMotionForNotification('level')).toBe('level_transition')
    expect(growthArtworkMotionForNotification('form')).toBe('form_metamorphosis')
  })

  it('reports manual/document pause and reduced-motion independently', () => {
    const { rerender } = render(<EnvironmentProbe paused />)
    const output = screen.getByRole('status')
    expect(output.dataset.playState).toBe('paused')
    expect(output.dataset.reduced).toBe('false')

    rerender(<EnvironmentProbe />)
    expect(output.dataset.playState).toBe('running')

    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(output.dataset.hidden).toBe('true')
    expect(output.dataset.playState).toBe('paused')

    reducedMotion = true
    act(() => {
      mediaListeners.forEach((listener) => listener({ matches: true } as MediaQueryListEvent))
    })
    expect(output.dataset.reduced).toBe('true')
    expect(output.dataset.playState).toBe('paused')
  })

  it('pauses a level transition, then unmounts its previous snapshot after the remainder', () => {
    const onComplete = vi.fn()
    const { rerender } = render(<LifecycleProbe motion="level_transition" eventId="level-4" onComplete={onComplete} />)
    const output = screen.getByRole('status')

    expect(output.dataset.motion).toBe('level_transition')
    expect(output.dataset.previous).toBe('true')
    expect(output.dataset.flare).toBe('true')
    act(() => { vi.advanceTimersByTime(400) })
    rerender(<LifecycleProbe motion="level_transition" eventId="level-4" paused onComplete={onComplete} />)
    act(() => { vi.advanceTimersByTime(5_000) })
    expect(onComplete).not.toHaveBeenCalled()

    rerender(<LifecycleProbe motion="level_transition" eventId="level-4" onComplete={onComplete} />)
    act(() => { vi.advanceTimersByTime(649) })
    expect(onComplete).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(onComplete).toHaveBeenCalledWith('level_transition', 'level-4')
    expect(output.dataset.motion).toBe('idle')
    expect(output.dataset.previous).toBe('false')
  })

  it('skips the old bitmap and finishes immediately for reduced motion', () => {
    reducedMotion = true
    const onComplete = vi.fn()
    render(<LifecycleProbe motion="form_metamorphosis" eventId="form-4" onComplete={onComplete} />)
    const output = screen.getByRole('status')

    expect(output.dataset.motion).toBe('idle')
    expect(output.dataset.previous).toBe('false')
    expect(output.dataset.flare).toBe('false')
    expect(onComplete).toHaveBeenCalledWith('form_metamorphosis', 'form-4')
  })

  it('reports reduced-motion completion exactly once under StrictMode effect replay', () => {
    reducedMotion = true
    const onComplete = vi.fn()
    render(<StrictMode><LifecycleProbe motion="level_transition" eventId="strict-level" onComplete={onComplete} /></StrictMode>)

    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith('level_transition', 'strict-level')
  })

  it('replays a completed motion only when a new event ID arrives', () => {
    const onComplete = vi.fn()
    const { rerender } = render(<LifecycleProbe motion="xp_pulse" eventId="xp-1" onComplete={onComplete} />)
    const output = screen.getByRole('status')
    act(() => { vi.advanceTimersByTime(720) })
    expect(output.dataset.motion).toBe('idle')

    rerender(<LifecycleProbe motion="xp_pulse" eventId="xp-1" onComplete={onComplete} />)
    expect(output.dataset.motion).toBe('idle')
    rerender(<LifecycleProbe motion="xp_pulse" eventId="xp-2" onComplete={onComplete} />)
    expect(output.dataset.motion).toBe('xp_pulse')
  })
})
