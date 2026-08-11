import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { UpdateSafetySheet, formatIntegrityDateRange } from './UpdateSafetySheet'

const summary = {
  logCount: 10,
  mealLineCount: 68,
  workoutCount: 4,
  earliestDate: '2026-08-01',
  latestDate: '2026-08-10'
}

describe('UpdateSafetySheet', () => {
  it('renders an accessible integrity summary and requires explicit backup acknowledgement', () => {
    const markup = renderToStaticMarkup(createElement(UpdateSafetySheet, {
      summary,
      onExportCore: vi.fn(),
      onClose: vi.fn(),
      onConfirmUpdate: vi.fn()
    }))

    expect(markup).toContain('role="dialog"')
    expect(markup).toContain('aria-modal="true"')
    expect(markup).toContain('匯出追蹤與培育 JSON')
    expect(markup).toContain('更新前確認')
    expect(markup).toContain('每日紀錄</dt><dd>10 筆')
    expect(markup).toContain('餐點項目</dt><dd>68 項')
    expect(markup).toContain('運動紀錄</dt><dd>4 筆')
    expect(markup).toContain('8/1–8/10')
    expect(markup).toContain('我已完成備份，並確認備份檔可開啟')
    expect(markup).toMatch(/<button[^>]*class="v6-primary-action"[^>]*disabled=""/)
    expect(markup).toContain('已完成備份，立即更新')
    expect(markup).not.toContain('匯出長期計畫備份')
  })

  it('shows long-term plan export only when plan data and a callback are both available', () => {
    const markup = renderToStaticMarkup(createElement(UpdateSafetySheet, {
      summary,
      hasPlanner: true,
      onExportCore: vi.fn(),
      onExportPlanner: vi.fn(),
      onClose: vi.fn(),
      onConfirmUpdate: vi.fn()
    }))

    expect(markup).toContain('匯出長期計畫備份')
  })

  it('formats same-day, ranged and empty integrity dates without timezone conversion', () => {
    expect(formatIntegrityDateRange({ earliestDate: '2026-08-03', latestDate: '2026-08-03' })).toBe('8/3')
    expect(formatIntegrityDateRange({ earliestDate: '2026-08-01', latestDate: '2026-08-10' })).toBe('8/1–8/10')
    expect(formatIntegrityDateRange({})).toBe('—')
  })
})
