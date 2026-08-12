// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getGrowthCompanionReactionSequence,
  GROWTH_COMPANION_HITBOXES,
  GROWTH_COMPANION_REACTIONS,
  GROWTH_COMPANION_SPEECH_COOLDOWN_MS,
  GROWTH_COMPANION_SPEECH_VISIBLE_MS,
  GrowthCompanionSpeech
} from './GrowthCompanionSpeech'
import type { GrowthNode } from './types'

const originalIntersectionObserver = globalThis.IntersectionObserver

const renderSpeech = (node: GrowthNode = 2, paused = false) => render(
  <GrowthCompanionSpeech node={node} companionLabel="潤光" paused={paused}>
    <figure role="img" aria-label={`潤光第 ${node} 階`}><span /></figure>
  </GrowthCompanionSpeech>
)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
  Object.defineProperty(document, 'hidden', { configurable: true, value: false })
  vi.stubGlobal('IntersectionObserver', undefined)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  if (originalIntersectionObserver) vi.stubGlobal('IntersectionObserver', originalIntersectionObserver)
})

describe('GrowthCompanionSpeech', () => {
  it('authors ten distinct fictional reactions in one deterministic no-repeat cycle', () => {
    expect(GROWTH_COMPANION_REACTIONS).toHaveLength(10)
    expect(new Set(GROWTH_COMPANION_REACTIONS.map((reaction) => reaction.id)).size).toBe(10)
    expect(new Set(GROWTH_COMPANION_REACTIONS.map((reaction) => reaction.utterance)).size).toBe(10)
    expect(GROWTH_COMPANION_REACTIONS.every((reaction) => reaction.accessibleLabel.startsWith('潤光'))).toBe(true)

    const sequence = getGrowthCompanionReactionSequence()
    expect(sequence.map((reaction) => reaction.id)).toEqual([
      'touch_affection',
      'touch_bounce',
      'touch_shy',
      'touch_sleepy',
      'touch_sparkle',
      'touch_humming',
      'touch_cheer',
      'touch_greeting',
      'touch_curious',
      'touch_love'
    ])
    expect(new Set(sequence.map((reaction) => reaction.id)).size).toBe(10)
  })

  it('provides a silhouette-sized native target for every one of the twelve stages', () => {
    expect(Object.keys(GROWTH_COMPANION_HITBOXES).map(Number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])

    for (let node = 1 as GrowthNode; node <= 12; node = (node + 1) as GrowthNode) {
      const { unmount } = renderSpeech(node)
      const button = screen.getByRole('button', { name: '和潤光互動' })
      expect(button.tagName).toBe('BUTTON')
      expect(button.getAttribute('type')).toBe('button')
      expect(button.closest('[role="img"]')).toBeNull()
      expect(button.getAttribute('style')).toContain(`--growth-speech-left: ${GROWTH_COMPANION_HITBOXES[node].leftPercent}%`)
      expect(GROWTH_COMPANION_HITBOXES[node].widthPercent).toBeGreaterThanOrEqual(32)
      expect(GROWTH_COMPANION_HITBOXES[node].widthPercent).toBeLessThan(100)
      unmount()
    }
  })

  it('shows only mysterious speech visually and announces a natural description once', () => {
    const { container } = renderSpeech(2)
    const status = screen.getByRole('status')
    expect(status.textContent).toBe('')
    expect(screen.getByText('輕觸潤光，它會回應你')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '和潤光互動' }))

    const reaction = getGrowthCompanionReactionSequence()[0]
    const bubble = container.querySelector('.growth-companion-speech__bubble')
    expect(bubble?.textContent).toBe(reaction.utterance)
    expect(bubble?.getAttribute('aria-hidden')).toBe('true')
    expect(bubble?.textContent).not.toContain(reaction.accessibleLabel)
    expect(status.textContent).toBe(reaction.accessibleLabel)
  })

  it('uses the companion display name in the control and natural announcement', () => {
    render(
      <GrowthCompanionSpeech node={2} companionLabel="星潮">
        <figure role="img" aria-label="星潮" />
      </GrowthCompanionSpeech>
    )

    fireEvent.click(screen.getByRole('button', { name: '和星潮互動' }))
    expect(screen.getByRole('status').textContent).toBe('星潮感到親近，正開心地向你撒嬌。')
    expect(screen.getByText('輕觸星潮，看看它的神秘語回應。')).toBeTruthy()
  })

  it('clears a reaction when the stage changes or the document becomes hidden', () => {
    const { container, rerender } = renderSpeech(2)
    fireEvent.click(screen.getByRole('button'))
    expect(container.querySelector('.growth-companion-speech__bubble')).not.toBeNull()

    rerender(
      <GrowthCompanionSpeech node={3} companionLabel="潤光">
        <figure role="img" aria-label="潤光第 3 階" />
      </GrowthCompanionSpeech>
    )
    expect(container.querySelector('.growth-companion-speech__bubble')).toBeNull()

    fireEvent.click(screen.getByRole('button'))
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(container.querySelector('.growth-companion-speech__bubble')).toBeNull()
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true)
  })

  it('supports native keyboard activation and Escape dismissal without moving focus', () => {
    const { container } = renderSpeech(3)
    const button = screen.getByRole('button', { name: '和潤光互動' })
    button.focus()

    fireEvent.click(button)
    expect(container.querySelector('.growth-companion-speech__bubble')).not.toBeNull()
    expect(document.activeElement).toBe(button)

    fireEvent.keyDown(button, { key: 'Escape' })
    expect(container.querySelector('.growth-companion-speech__bubble')).toBeNull()
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('debounces rapid taps, then exposes every reaction before repeating', () => {
    const { container } = renderSpeech(4)
    const button = screen.getByRole('button')
    const seen: string[] = []

    for (let index = 0; index < 10; index += 1) {
      fireEvent.click(button)
      seen.push(container.querySelector('.growth-companion-speech__bubble')?.getAttribute('data-growth-speech-reaction') ?? '')
      fireEvent.click(button)
      expect(container.querySelector('.growth-companion-speech__bubble')?.getAttribute('data-growth-speech-reaction')).toBe(seen.at(-1))
      act(() => vi.advanceTimersByTime(GROWTH_COMPANION_SPEECH_COOLDOWN_MS))
    }

    expect(new Set(seen).size).toBe(10)
    fireEvent.click(button)
    expect(container.querySelector('.growth-companion-speech__bubble')?.getAttribute('data-growth-speech-reaction')).toBe(seen[0])
  })

  it('returns to the idle hint after five seconds, including reduced-motion mode', () => {
    const matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn()
    })
    vi.stubGlobal('matchMedia', matchMedia)
    const { container } = renderSpeech(2)

    fireEvent.click(screen.getByRole('button'))
    expect(container.querySelector('.growth-companion-interaction')?.getAttribute('data-growth-speech-motion')).toBe('reduced')
    act(() => vi.advanceTimersByTime(GROWTH_COMPANION_SPEECH_VISIBLE_MS - 1))
    expect(container.querySelector('.growth-companion-speech__bubble')).not.toBeNull()
    act(() => vi.advanceTimersByTime(1))
    expect(container.querySelector('.growth-companion-speech__bubble')).toBeNull()
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('clears and disables speech while a Growth sheet pauses the companion', () => {
    const { container, rerender } = render(
      <GrowthCompanionSpeech node={2} companionLabel="潤光"><figure role="img" aria-label="潤光" /></GrowthCompanionSpeech>
    )
    fireEvent.click(screen.getByRole('button'))
    expect(container.querySelector('.growth-companion-speech__bubble')).not.toBeNull()

    rerender(
      <GrowthCompanionSpeech node={2} companionLabel="潤光" paused><figure role="img" aria-label="潤光" /></GrowthCompanionSpeech>
    )
    expect(container.querySelector('.growth-companion-speech__bubble')).toBeNull()
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('clears an active reaction when the creature leaves the viewport', () => {
    let onIntersection: IntersectionObserverCallback | undefined
    class IntersectionObserverMock {
      root = null
      rootMargin = '0px'
      thresholds = [0.05]
      constructor(callback: IntersectionObserverCallback) { onIntersection = callback }
      observe = vi.fn()
      disconnect = vi.fn()
      unobserve = vi.fn()
      takeRecords = vi.fn(() => [])
    }
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock)
    const { container } = renderSpeech(12)
    fireEvent.click(screen.getByRole('button'))
    expect(container.querySelector('.growth-companion-speech__bubble')).not.toBeNull()

    act(() => onIntersection?.([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver))
    expect(container.querySelector('.growth-companion-speech__bubble')).toBeNull()
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true)
  })
})
