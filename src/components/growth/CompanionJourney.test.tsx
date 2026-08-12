// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CompanionJourney } from './CompanionJourney'
import type { GrowthCompanionView, GrowthNode } from './types'

const companionAt = (growthNode: GrowthNode, xp: number): GrowthCompanionView => ({
  displayName: '潤光',
  growthNode,
  xp,
  affinities: { awareness: 0, nourishment: 0, activity: 0, recovery: 0 },
  artworkUrl: `/art/growth/luminous-stage-${String(growthNode).padStart(2, '0')}.webp`
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('CompanionJourney artwork motion', () => {
  it('transitions two complete stage images through the core and removes the old image', () => {
    vi.useFakeTimers()
    const { container, rerender } = render(<CompanionJourney
      companion={companionAt(3, 160)}
      fallbackArtworkUrl="/art/growth/luminous-stage-03.webp"
    />)

    rerender(<CompanionJourney
      companion={companionAt(4, 300)}
      fallbackArtworkUrl="/art/growth/luminous-stage-04.webp"
    />)

    const artwork = screen.getByRole('img', { name: '潤光目前型態：潤團・萌翼' })
    expect(artwork.getAttribute('data-growth-motion')).toBe('form_metamorphosis')
    expect(container.querySelector<HTMLImageElement>('.growth-motion-snapshot--previous img')?.src).toContain('luminous-stage-03.webp')
    expect(container.querySelector<HTMLImageElement>('.growth-motion-snapshot--current img')?.src).toContain('luminous-stage-04.webp')

    for (const image of container.querySelectorAll<HTMLImageElement>('.growth-motion-snapshot img')) fireEvent.load(image)
    act(() => { vi.advanceTimersByTime(1_450) })

    expect(container.querySelector('.growth-motion-snapshot--previous')).toBeNull()
    expect(artwork.getAttribute('data-growth-motion')).toBe('idle')
    expect(container.querySelectorAll('.growth-motion-snapshot--current img')).toHaveLength(1)
  })

  it('uses a pulse for XP and a lighter transition inside the same main form', () => {
    vi.useFakeTimers()
    const { container, rerender } = render(<CompanionJourney
      companion={companionAt(4, 300)}
      fallbackArtworkUrl="/art/growth/luminous-stage-04.webp"
    />)

    rerender(<CompanionJourney
      companion={companionAt(4, 310)}
      fallbackArtworkUrl="/art/growth/luminous-stage-04.webp"
    />)
    expect(screen.getByRole('img').getAttribute('data-growth-motion')).toBe('xp_pulse')
    expect(container.querySelector('.growth-motion-snapshot--previous')).toBeNull()
    act(() => { vi.advanceTimersByTime(720) })

    rerender(<CompanionJourney
      companion={companionAt(5, 460)}
      fallbackArtworkUrl="/art/growth/luminous-stage-05.webp"
    />)
    expect(screen.getByRole('img', { name: '潤光目前型態：潤團・生環' }).getAttribute('data-growth-motion')).toBe('level_transition')
  })

  it('replays the same form transition after a rapid correction and re-earned level', () => {
    vi.useFakeTimers()
    const { container, rerender } = render(<CompanionJourney
      companion={companionAt(3, 160)}
      fallbackArtworkUrl="/art/growth/luminous-stage-03.webp"
    />)

    rerender(<CompanionJourney companion={companionAt(4, 300)} fallbackArtworkUrl="/art/growth/luminous-stage-04.webp" />)
    for (const image of container.querySelectorAll<HTMLImageElement>('.growth-motion-snapshot img')) fireEvent.load(image)
    act(() => { vi.advanceTimersByTime(1_450) })

    rerender(<CompanionJourney companion={companionAt(3, 160)} fallbackArtworkUrl="/art/growth/luminous-stage-03.webp" />)
    for (const image of container.querySelectorAll<HTMLImageElement>('.growth-motion-snapshot img')) fireEvent.load(image)
    act(() => { vi.advanceTimersByTime(200) })

    rerender(<CompanionJourney companion={companionAt(4, 300)} fallbackArtworkUrl="/art/growth/luminous-stage-04.webp" />)
    const thirdTransition = screen.getByRole('img')
    expect(thirdTransition.getAttribute('data-growth-motion')).toBe('form_metamorphosis')
    expect(thirdTransition.getAttribute('data-growth-motion-event')).toMatch(/:r3$/)
    for (const image of container.querySelectorAll<HTMLImageElement>('.growth-motion-snapshot img')) fireEvent.load(image)
    act(() => { vi.advanceTimersByTime(1_450) })
    expect(thirdTransition.getAttribute('data-growth-motion')).toBe('idle')

    rerender(<CompanionJourney companion={companionAt(4, 310)} fallbackArtworkUrl="/art/growth/luminous-stage-04.webp" />)
    expect(screen.getByRole('img').getAttribute('data-growth-motion')).toBe('xp_pulse')
  })

  it('keeps the last valid artwork after a failed stage and still pulses later XP', () => {
    vi.useFakeTimers()
    const { container, rerender } = render(<CompanionJourney
      companion={companionAt(3, 160)}
      fallbackArtworkUrl="/art/growth/luminous-stage-03.webp"
    />)

    rerender(<CompanionJourney companion={companionAt(4, 300)} fallbackArtworkUrl="/art/growth/luminous-stage-04.webp" />)
    fireEvent.error(container.querySelector<HTMLImageElement>('.growth-motion-snapshot--current img')!)
    expect(container.querySelector<HTMLImageElement>('.growth-motion-snapshot--current img')?.src).toContain('luminous-stage-03.webp')

    rerender(<CompanionJourney companion={companionAt(4, 310)} fallbackArtworkUrl="/art/growth/luminous-stage-04.webp" />)
    expect(screen.getByRole('img').getAttribute('data-growth-motion')).toBe('xp_pulse')
    expect(container.querySelector<HTMLImageElement>('.growth-motion-snapshot--current img')?.src).toContain('luminous-stage-03.webp')
  })

  it('uses an approved node-authored animation during idle instead of a generic CSS transform', () => {
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
    const { container } = render(<CompanionJourney
      companion={companionAt(3, 160)}
      fallbackArtworkUrl="/art/growth/luminous-stage-03.webp"
      animationAtlasUrl="/art/growth/motion/stage-03/luminous-stage-03-idle-primary-50fps-v1.mp4"
      animationPosterUrl="/art/growth/motion/stage-03/luminous-stage-03-idle-primary-habitat-poster-v1.webp"
    />)

    const artwork = screen.getByRole('img')
    expect(artwork.classList.contains('growth-stage-animation')).toBe(true)
    expect(artwork.getAttribute('data-growth-stage-node')).toBe('3')
    expect(container.querySelector<HTMLImageElement>('.growth-stage-animation__poster')?.src)
      .toContain('luminous-stage-03-idle-primary-habitat-poster-v1.webp')
    expect(container.querySelector<HTMLVideoElement>('.growth-stage-animation__video')?.src)
      .toContain('luminous-stage-03-idle-primary-50fps-v1.mp4')
  })
})
