/** @vitest-environment jsdom */

import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { OptionalFeatureBoundary } from './OptionalFeatureBoundary'

beforeAll(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('OptionalFeatureBoundary', () => {
  it('contains a feature render failure and can reset without replacing the app shell', () => {
    const Broken = () => { throw new Error('growth render failed') }
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    act(() => root.render(createElement(OptionalFeatureBoundary, {
      resetKey: 0,
      fallback: createElement('p', null, 'growth unavailable'),
      children: createElement(Broken)
    })))

    expect(container.textContent).toBe('growth unavailable')
    expect(consoleError).toHaveBeenCalled()

    act(() => root.render(createElement(OptionalFeatureBoundary, {
      resetKey: 1,
      fallback: createElement('p', null, 'growth unavailable'),
      children: createElement('p', null, 'growth recovered')
    })))
    expect(container.textContent).toBe('growth recovered')
    act(() => root.unmount())
  })
})
