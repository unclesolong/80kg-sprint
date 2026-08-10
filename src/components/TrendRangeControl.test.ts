import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { TrendRangeControl } from './TrendRangeControl'

describe('TrendRangeControl', () => {
  it('exposes the active local range through aria-pressed', () => {
    const markup = renderToStaticMarkup(createElement(TrendRangeControl, { value: '14d', onChange: vi.fn() }))
    expect(markup).toContain('aria-label="趨勢日期範圍"')
    expect(markup).toContain('aria-pressed="true">14 日</button>')
    expect(markup.match(/aria-pressed="false"/g)).toHaveLength(2)
  })
})
