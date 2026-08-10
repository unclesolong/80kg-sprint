/** @vitest-environment jsdom */

import indexHtml from '../index.html?raw'
import { beforeEach, describe, expect, it } from 'vitest'
import { UI_THEME_KEY, applyDocumentTheme, markAppReady, normalizeTheme, readThemeMirror } from './theme'

const relativeLuminance = (hex: string) => {
  const value = Number.parseInt(hex.slice(1), 16)
  const linear = (channel: number) => {
    const normalized = channel / 255
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * linear((value >> 16) & 255)
    + 0.7152 * linear((value >> 8) & 255)
    + 0.0722 * linear(value & 255)
}

const contrastRatio = (foreground: string, background: string) => {
  const foregroundLuminance = relativeLuminance(foreground)
  const backgroundLuminance = relativeLuminance(background)
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
    / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
}

describe('theme utility', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.removeAttribute('data-app-ready')
    document.documentElement.style.colorScheme = ''
    document.head.innerHTML = '<meta name="theme-color" content="#000000">'
  })

  it('keeps normal text and semantic action foregrounds at WCAG AA contrast', () => {
    const pairs = [
      ['#f5f7f5', '#090c0a'],
      ['#a2aca5', '#121714'],
      ['#172019', '#f3f5f2'],
      ['#5f6b63', '#ffffff'],
      ['#082113', '#65d38e'],
      ['#082113', '#2eae68'],
      ['#ffffff', '#126d39'],
      ['#ffffff', '#0d5b2f'],
      ['#22090b', '#ef6d74'],
      ['#ffffff', '#a52b34'],
      ['#126d39', '#e7f0eb'],
      ['#155d9e', '#e8eff5'],
      ['#765000', '#f1eee6'],
      ['#a52b34', '#f6eaeb'],
      ['#d594f5', '#121714'],
      ['#75328f', '#ffffff']
    ] as const

    for (const [foreground, background] of pairs) {
      expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('normalizes every unknown value to dark', () => {
    expect(normalizeTheme('light')).toBe('light')
    expect(normalizeTheme('dark')).toBe('dark')
    expect(normalizeTheme('LIGHT')).toBe('dark')
    expect(normalizeTheme(undefined)).toBe('dark')
  })

  it('reads only valid mirror values and safely handles blocked storage', () => {
    let requestedKey: string | undefined
    expect(readThemeMirror({ getItem: (key) => { requestedKey = key; return 'light' } })).toBe('light')
    expect(requestedKey).toBe(UI_THEME_KEY)
    expect(readThemeMirror({ getItem: () => 'system' })).toBe('dark')
    expect(readThemeMirror({ getItem: () => { throw new DOMException('blocked') } })).toBe('dark')
  })

  it('applies light theme, color scheme, status-bar color and the UI-only mirror', () => {
    const writes: Array<[string, string]> = []
    expect(applyDocumentTheme('light', {
      document,
      storage: { setItem: (key, value) => { writes.push([key, value]) } }
    })).toBe('light')

    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.documentElement.style.colorScheme).toBe('light')
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#f3f5f2')
    expect(writes).toEqual([[UI_THEME_KEY, 'light']])
  })

  it('falls back to dark and remains usable when mirror writes fail', () => {
    expect(() => applyDocumentTheme('unknown', {
      document,
      storage: { setItem: () => { throw new DOMException('blocked') } }
    })).not.toThrow()
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#0a0d0c')
  })

  it('allows authoritative IndexedDB settings to correct an earlier mirror theme', () => {
    const writes: string[] = []
    const storage = {
      getItem: () => 'light',
      setItem: (_key: string, value: string) => { writes.push(value) }
    }

    applyDocumentTheme(readThemeMirror(storage), { document, storage })
    expect(document.documentElement.dataset.theme).toBe('light')
    applyDocumentTheme('dark', { document, storage })
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(writes).toEqual(['light', 'dark'])
  })

  it('sets only the diagnostic app-ready flag', () => {
    markAppReady(document)
    expect(document.documentElement.dataset.appReady).toBe('true')
    expect(Object.keys(document.documentElement.dataset).sort()).toEqual(['appReady'])
  })
})

describe('index critical bootstrap', () => {
  it('runs the safe theme bootstrap before React and provides a readable static fallback', () => {
    const bootstrapPosition = indexHtml.indexOf(`const KEY = '${UI_THEME_KEY}'`)
    const criticalCssPosition = indexHtml.indexOf('id="critical-theme"')
    const reactPosition = indexHtml.indexOf('src="/src/main.tsx"')

    expect(bootstrapPosition).toBeGreaterThan(0)
    expect(criticalCssPosition).toBeGreaterThan(bootstrapPosition)
    expect(reactPosition).toBeGreaterThan(criticalCssPosition)
    expect(indexHtml).toContain('class="boot-fallback" role="status"')
    expect(indexHtml).toContain('正在讀取此裝置的紀錄…')
    expect(indexHtml).toContain('<strong>減脂追蹤</strong>')
    expect(indexHtml).toContain('html[data-theme=\'light\']')
    expect(indexHtml).not.toContain('<div id="root"></div>')
  })

  it('uses the neutral public name without changing internal paths', () => {
    expect(indexHtml).toContain('<title>減脂追蹤</title>')
    expect(indexHtml).toContain('apple-mobile-web-app-title" content="減脂追蹤"')
    expect(indexHtml).not.toContain('80KG Sprint')
    expect(indexHtml).toContain('href="./apple-touch-icon.png"')
  })

  it('executes with light, invalid and blocked localStorage without leaking another key', () => {
    const source = indexHtml.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1]
    expect(source).toBeDefined()
    const bootstrap = new Function('document', 'localStorage', source!)

    const run = (getItem: (key: string) => string | null) => {
      const requestedKeys: string[] = []
      const root = { dataset: {} as Record<string, string>, style: {} as Record<string, string> }
      let themeColor = ''
      const documentStub = {
        documentElement: root,
        querySelector: () => ({ setAttribute: (_name: string, value: string) => { themeColor = value } })
      }
      expect(() => bootstrap(documentStub, { getItem: (key: string) => { requestedKeys.push(key); return getItem(key) } })).not.toThrow()
      return { root, requestedKeys, themeColor }
    }

    expect(run(() => 'light')).toEqual({
      root: { dataset: { theme: 'light' }, style: { colorScheme: 'light' } },
      requestedKeys: [UI_THEME_KEY],
      themeColor: '#f3f5f2'
    })
    expect(run(() => 'system').root.dataset.theme).toBe('dark')
    expect(run(() => { throw new DOMException('blocked') }).root.dataset.theme).toBe('dark')
  })
})
