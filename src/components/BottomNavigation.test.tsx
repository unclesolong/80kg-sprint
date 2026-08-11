/** @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { BottomNavigation } from './BottomNavigation'

beforeAll(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

afterEach(() => {
  document.body.replaceChildren()
})

describe('BottomNavigation', () => {
  it('exposes growth as a first-class tab without turning quick add into a tab', () => {
    const onSelectTab = vi.fn()
    const onQuickAdd = vi.fn()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    act(() => root.render(<BottomNavigation activeTab="growth" onSelectTab={onSelectTab} onQuickAdd={onQuickAdd} />))

    const growth = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === '潤光')
    const quickAdd = container.querySelector<HTMLButtonElement>('button[aria-label="快速新增"]')
    expect(growth?.getAttribute('aria-current')).toBe('page')
    expect(quickAdd?.getAttribute('aria-current')).toBeNull()

    act(() => growth?.click())
    expect(onSelectTab).toHaveBeenCalledWith('growth')
    expect(onQuickAdd).not.toHaveBeenCalled()

    act(() => quickAdd?.click())
    expect(onQuickAdd).toHaveBeenCalledTimes(1)
    act(() => root.unmount())
  })
})
