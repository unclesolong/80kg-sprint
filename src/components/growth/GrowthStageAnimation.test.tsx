// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GrowthStageAnimation } from './GrowthStageAnimation'

const createdImages: MockImage[] = []
let intersectionCallback: IntersectionObserverCallback | undefined

class MockImage {
  onload: null | (() => void) = null
  onerror: null | (() => void) = null
  src = ''
  decode = vi.fn().mockResolvedValue(undefined)

  constructor() { createdImages.push(this) }
}

beforeEach(() => {
  createdImages.length = 0
  intersectionCallback = undefined
  vi.stubGlobal('Image', MockImage)
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) { intersectionCallback = callback }
    observe = vi.fn()
    disconnect = vi.fn()
    unobserve = vi.fn()
    takeRecords = vi.fn().mockReturnValue([])
    root = null
    rootMargin = ''
    thresholds = []
  })
  vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
  Object.defineProperty(document, 'hidden', { configurable: true, value: false })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('GrowthStageAnimation', () => {
  it('keeps unapproved stages on the static poster without loading an animation asset', () => {
    const { container } = render(<GrowthStageAnimation
      node={4}
      atlasUrl="/motion-04.webp"
      posterUrl="/poster-04.webp"
      label="Luminous Lv4"
    />)

    const surface = screen.getByRole('img', { name: 'Luminous Lv4' })
    expect(surface.getAttribute('data-growth-stage-status')).toBe('poster')
    expect(container.querySelector<HTMLImageElement>('.growth-stage-animation__poster')?.src).toContain('/poster-04.webp')
    expect(container.querySelector('.growth-stage-animation__frames')).toBeNull()
    expect(container.querySelector('.growth-stage-animation__video')).toBeNull()
    expect(createdImages).toHaveLength(0)
  })

  it('plays the stage-two video and pauses it offscreen, while hidden, or manually', async () => {
    const play = vi.mocked(window.HTMLMediaElement.prototype.play)
    const pause = vi.mocked(window.HTMLMediaElement.prototype.pause)
    const { container, rerender } = render(<GrowthStageAnimation
      node={2}
      atlasUrl="/motion-02.mp4"
      posterUrl="/poster-02.webp"
      label="Luminous Lv2"
    />)

    const surface = screen.getByRole('img', { name: 'Luminous Lv2' })
    const video = container.querySelector<HTMLVideoElement>('.growth-stage-animation__video')
    expect(video).not.toBeNull()
    expect(video?.src).toContain('/motion-02.mp4')
    expect(video?.muted).toBe(true)
    expect(video?.loop).toBe(true)
    expect(video?.playsInline).toBe(true)
    expect(createdImages).toHaveLength(0)

    fireEvent.canPlay(video!)
    await waitFor(() => expect(surface.getAttribute('data-growth-stage-status')).toBe('ready'))
    expect(surface.getAttribute('data-growth-motion-play-state')).toBe('running')
    expect(play).toHaveBeenCalled()

    pause.mockClear()
    act(() => intersectionCallback?.(
      [{ isIntersecting: false } as IntersectionObserverEntry],
      {} as IntersectionObserver
    ))
    expect(surface.getAttribute('data-growth-motion-play-state')).toBe('paused')
    expect(pause).toHaveBeenCalled()

    act(() => intersectionCallback?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver
    ))
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    pause.mockClear()
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(surface.getAttribute('data-growth-motion-play-state')).toBe('paused')
    expect(pause).toHaveBeenCalled()

    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    pause.mockClear()
    rerender(<GrowthStageAnimation
      node={2}
      atlasUrl="/motion-02.mp4"
      posterUrl="/poster-02.webp"
      label="Luminous Lv2"
      paused
    />)
    expect(surface.getAttribute('data-growth-motion-play-state')).toBe('paused')
    expect(pause).toHaveBeenCalled()
  })

  it('falls back to the stage-two poster when its video cannot load', () => {
    const { container } = render(<GrowthStageAnimation
      node={2}
      atlasUrl="/missing.mp4"
      posterUrl="/poster-02.webp"
      label="Luminous Lv2"
    />)

    fireEvent.error(container.querySelector<HTMLVideoElement>('.growth-stage-animation__video')!)
    expect(screen.getByRole('img', { name: 'Luminous Lv2' }).getAttribute('data-growth-stage-status')).toBe('failed')
    expect(container.querySelector('.growth-stage-animation__video')).toBeNull()
    expect(container.querySelector<HTMLImageElement>('.growth-stage-animation__poster')?.src).toContain('/poster-02.webp')
  })

  it('uses the static poster when reduced motion is requested', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }))

    const { container } = render(<GrowthStageAnimation
      node={2}
      atlasUrl="/motion-02.mp4"
      posterUrl="/poster-02.webp"
      label="Luminous Lv2"
    />)

    expect(screen.getByRole('img', { name: 'Luminous Lv2' }).getAttribute('data-growth-stage-status')).toBe('poster')
    expect(container.querySelector('.growth-stage-animation__frames')).toBeNull()
    expect(container.querySelector('.growth-stage-animation__video')).toBeNull()
    expect(createdImages).toHaveLength(0)
  })
})
