// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { GrowthArtworkStack } from './GrowthArtworkStack'

afterEach(cleanup)

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
})
