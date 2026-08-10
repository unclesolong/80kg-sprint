import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { DestructiveActionSheet, matchesConfirmationPhrase } from './DestructiveActionSheet'

describe('DestructiveActionSheet', () => {
  it('renders the safe Sprint defaults and leaves permanent deletion disabled', () => {
    const markup = renderToStaticMarkup(createElement(DestructiveActionSheet, { onClose: vi.fn(), onConfirm: vi.fn() }))

    expect(markup).toContain('role="dialog"')
    expect(markup).toContain('aria-modal="true"')
    expect(markup).toContain('清除 7 日 Sprint 資料')
    expect(markup).toContain('DailyLog')
    expect(markup).toContain('Sprint 設定')
    expect(markup).toContain('自訂食物')
    expect(markup).toContain('Planner')
    expect(markup).toContain('匯出的 JSON')
    expect(markup).toContain('輸入「清除」後才能繼續')
    expect(markup).toMatch(/<button[^>]*v6-destructive-action[^>]*disabled=""/)
  })

  it('supports custom text so non-Sprint destructive actions can reuse the sheet', () => {
    const markup = renderToStaticMarkup(createElement(DestructiveActionSheet, {
      title: '撤回 AI 同意',
      deleteItems: ['AI 同意狀態'],
      preserveItems: ['本機紀錄'],
      confirmationPhrase: '撤回',
      confirmLabel: '確認撤回',
      onClose: vi.fn(),
      onConfirm: vi.fn(),
      onExportBackup: vi.fn()
    }))

    expect(markup).toContain('撤回 AI 同意')
    expect(markup).toContain('輸入「撤回」後才能繼續')
    expect(markup).toContain('確認撤回')
    expect(markup).toContain('匯出 JSON 備份')
  })

  it('requires the configured phrase and stays case-sensitive', () => {
    expect(matchesConfirmationPhrase('清除', '清除')).toBe(true)
    expect(matchesConfirmationPhrase('  清除  ', '清除')).toBe(true)
    expect(matchesConfirmationPhrase('撤回', '清除')).toBe(false)
    expect(matchesConfirmationPhrase('DELETE', 'delete')).toBe(false)
    expect(matchesConfirmationPhrase('', '')).toBe(false)
    expect(matchesConfirmationPhrase('   ', '   ')).toBe(false)
  })
})
