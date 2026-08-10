import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AppMark } from './AppMark'

describe('AppMark', () => {
  it('renders a neutral accessible SVG with a viewBox', () => {
    const html = renderToStaticMarkup(createElement(AppMark, { size: 48 }))
    expect(html).toContain('<svg')
    expect(html).toContain('viewBox="0 0 64 64"')
    expect(html).toContain('width="48"')
    expect(html).toContain('height="48"')
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="減脂追蹤"')
    expect(html).not.toContain('<text')
  })

  it('is hidden from assistive technology when decorative', () => {
    const html = renderToStaticMarkup(createElement(AppMark, { decorative: true, label: '不應公開' }))
    expect(html).toContain('aria-hidden="true"')
    expect(html).not.toContain('aria-label=')
    expect(html).not.toContain('role="img"')
    expect(html).not.toContain('不應公開')
  })
})
