// @vitest-environment jsdom

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WelcomePage } from './WelcomePage'

afterEach(cleanup)

const props = () => ({
  onStartTracking: vi.fn(),
  onStartAIPlan: vi.fn(),
  onImportBackup: vi.fn()
})

describe('WelcomePage', () => {
  it('offers neutral tracking, AI planning and backup paths without prescribing targets', () => {
    const html = renderToStaticMarkup(createElement(WelcomePage, props()))

    expect(html).toContain('歡迎使用減脂追蹤')
    expect(html).toContain('建立個人計畫')
    expect(html).toContain('可選 AI 分析')
    expect(html).toContain('先開始每日記錄')
    expect(html).toContain('匯入追蹤與培育備份')
    expect(html).toContain('靜止能量')
    expect(html).toContain('活動能量')
    expect(html).toContain('本機優先')
    expect(html).toContain('明確同意')
    expect(html).not.toMatch(/1700|1850|660|Apple Watch|雞胸/)
  })

  it('routes each setup choice through its own callback', async () => {
    const callbacks = props()
    render(createElement(WelcomePage, callbacks))

    fireEvent.click(screen.getByRole('button', { name: /建立個人計畫/ }))
    await waitFor(() => expect(callbacks.onStartAIPlan).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: /先開始每日記錄/ }))
    await waitFor(() => expect(callbacks.onStartTracking).toHaveBeenCalledTimes(1))
  })

  it('passes a selected JSON file to the import callback and resets the input', async () => {
    const callbacks = props()
    const { container } = render(createElement(WelcomePage, callbacks))
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!
    const file = new File(['{}'], 'fat-loss-backup.json', { type: 'application/json' })

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(callbacks.onImportBackup).toHaveBeenCalledWith(file))
    await waitFor(() => expect(input.value).toBe(''))
  })

  it('shows a recoverable error without claiming that data changed', async () => {
    const callbacks = props()
    callbacks.onStartAIPlan.mockRejectedValue(new Error('unavailable'))
    render(createElement(WelcomePage, callbacks))

    fireEvent.click(screen.getByRole('button', { name: /建立個人計畫/ }))

    expect((await screen.findByRole('alert')).textContent).toContain('目前資料沒有被清除')
  })
})
