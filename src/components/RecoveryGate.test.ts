// @vitest-environment jsdom

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FirstRunState } from '../viewModels/firstRun'
import { RecoveryGate } from './RecoveryGate'

afterEach(cleanup)

const state: FirstRunState = {
  isCompletelyEmpty: false,
  hasCoreHistory: true,
  hasDailyLogs: true,
  hasFoods: true,
  hasPlannerData: true,
  plannerDataUnavailable: false,
  shouldShowWelcome: false,
  shouldBypassLegacyOnboarding: true,
  counts: { dailyLogs: 4, mealLines: 9, foods: 2, plannerPlans: 1, plannerRecords: 5 }
}

describe('RecoveryGate', () => {
  it('shows detected counts and requires a separate create-new confirmation state', () => {
    const html = renderToStaticMarkup(createElement(RecoveryGate, {
      state,
      onContinueExisting: vi.fn(),
      onImportBackup: vi.fn(),
      onCreateNew: vi.fn()
    }))
    expect(html).toContain('發現這台裝置可能曾有紀錄')
    expect(html).toContain('DailyLog')
    expect(html).toContain('4 筆')
    expect(html).toContain('MealLine')
    expect(html).toContain('9 項')
    expect(html).toContain('Planner 全部紀錄')
    expect(html).toContain('繼續使用既有紀錄')
    expect(html).toContain('匯入 JSON 備份')
    expect(html).toContain('type="file"')
    expect(html).toContain('accept=".json,application/json"')
    expect(html).toContain('建立全新設定')
    expect(html).not.toContain('確認建立全新設定')
  })

  it('warns instead of claiming emptiness when Planner data could not load', () => {
    const html = renderToStaticMarkup(createElement(RecoveryGate, {
      state: { ...state, hasPlannerData: false, plannerDataUnavailable: true, counts: { ...state.counts, plannerPlans: 0, plannerRecords: 0 } },
      onContinueExisting: vi.fn(),
      onImportBackup: vi.fn(),
      onCreateNew: vi.fn()
    }))
    expect(html).toContain('Planner 資料暫時無法確認')
    expect(html).toContain('系統不會把此裝置當成全新裝置')
  })

  it('calls create-new only after the second explicit confirmation', async () => {
    const onCreateNew = vi.fn()
    render(createElement(RecoveryGate, {
      state,
      onContinueExisting: vi.fn(),
      onImportBackup: vi.fn(),
      onCreateNew
    }))

    fireEvent.click(screen.getByRole('button', { name: '建立全新設定' }))
    expect(onCreateNew).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '確認建立全新設定' }))
    await waitFor(() => expect(onCreateNew).toHaveBeenCalledTimes(1))
  })

  it('passes a selected JSON File to the recovery import callback', async () => {
    const onImportBackup = vi.fn().mockResolvedValue(undefined)
    const { container } = render(createElement(RecoveryGate, {
      state,
      onContinueExisting: vi.fn(),
      onImportBackup,
      onCreateNew: vi.fn()
    }))
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!
    const file = new File(['{}'], 'core-backup.json', { type: 'application/json' })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(onImportBackup).toHaveBeenCalledWith(file))
    await waitFor(() => expect(input.value).toBe(''))
  })
})
