/** @vitest-environment jsdom */

import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { AppErrorBoundary, showMissingRootError } from './AppErrorBoundary'

beforeAll(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

afterEach(() => {
  document.body.replaceChildren()
  document.documentElement.dataset.theme = 'dark'
  vi.restoreAllMocks()
})

describe('AppErrorBoundary', () => {
  it('renders children while the app is healthy', () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    act(() => root.render(createElement(AppErrorBoundary, null, createElement('p', null, 'app ready'))))
    expect(container.textContent).toBe('app ready')
    act(() => root.unmount())
  })

  it('shows a privacy-safe recovery screen without automatically reloading', () => {
    const privateErrorText = 'weight=81.4 health record'
    const BrokenView = () => { throw new Error(privateErrorText) }
    const reload = vi.fn()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    act(() => root.render(createElement(AppErrorBoundary, { onReload: reload, children: createElement(BrokenView) })))

    expect(container.querySelector('[role="alert"]')).not.toBeNull()
    expect(container.textContent).toContain('減脂追蹤無法完成載入')
    expect(container.textContent).toContain('你的裝置紀錄沒有因這個畫面自動刪除。')
    expect(container.textContent).toContain('請先不要清除網站資料。')
    expect(container.textContent).not.toContain(privateErrorText)
    expect(reload).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalled()

    const buttons = Array.from(container.querySelectorAll('button'))
    const help = buttons.find((button) => button.textContent === '查看備份說明')
    const reloadButton = buttons.find((button) => button.textContent === '重新載入')
    expect(help).toBeDefined()
    expect(reloadButton).toBeDefined()
    act(() => help!.click())
    expect(container.textContent).toContain('現在請勿清除 Safari 網站資料或移除 App。')
    act(() => reloadButton!.click())
    expect(reload).toHaveBeenCalledTimes(1)
    act(() => root.unmount())
  })
})

describe('missing root fallback', () => {
  it('appends a visible inline-styled error instead of silently throwing', () => {
    const reload = vi.fn()
    const fallback = showMissingRootError(document.body, reload)

    expect(fallback.getAttribute('role')).toBe('alert')
    expect(fallback.style.minHeight).toBe('100dvh')
    expect(fallback.textContent).toContain('找不到必要的頁面掛載點')
    expect(fallback.textContent).toContain('查看備份說明')
    expect(reload).not.toHaveBeenCalled()
    fallback.querySelector('button')?.click()
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
