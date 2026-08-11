// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GrowthArtworkStack } from './GrowthArtworkStack'
import { GROWTH_ARTWORK_LOAD_TIMEOUT_MS } from './growthArtworkMotion'

const originalDecode = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'decode')

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  if (originalDecode) Object.defineProperty(HTMLImageElement.prototype, 'decode', originalDecode)
  else delete (HTMLImageElement.prototype as Partial<HTMLImageElement>).decode
})

describe('GrowthArtworkStack', () => {
  it('renders image assets in the fixed habitat-to-aura order', () => {
    const { container } = render(<GrowthArtworkStack
      label="測試潤光"
      layers={[
        { id: 'orbit', url: '/orbit.webp', slot: 'orbit' },
        { id: 'body', url: '/body.webp', slot: 'body' },
        { id: 'habitat', url: '/habitat.webp', slot: 'habitat' },
        { id: 'aura', url: '/aura.webp', slot: 'aura' }
      ]}
    />)

    expect(screen.getByRole('img', { name: '測試潤光' })).toBeTruthy()
    const images = [...container.querySelectorAll('img')]
    expect(images.map((image) => image.getAttribute('src'))).toEqual([
      '/habitat.webp',
      '/body.webp',
      '/orbit.webp',
      '/aura.webp'
    ])
    expect(images.every((image) => image.getAttribute('alt') === '')).toBe(true)
  })

  it('announces a text fallback instead of drawing missing art', () => {
    render(<GrowthArtworkStack label="星潮棲境" layers={[]} />)

    expect(screen.getByRole('img', { name: '星潮棲境；美術資產尚未加入' })).toBeTruthy()
    expect(screen.getByText('美術資產尚未加入')).toBeTruthy()
  })

  it('keeps complete previous/current layer snapshots separate and unloads the old one after transition', () => {
    vi.useFakeTimers()
    const onMotionComplete = vi.fn()
    const { container } = render(<GrowthArtworkStack
      label="潤光從浮珠成長為萌翼"
      motion="form_metamorphosis"
      motionEventId="reward-stage-4"
      previousLayers={[
        { id: 'old-body', url: '/stage-03.webp', slot: 'body' },
        { id: 'old-orbit', url: '/old-orbit.webp', slot: 'orbit' }
      ]}
      layers={[
        { id: 'new-body', url: '/stage-04.webp', slot: 'body' },
        { id: 'new-aura', url: '/new-aura.webp', slot: 'aura' }
      ]}
      onMotionComplete={onMotionComplete}
    />)

    const stack = screen.getByRole('img', { name: '潤光從浮珠成長為萌翼' })
    const previous = container.querySelector('.growth-motion-snapshot--previous')!
    const current = container.querySelector('.growth-motion-snapshot--current')!
    expect([...previous.querySelectorAll('img')].map((image) => image.getAttribute('src'))).toEqual(['/stage-03.webp', '/old-orbit.webp'])
    expect([...current.querySelectorAll('img')].map((image) => image.getAttribute('src'))).toEqual(['/stage-04.webp', '/new-aura.webp'])
    expect(stack.getAttribute('data-growth-motion')).toBe('form_metamorphosis')
    expect(container.querySelector('.growth-motion-core-flare')).toBeTruthy()
    expect(stack.getAttribute('data-growth-motion-play-state')).toBe('paused')

    for (const image of container.querySelectorAll<HTMLImageElement>('.growth-motion-snapshot img')) fireEvent.load(image)
    expect(stack.getAttribute('data-growth-target-status')).toBe('ready')
    expect(stack.getAttribute('data-growth-previous-status')).toBe('ready')
    expect(stack.getAttribute('data-growth-motion-play-state')).toBe('running')

    act(() => { vi.advanceTimersByTime(1_449) })
    expect(container.querySelector('.growth-motion-snapshot--previous')).toBeTruthy()
    act(() => { vi.advanceTimersByTime(1) })
    expect(container.querySelector('.growth-motion-snapshot--previous')).toBeNull()
    expect(container.querySelector('.growth-motion-core-flare')).toBeNull()
    expect(stack.getAttribute('data-growth-motion')).toBe('idle')
    expect(onMotionComplete).toHaveBeenCalledWith('form_metamorphosis', 'reward-stage-4')
  })

  it('uses the current snapshot only for an XP pulse', () => {
    vi.useFakeTimers()
    const { container } = render(<GrowthArtworkStack
      label="潤光獲得經驗"
      motion="xp_pulse"
      motionEventId="reward-xp"
      previousLayers={[{ id: 'old', url: '/old.webp', slot: 'body' }]}
      layers={[{ id: 'current', url: '/current.webp', slot: 'body' }]}
    />)

    expect(container.querySelector('.growth-motion-snapshot--previous')).toBeNull()
    expect(container.querySelector('.growth-motion-core-flare')).toBeNull()
    expect(screen.getByRole('img').getAttribute('data-growth-motion')).toBe('xp_pulse')
    act(() => { vi.advanceTimersByTime(720) })
    expect(screen.getByRole('img').getAttribute('data-growth-motion')).toBe('idle')
  })

  it('retains only the previous snapshot when the target stage fails to load', () => {
    const onMotionComplete = vi.fn()
    const { container } = render(<GrowthArtworkStack
      label="潤光成長載入失敗"
      motion="level_transition"
      motionEventId="failed-target"
      previousLayers={[{ id: 'old', url: '/stage-02.webp', slot: 'body' }]}
      layers={[{ id: 'new', url: '/stage-03.webp', slot: 'body' }]}
      onMotionComplete={onMotionComplete}
    />)
    const target = container.querySelector<HTMLImageElement>('.growth-motion-snapshot--current img')!

    fireEvent.error(target)

    const stack = screen.getByRole('img')
    expect(stack.getAttribute('data-growth-target-status')).toBe('failed')
    expect(stack.getAttribute('data-growth-motion')).toBe('idle')
    expect(container.querySelector('.growth-motion-snapshot--previous')).toBeNull()
    const remaining = [...container.querySelectorAll<HTMLImageElement>('.growth-motion-snapshot--current img')]
    expect(remaining).toHaveLength(1)
    expect(remaining[0].getAttribute('src')).toBe('/stage-02.webp')
    expect(onMotionComplete).toHaveBeenCalledWith('level_transition', 'failed-target', 'failed')
  })

  it('aborts a transition whose browser image events never settle', () => {
    vi.useFakeTimers()
    const onMotionComplete = vi.fn()
    render(<GrowthArtworkStack
      label="潤光載入逾時"
      motion="form_metamorphosis"
      motionEventId="stalled-target"
      previousLayers={[{ id: 'old', url: '/stage-03.webp', slot: 'body' }]}
      layers={[{ id: 'new', url: '/stage-04.webp', slot: 'body' }]}
      onMotionComplete={onMotionComplete}
    />)

    act(() => { vi.advanceTimersByTime(GROWTH_ARTWORK_LOAD_TIMEOUT_MS) })
    const stack = screen.getByRole('img')
    expect(stack.getAttribute('data-growth-target-status')).toBe('failed')
    expect(stack.getAttribute('data-growth-motion')).toBe('idle')
    expect(onMotionComplete).toHaveBeenCalledWith('form_metamorphosis', 'stalled-target', 'failed')
  })

  it('waits for target decode before starting the visual transition', async () => {
    vi.useFakeTimers()
    let resolveDecode!: () => void
    const decode = new Promise<void>((resolve) => { resolveDecode = resolve })
    Object.defineProperty(HTMLImageElement.prototype, 'decode', {
      configurable: true,
      value: vi.fn(() => decode)
    })
    const { container } = render(<GrowthArtworkStack
      label="等待正式圖解碼"
      motion="level_transition"
      motionEventId="decode-gate"
      previousLayers={[{ id: 'old', url: '/stage-02.webp', slot: 'body' }]}
      layers={[{ id: 'new', url: '/stage-03.webp', slot: 'body' }]}
    />)
    const stack = screen.getByRole('img')

    for (const image of container.querySelectorAll<HTMLImageElement>('img')) fireEvent.load(image)
    expect(stack.getAttribute('data-growth-target-status')).toBe('loading')
    expect(stack.getAttribute('data-growth-motion-play-state')).toBe('paused')

    await act(async () => {
      resolveDecode()
      await decode
      await Promise.resolve()
    })
    expect(stack.getAttribute('data-growth-target-status')).toBe('ready')
    expect(stack.getAttribute('data-growth-previous-status')).toBe('ready')
    expect(stack.getAttribute('data-growth-motion-play-state')).toBe('running')
  })

  it('keeps the previous bitmap until the target is ready for reduced motion', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn()
    })))
    const onMotionComplete = vi.fn()
    const { container } = render(<GrowthArtworkStack
      label="減少動態的潤光成長"
      motion="level_transition"
      motionEventId="reduced-level"
      previousLayers={[{ id: 'old', url: '/stage-02.webp', slot: 'body' }]}
      layers={[{ id: 'new', url: '/stage-03.webp', slot: 'body' }]}
      onMotionComplete={onMotionComplete}
    />)
    const stack = screen.getByRole('img')

    expect(stack.getAttribute('data-growth-reduced-motion')).toBe('true')
    expect(stack.getAttribute('data-growth-target-status')).toBe('loading')
    expect(container.querySelector('.growth-motion-snapshot--previous')).toBeTruthy()
    for (const image of container.querySelectorAll<HTMLImageElement>('img')) fireEvent.load(image)

    expect(stack.getAttribute('data-growth-target-status')).toBe('ready')
    expect(container.querySelector('.growth-motion-snapshot--previous')).toBeNull()
    expect(onMotionComplete).toHaveBeenCalledTimes(1)
  })
})
