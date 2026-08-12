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
  it.each([2, 3, 4] as const)('uses eight deterministic particles in safe perimeter lanes for stage %s', (node) => {
    const first = getGrowthAmbientStarLayout(node)
    const repeated = getGrowthAmbientStarLayout(node)
    const { container } = render(<GrowthAmbientStars node={node} spriteUrl="/star-particles.webp" />)
    const particles = [...container.querySelectorAll<HTMLElement>('.growth-ambient-stars__particle')]

    expect(first).toBe(repeated)
    expect(first).toHaveLength(8)
    expect(first.filter((particle) => particle.lane === 'left')).toHaveLength(4)
    expect(first.filter((particle) => particle.lane === 'right')).toHaveLength(4)
    expect(first.every((particle) => particle.xPercent <= 14.5 || particle.xPercent >= 85.5)).toBe(true)
    expect(first.every((particle) => Math.abs(particle.driftXPx) <= 6 && Math.abs(particle.driftYPx) <= 6)).toBe(true)
    expect(first.every((particle) => particle.peakOpacity <= 0.5)).toBe(true)
    expect(particles).toHaveLength(8)
    expect(container.querySelectorAll('.growth-ambient-stars__lane')).toHaveLength(2)
    expect(container.querySelector('.growth-ambient-stars__lane--left')?.querySelectorAll('.growth-ambient-stars__particle')).toHaveLength(4)
    expect(container.querySelector('.growth-ambient-stars__lane--right')?.querySelectorAll('.growth-ambient-stars__particle')).toHaveLength(4)
    expect(particles.every((particle) => particle.style.getPropertyValue('--growth-ambient-star-sprite').includes('/star-particles.webp'))).toBe(true)
    expect(particles.every((particle) => Number(particle.style.getPropertyValue('--growth-ambient-return-opacity')) <= 0.29)).toBe(true)
    expect(GROWTH_AMBIENT_LANE_WIDTH_PERCENT).toBe(21)
  })

  it('renders nothing outside the approved embedded-habitat stages', () => {
    const { container } = render(<GrowthAmbientStars node={5} spriteUrl="/star-particles.webp" />)
    expect(container.firstChild).toBeNull()
  })
})
