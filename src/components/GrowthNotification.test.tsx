// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GrowthNotification } from './GrowthNotification'
import { GROWTH_ARTWORK_LOAD_TIMEOUT_MS } from './growth/growthArtworkMotion'
import type { GrowthNotification as GrowthNotificationModel, GrowthNotificationKind } from '../viewModels/growthNotification'

const notice = (kind: GrowthNotificationKind = 'xp'): GrowthNotificationModel => ({
  id: `notice-${kind}`,
  kind,
  cause: 'user_write',
  xpDelta: 20,
  fromNode: kind === 'xp' ? 1 : 3,
  toNode: kind === 'xp' ? 1 : 4,
  fromForm: 'light_drop',
  toForm: kind === 'form' ? 'soft_cluster' : 'light_drop',
  fromNodeLabel: kind === 'xp' ? '初醒' : '浮珠',
  toNodeLabel: kind === 'xp' ? '初醒' : '萌翼',
  fromFormLabel: '光滴',
  toFormLabel: kind === 'form' ? '潤團' : '光滴',
  newlyAddedRewardLedgerIds: ['reward-1'],
  previousArtworkUrl: `/art/growth/luminous-stage-${kind === 'xp' ? '01' : '03'}.webp`,
  artworkUrl: `/art/growth/luminous-stage-${kind === 'xp' ? '01' : '04'}.webp`,
  title: kind === 'xp' ? '潤光獲得 20 XP' : kind === 'level' ? '潤光升至 Lv4' : '潤光蛻變為潤團',
  message: '今天的行動已成為潤光的成長能量。',
  announcement: `${kind} announcement`
})

beforeEach(() => {
  vi.useFakeTimers()
  Object.defineProperty(document, 'hidden', { configurable: true, value: false })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('GrowthNotification', () => {
  it('separates its polite live announcement from visible controls without moving focus', () => {
    const onDismiss = vi.fn()
    render(<GrowthNotification notice={notice('level')} onDismiss={onDismiss} onOpenGrowth={vi.fn()} />)

    const status = screen.getByRole('status')
    expect(status.textContent).toBe('level announcement')
    expect(status.querySelector('button')).toBeNull()
    expect(screen.getByRole('button', { name: '查看潤光' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '關閉潤光通知' })).toBeTruthy()
    expect(document.activeElement).toBe(document.body)
  })

  it.each([
    ['xp', 5_000],
    ['level', 8_000]
  ] as const)('auto-dismisses %s after %i ms', (kind, duration) => {
    const onDismiss = vi.fn()
    const { container } = render(<GrowthNotification notice={notice(kind)} onDismiss={onDismiss} />)
    for (const image of container.querySelectorAll<HTMLImageElement>('.growth-motion-snapshot img')) fireEvent.load(image)

    act(() => { vi.advanceTimersByTime(duration - 1) })
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('keeps a form-change notice until the user acts', () => {
    const onDismiss = vi.fn()
    render(<GrowthNotification notice={notice('form')} onDismiss={onDismiss} onOpenGrowth={vi.fn()} />)

    act(() => { vi.advanceTimersByTime(60_000) })
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('crossfades official previous/current stage art and removes the previous bitmap after metamorphosis', () => {
    const onDismiss = vi.fn()
    const { container } = render(<GrowthNotification notice={notice('form')} onDismiss={onDismiss} onOpenGrowth={vi.fn()} />)
    const artwork = container.querySelector<HTMLElement>('.growth-notification-artwork')!

    expect(artwork.dataset.growthMotion).toBe('form_metamorphosis')
    expect(artwork.querySelector<HTMLImageElement>('.growth-motion-snapshot--previous img')?.src).toContain('luminous-stage-03.webp')
    expect(artwork.querySelector<HTMLImageElement>('.growth-motion-snapshot--current img')?.src).toContain('luminous-stage-04.webp')
    expect(artwork.querySelector('.growth-motion-core-flare')).toBeTruthy()
    expect(artwork.dataset.growthMotionPlayState).toBe('paused')

    for (const image of artwork.querySelectorAll<HTMLImageElement>('.growth-motion-snapshot img')) fireEvent.load(image)
    expect(artwork.dataset.growthTargetStatus).toBe('ready')
    expect(artwork.dataset.growthPreviousStatus).toBe('ready')
    expect(artwork.dataset.growthMotionPlayState).toBe('running')

    act(() => { vi.advanceTimersByTime(1_450) })
    expect(artwork.dataset.growthMotion).toBe('idle')
    expect(artwork.querySelector('.growth-motion-snapshot--previous')).toBeNull()
    expect(artwork.querySelector('.growth-motion-core-flare')).toBeNull()
    expect(artwork.querySelectorAll('img')).toHaveLength(1)
  })

  it('falls back to one previous-stage bitmap and resumes dismissal if notification target art fails', () => {
    const onDismiss = vi.fn()
    const { container } = render(<GrowthNotification notice={notice('level')} onDismiss={onDismiss} />)
    const artwork = container.querySelector<HTMLElement>('.growth-notification-artwork')!
    fireEvent.error(artwork.querySelector<HTMLImageElement>('.growth-motion-snapshot--current img')!)

    expect(artwork.dataset.growthTargetStatus).toBe('failed')
    expect(artwork.dataset.growthMotion).toBe('idle')
    expect(artwork.querySelector('.growth-motion-snapshot--previous')).toBeNull()
    const remaining = artwork.querySelectorAll<HTMLImageElement>('img')
    expect(remaining).toHaveLength(1)
    expect(remaining[0].src).toContain('luminous-stage-03.webp')

    act(() => { vi.advanceTimersByTime(8_000) })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('pauses its countdown while hovered and resumes with the remaining time', () => {
    const onDismiss = vi.fn()
    render(<GrowthNotification notice={notice('xp')} onDismiss={onDismiss} />)
    const card = document.querySelector<HTMLElement>('.growth-notification-card')!

    act(() => { vi.advanceTimersByTime(3_000) })
    fireEvent.mouseEnter(card)
    act(() => { vi.advanceTimersByTime(30_000) })
    expect(onDismiss).not.toHaveBeenCalled()

    fireEvent.mouseLeave(card)
    act(() => { vi.advanceTimersByTime(1_999) })
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('pauses for keyboard focus and document visibility', () => {
    const onDismiss = vi.fn()
    const { container } = render(<GrowthNotification notice={notice('level')} onDismiss={onDismiss} onOpenGrowth={vi.fn()} />)
    for (const image of container.querySelectorAll<HTMLImageElement>('.growth-motion-snapshot img')) fireEvent.load(image)
    const openButton = screen.getByRole('button', { name: '查看潤光' })

    act(() => { vi.advanceTimersByTime(2_000) })
    fireEvent.focus(openButton)
    act(() => { vi.advanceTimersByTime(20_000) })
    expect(onDismiss).not.toHaveBeenCalled()

    fireEvent.blur(openButton, { relatedTarget: document.body })
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    act(() => { vi.advanceTimersByTime(20_000) })
    expect(onDismiss).not.toHaveBeenCalled()

    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    act(() => { vi.advanceTimersByTime(5_999) })
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['occluded', { occluded: true }],
    ['modalOpen', { modalOpen: true }]
  ] as const)('hides, silences and pauses while %s', (_label, hiddenProps) => {
    const onDismiss = vi.fn()
    const { rerender } = render(<GrowthNotification notice={notice('xp')} onDismiss={onDismiss} {...hiddenProps} />)
    const card = document.querySelector<HTMLElement>('.growth-notification-card')!

    expect(card.hidden).toBe(true)
    expect(screen.getByRole('status').textContent).toBe('')
    act(() => { vi.advanceTimersByTime(30_000) })
    expect(onDismiss).not.toHaveBeenCalled()

    rerender(<GrowthNotification notice={notice('xp')} onDismiss={onDismiss} />)
    expect(card.hidden).toBe(false)
    expect(screen.getByRole('status').textContent).toBe('xp announcement')
    act(() => { vi.advanceTimersByTime(5_000) })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('routes level/form CTA, omits it for XP, and keeps a 44px close target', () => {
    const onDismiss = vi.fn()
    const onOpenGrowth = vi.fn()
    const { rerender } = render(<GrowthNotification notice={notice('level')} onDismiss={onDismiss} onOpenGrowth={onOpenGrowth} />)

    fireEvent.click(screen.getByRole('button', { name: '查看潤光' }))
    expect(onOpenGrowth).toHaveBeenCalledTimes(1)
    const close = screen.getByRole('button', { name: '關閉潤光通知' })
    expect(close.classList.contains('growth-notification-close')).toBe(true)
    fireEvent.click(close)
    expect(onDismiss).toHaveBeenCalledTimes(1)

    rerender(<GrowthNotification notice={notice('xp')} onDismiss={onDismiss} onOpenGrowth={onOpenGrowth} />)
    expect(screen.queryByRole('button', { name: '查看潤光' })).toBeNull()
  })

  it('clears stale focus pause after a notice is dismissed and a later notice arrives', () => {
    const onDismiss = vi.fn()
    const { rerender } = render(<GrowthNotification notice={notice('xp')} onDismiss={onDismiss} />)
    const close = screen.getByRole('button', { name: '關閉潤光通知' })

    fireEvent.focus(close)
    fireEvent.click(close)
    expect(onDismiss).toHaveBeenCalledTimes(1)
    rerender(<GrowthNotification notice={undefined} onDismiss={onDismiss} />)
    rerender(<GrowthNotification notice={{ ...notice('xp'), id: 'later-xp' }} onDismiss={onDismiss} />)

    act(() => { vi.advanceTimersByTime(5_000) })
    expect(onDismiss).toHaveBeenCalledTimes(2)
  })

  it('resets focus pause when a queued notice is promoted without an empty render', () => {
    const onDismiss = vi.fn()
    const first = notice('level')
    const second = { ...notice('xp'), id: 'queued-xp', announcement: 'queued announcement' }
    const { rerender } = render(<GrowthNotification notice={first} onDismiss={onDismiss} />)

    const close = screen.getByRole('button', { name: '關閉潤光通知' })
    fireEvent.focus(close)
    fireEvent.click(close)
    expect(onDismiss).toHaveBeenCalledTimes(1)

    rerender(<GrowthNotification notice={second} onDismiss={onDismiss} />)
    expect(screen.getByRole('status').textContent).toBe('queued announcement')
    act(() => { vi.advanceTimersByTime(5_000) })
    expect(onDismiss).toHaveBeenCalledTimes(2)
  })

  it('falls back from a stalled level artwork load and resumes the notice timer', () => {
    const onDismiss = vi.fn()
    render(<GrowthNotification notice={notice('level')} onDismiss={onDismiss} />)

    act(() => { vi.advanceTimersByTime(GROWTH_ARTWORK_LOAD_TIMEOUT_MS) })
    expect(document.querySelector('.growth-notification-artwork')?.getAttribute('data-growth-target-status')).toBe('failed')
    act(() => { vi.advanceTimersByTime(7_999) })
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
