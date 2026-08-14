// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  getGrowthAmbientStarLayout,
  GROWTH_AMBIENT_LANE_WIDTH_PERCENT,
  GrowthAmbientStars
} from './GrowthAmbientStars'

afterEach(cleanup)

describe('GrowthAmbientStars', () => {
  it.each([2, 3, 4, 5, 6] as const)('uses fourteen deterministic particles in safe perimeter lanes for stage %s', (node) => {
    const first = getGrowthAmbientStarLayout(node)
    const repeated = getGrowthAmbientStarLayout(node)
    const { container } = render(<GrowthAmbientStars node={node} spriteUrl="/star-particles.webp" />)
    const particles = [...container.querySelectorAll<HTMLElement>('.growth-ambient-stars__particle')]

    expect(first).toBe(repeated)
    const blueParticles = first.filter((particle) => particle.tone === 'blue')
    const goldParticles = first.filter((particle) => particle.tone === 'gold')

    expect(first).toHaveLength(14)
    expect(first.filter((particle) => particle.lane === 'left')).toHaveLength(7)
    expect(first.filter((particle) => particle.lane === 'right')).toHaveLength(7)
    expect(blueParticles).toHaveLength(8)
    expect(goldParticles).toHaveLength(6)
    expect(first.every((particle) => particle.xPercent <= 15.5 || particle.xPercent >= 84.5)).toBe(true)
    expect(first.every((particle) => Math.abs(particle.driftXPx) <= 6 && Math.abs(particle.driftYPx) <= 6)).toBe(true)
    expect(blueParticles.every((particle) => particle.sizePx >= 18 && particle.peakOpacity >= 0.68)).toBe(true)
    expect(goldParticles.every((particle) => particle.peakOpacity <= 0.58)).toBe(true)
    expect(first.every((particle) => particle.peakOpacity <= 0.82)).toBe(true)
    expect(particles).toHaveLength(14)
    expect(container.querySelectorAll('.growth-ambient-stars__lane')).toHaveLength(2)
    expect(container.querySelector('.growth-ambient-stars')?.getAttribute('data-growth-ambient-particle-count')).toBe('14')
    expect(container.querySelector('.growth-ambient-stars__lane--left')?.querySelectorAll('.growth-ambient-stars__particle')).toHaveLength(7)
    expect(container.querySelector('.growth-ambient-stars__lane--right')?.querySelectorAll('.growth-ambient-stars__particle')).toHaveLength(7)
    expect(container.querySelectorAll('[data-growth-ambient-tone="blue"]')).toHaveLength(8)
    expect(container.querySelectorAll('[data-growth-ambient-tone="gold"]')).toHaveLength(6)
    expect(particles.every((particle) => particle.style.getPropertyValue('--growth-ambient-star-sprite').includes('/star-particles.webp'))).toBe(true)
    expect(particles.every((particle) => Number(particle.style.getPropertyValue('--growth-ambient-return-opacity')) <= 0.574)).toBe(true)
    expect(particles.every((particle) => Number(particle.style.getPropertyValue('--growth-ambient-base-opacity')) <= 0.197)).toBe(true)
    expect(GROWTH_AMBIENT_LANE_WIDTH_PERCENT).toBe(21)
  })

  it('renders nothing outside the approved embedded-habitat stages', () => {
    const { container } = render(<GrowthAmbientStars node={1} spriteUrl="/star-particles.webp" />)
    expect(container.firstChild).toBeNull()
  })
})
