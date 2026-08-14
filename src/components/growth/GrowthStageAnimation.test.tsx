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
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    status: 200,
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0))
  }))
  Object.defineProperty(navigator, 'connection', { configurable: true, value: undefined })
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
      node={1}
      atlasUrl="/motion-01.webp"
      posterUrl="/poster-01.webp"
      label="Luminous Lv1"
    />)

    const surface = screen.getByRole('img', { name: 'Luminous Lv1' })
    expect(surface.getAttribute('data-growth-stage-status')).toBe('poster')
    expect(container.querySelector<HTMLImageElement>('.growth-stage-animation__poster')?.src).toContain('/poster-01.webp')
    expect(container.querySelector('.growth-stage-animation__frames')).toBeNull()
    expect(container.querySelector('.growth-stage-animation__video')).toBeNull()
    expect(container.querySelector('.growth-ambient-stars')).toBeNull()
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
    expect(surface.getAttribute('data-growth-scene-composition')).toBe('embedded_habitat')
    expect(container.querySelectorAll('.growth-stage-animation__habitat')).toHaveLength(0)
    expect(container.querySelectorAll('.growth-ambient-stars__particle')).toHaveLength(14)
    expect(container.querySelector('.growth-ambient-stars')?.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('.growth-ambient-stars')?.getAttribute('role')).toBeNull()
    expect(container.querySelector('.growth-ambient-stars')?.getAttribute('tabindex')).toBeNull()
    expect(createdImages).toHaveLength(0)

    fireEvent.canPlay(video!)
    await waitFor(() => expect(surface.getAttribute('data-growth-stage-status')).toBe('ready'))
    expect(surface.getAttribute('data-growth-motion-play-state')).toBe('running')
    expect(container.querySelectorAll('.growth-ambient-stars__particle')).toHaveLength(14)
    expect(play).toHaveBeenCalled()

    pause.mockClear()
    act(() => intersectionCallback?.(
      [{ isIntersecting: false } as IntersectionObserverEntry],
      {} as IntersectionObserver
    ))
    expect(surface.getAttribute('data-growth-motion-play-state')).toBe('paused')
    expect(container.querySelector('.growth-ambient-stars')).not.toBeNull()
    expect(pause).toHaveBeenCalled()

    act(() => intersectionCallback?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver
    ))
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    pause.mockClear()
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(surface.getAttribute('data-growth-motion-play-state')).toBe('paused')
    expect(container.querySelector('.growth-ambient-stars')).not.toBeNull()
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
    expect(container.querySelector('.growth-ambient-stars')).not.toBeNull()
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
    expect(container.querySelector('.growth-ambient-stars')).toBeNull()
    expect(container.querySelector<HTMLImageElement>('.growth-stage-animation__poster')?.src).toContain('/poster-02.webp')
  })

  it('uses one decoder to insert a secondary action after the deterministic primary cadence', async () => {
    const { container } = render(<GrowthStageAnimation
      node={2}
      atlasUrl="/motion-02-primary.mp4"
      secondaryAtlasUrl="/motion-02-secondary.mp4"
      posterUrl="/poster-02.webp"
      label="Luminous Lv2"
    />)

    const surface = screen.getByRole('img', { name: 'Luminous Lv2' })
    let video = container.querySelector<HTMLVideoElement>('.growth-stage-animation__video')!
    expect(container.querySelectorAll('.growth-stage-animation__video')).toHaveLength(1)
    expect(video.loop).toBe(false)
    expect(video.src).toContain('/motion-02-primary.mp4')
    expect(surface.getAttribute('data-growth-authored-motion')).toBe('primary')
    expect(surface.getAttribute('data-growth-primary-cycle')).toBe('0/13')

    fireEvent.canPlay(video)
    for (let cycle = 1; cycle <= 10; cycle += 1) {
      fireEvent.ended(video)
      expect(video.src).toContain('/motion-02-primary.mp4')
      expect(surface.getAttribute('data-growth-primary-cycle')).toBe(`${cycle}/13`)
      expect(container.querySelectorAll('.growth-stage-animation__video')).toHaveLength(1)
    }
    expect(fetch).not.toHaveBeenCalled()

    fireEvent.ended(video)
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    expect(fetch).toHaveBeenCalledWith('/motion-02-secondary.mp4', {
      signal: expect.any(AbortSignal)
    })
    await waitFor(() => expect(surface.getAttribute('data-growth-secondary-prewarm')).toBe('ready'))
    fireEvent.ended(video)
    expect(surface.getAttribute('data-growth-primary-cycle')).toBe('12/13')

    fireEvent.ended(video)
    video = container.querySelector<HTMLVideoElement>('.growth-stage-animation__video')!
    expect(video.src).toContain('/motion-02-secondary.mp4')
    expect(surface.getAttribute('data-growth-authored-motion')).toBe('secondary')
    expect(surface.getAttribute('data-growth-stage-status')).toBe('loading')
    expect(container.querySelectorAll('.growth-stage-animation__video')).toHaveLength(1)

    fireEvent.canPlay(video)
    await waitFor(() => expect(surface.getAttribute('data-growth-stage-status')).toBe('ready'))
    fireEvent.ended(video)
    video = container.querySelector<HTMLVideoElement>('.growth-stage-animation__video')!
    expect(video.src).toContain('/motion-02-primary.mp4')
    expect(surface.getAttribute('data-growth-authored-motion')).toBe('primary')
    expect(surface.getAttribute('data-growth-primary-cycle')).toBe('0/18')
    expect(container.querySelectorAll('.growth-stage-animation__video')).toHaveLength(1)
  })

  it('waits at primary seams until the full 200 secondary response is consumed', async () => {
    let finishBody!: () => void
    const fullBody = new Promise<void>((resolve) => { finishBody = resolve })
    const arrayBuffer = vi.fn(() => fullBody.then(() => new ArrayBuffer(8)))
    vi.mocked(fetch).mockResolvedValue({ status: 200, arrayBuffer } as unknown as Response)

    const { container } = render(<GrowthStageAnimation
      node={2}
      atlasUrl="/motion-02-primary.mp4"
      secondaryAtlasUrl="/motion-02-secondary.mp4"
      posterUrl="/poster-02.webp"
      label="Luminous Lv2"
    />)
    const surface = screen.getByRole('img', { name: 'Luminous Lv2' })
    let video = container.querySelector<HTMLVideoElement>('.growth-stage-animation__video')!
    fireEvent.canPlay(video)
    for (let cycle = 0; cycle < 13; cycle += 1) fireEvent.ended(video)

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    expect(arrayBuffer).toHaveBeenCalledTimes(1)
    expect(surface.getAttribute('data-growth-primary-cycle')).toBe('13/13')
    expect(surface.getAttribute('data-growth-authored-motion')).toBe('primary')
    expect(video.src).toContain('/motion-02-primary.mp4')

    fireEvent.ended(video)
    expect(surface.getAttribute('data-growth-authored-motion')).toBe('primary')

    await act(async () => { finishBody() })
    await waitFor(() => expect(surface.getAttribute('data-growth-secondary-prewarm')).toBe('ready'))
    fireEvent.ended(video)
    video = container.querySelector<HTMLVideoElement>('.growth-stage-animation__video')!
    expect(surface.getAttribute('data-growth-authored-motion')).toBe('secondary')
    expect(video.src).toContain('/motion-02-secondary.mp4')
  })

  it('disables only a failed secondary action and resumes the primary loop', async () => {
    const { container } = render(<GrowthStageAnimation
      node={2}
      atlasUrl="/motion-02-primary.mp4"
      secondaryAtlasUrl="/missing-secondary.mp4"
      posterUrl="/poster-02.webp"
      label="Luminous Lv2"
    />)

    const surface = screen.getByRole('img', { name: 'Luminous Lv2' })
    let video = container.querySelector<HTMLVideoElement>('.growth-stage-animation__video')!
    fireEvent.canPlay(video)
    for (let cycle = 0; cycle < 11; cycle += 1) fireEvent.ended(video)
    await waitFor(() => expect(surface.getAttribute('data-growth-secondary-prewarm')).toBe('ready'))
    fireEvent.ended(video)
    fireEvent.ended(video)
    video = container.querySelector<HTMLVideoElement>('.growth-stage-animation__video')!
    expect(video.src).toContain('/missing-secondary.mp4')

    fireEvent.error(video)
    video = container.querySelector<HTMLVideoElement>('.growth-stage-animation__video')!
    expect(surface.getAttribute('data-growth-stage-status')).toBe('loading')
    expect(surface.getAttribute('data-growth-authored-motion')).toBe('primary')
    expect(video.src).toContain('/motion-02-primary.mp4')
    expect(video.loop).toBe(true)
    expect(container.querySelectorAll('.growth-stage-animation__video')).toHaveLength(1)

    fireEvent.canPlay(video)
    expect(surface.getAttribute('data-growth-stage-status')).toBe('ready')
  })

  it('plays the approved stage-six video with fourteen perimeter particles', async () => {
    const { container } = render(<GrowthStageAnimation
      node={6}
      atlasUrl="/motion-06-v3.mp4"
      posterUrl="/poster-06-v3.webp"
      label="Luminous Lv6"
    />)

    const surface = screen.getByRole('img', { name: 'Luminous Lv6' })
    const video = container.querySelector<HTMLVideoElement>('.growth-stage-animation__video')
    expect(video?.src).toContain('/motion-06-v3.mp4')
    expect(video?.poster).toContain('/poster-06-v3.webp')
    expect(surface.getAttribute('data-growth-scene-composition')).toBe('embedded_habitat')
    expect(container.querySelectorAll('.growth-ambient-stars__particle')).toHaveLength(14)

    fireEvent.canPlay(video!)
    await waitFor(() => expect(surface.getAttribute('data-growth-stage-status')).toBe('ready'))
    expect(surface.getAttribute('data-growth-motion-play-state')).toBe('running')
  })

  it('plays the approved stage-five video with fourteen perimeter particles', async () => {
    const { container } = render(<GrowthStageAnimation
      node={5}
      atlasUrl="/motion-05-v4.mp4"
      posterUrl="/poster-05-v4.webp"
      label="Luminous Lv5"
    />)

    const surface = screen.getByRole('img', { name: 'Luminous Lv5' })
    const video = container.querySelector<HTMLVideoElement>('.growth-stage-animation__video')
    expect(video?.src).toContain('/motion-05-v4.mp4')
    expect(video?.poster).toContain('/poster-05-v4.webp')
    expect(surface.getAttribute('data-growth-scene-composition')).toBe('embedded_habitat')
    expect(container.querySelectorAll('.growth-ambient-stars__particle')).toHaveLength(14)

    fireEvent.canPlay(video!)
    await waitFor(() => expect(surface.getAttribute('data-growth-stage-status')).toBe('ready'))
    expect(surface.getAttribute('data-growth-motion-play-state')).toBe('running')
  })

  it('ignores a pending play AbortError after playback is deliberately paused', async () => {
    let rejectPlay!: (error: unknown) => void
    vi.mocked(window.HTMLMediaElement.prototype.play).mockReturnValue(new Promise((_resolve, reject) => {
      rejectPlay = reject
    }))
    const { container, rerender } = render(<GrowthStageAnimation
      node={2}
      atlasUrl="/motion-02.mp4"
      posterUrl="/poster-02.webp"
      label="Luminous Lv2"
    />)
    const surface = screen.getByRole('img', { name: 'Luminous Lv2' })
    fireEvent.canPlay(container.querySelector<HTMLVideoElement>('.growth-stage-animation__video')!)
    expect(surface.getAttribute('data-growth-stage-status')).toBe('ready')

    rerender(<GrowthStageAnimation
      node={2}
      atlasUrl="/motion-02.mp4"
      posterUrl="/poster-02.webp"
      label="Luminous Lv2"
      paused
    />)
    await act(async () => { rejectPlay(new DOMException('Playback was interrupted', 'AbortError')) })

    expect(surface.getAttribute('data-growth-stage-status')).toBe('ready')
    expect(surface.getAttribute('data-growth-motion-play-state')).toBe('paused')
    expect(container.querySelector('.growth-stage-animation__video')).not.toBeNull()
  })

  it('aborts an in-flight prewarm when paused, offscreen, hidden, or unmounted', async () => {
    const signals: AbortSignal[] = []
    vi.mocked(fetch).mockImplementation((_input, init) => {
      const signal = init?.signal as AbortSignal
      signals.push(signal)
      return new Promise<Response>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      })
    })
    const renderPlayer = (paused = false) => <GrowthStageAnimation
      node={2}
      atlasUrl="/motion-02-primary.mp4"
      secondaryAtlasUrl="/motion-02-secondary.mp4"
      posterUrl="/poster-02.webp"
      label="Luminous Lv2"
      paused={paused}
    />
    const { container, rerender, unmount } = render(renderPlayer())
    const surface = screen.getByRole('img', { name: 'Luminous Lv2' })
    const video = container.querySelector<HTMLVideoElement>('.growth-stage-animation__video')!
    fireEvent.canPlay(video)
    for (let cycle = 0; cycle < 11; cycle += 1) fireEvent.ended(video)
    await waitFor(() => expect(signals).toHaveLength(1))

    rerender(renderPlayer(true))
    await waitFor(() => expect(signals[0].aborted).toBe(true))
    await waitFor(() => expect(surface.getAttribute('data-growth-secondary-prewarm')).toBe('idle'))

    rerender(renderPlayer())
    await waitFor(() => expect(signals).toHaveLength(2))
    act(() => intersectionCallback?.(
      [{ isIntersecting: false } as IntersectionObserverEntry],
      {} as IntersectionObserver
    ))
    await waitFor(() => expect(signals[1].aborted).toBe(true))

    act(() => intersectionCallback?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver
    ))
    await waitFor(() => expect(signals).toHaveLength(3))
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    await waitFor(() => expect(signals[2].aborted).toBe(true))

    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    await waitFor(() => expect(signals).toHaveLength(4))
    unmount()
    expect(signals[3].aborted).toBe(true)
  })

  it('does not prewarm on a data-saver connection', async () => {
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: { saveData: true, effectiveType: '4g' }
    })
    const { container } = render(<GrowthStageAnimation
      node={2}
      atlasUrl="/motion-02-primary.mp4"
      secondaryAtlasUrl="/motion-02-secondary.mp4"
      posterUrl="/poster-02.webp"
      label="Luminous Lv2"
    />)
    const video = container.querySelector<HTMLVideoElement>('.growth-stage-animation__video')!
    fireEvent.canPlay(video)
    for (let cycle = 0; cycle < 14; cycle += 1) fireEvent.ended(video)
    await act(async () => undefined)

    expect(fetch).not.toHaveBeenCalled()
    expect(screen.getByRole('img', { name: 'Luminous Lv2' }).getAttribute('data-growth-authored-motion')).toBe('primary')
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
    expect(container.querySelector('.growth-ambient-stars')).toBeNull()
    expect(createdImages).toHaveLength(0)
  })
})
