import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../defaults'
import { TrendsPage } from './TrendsPage'

describe('TrendsPage', () => {
  it('defaults to 14 days and keeps the weight empty state informative', () => {
    const markup = renderToStaticMarkup(createElement(TrendsPage, { logs: [], settings: defaultSettings }))
    expect(markup).toContain('<h1>體重趨勢</h1>')
    expect(markup).toContain('aria-pressed="true">14 日</button>')
    expect(markup).toContain('還沒有體重趨勢')
    expect(markup).toContain('累積 3 筆後開始顯示短期趨勢，7 筆後顯示 7 日平均。')
    expect(markup).not.toContain('查看進階趨勢')
  })
})
