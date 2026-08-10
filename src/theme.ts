import type { ThemeMode } from './types'

export const UI_THEME_KEY = 'fat-loss-ui-theme-v1'

const themeColors: Record<ThemeMode, string> = {
  dark: '#0a0d0c',
  light: '#f3f5f2'
}

type ThemeStorageReader = Pick<Storage, 'getItem'>
type ThemeStorageWriter = Pick<Storage, 'setItem'>

export interface ThemeApplicationOptions {
  document?: Document
  storage?: ThemeStorageWriter
}

export const normalizeTheme = (value: unknown): ThemeMode => value === 'light' ? 'light' : 'dark'

/** Reads only the non-health UI preference. Missing, invalid or blocked storage is dark. */
export function readThemeMirror(storage?: ThemeStorageReader): ThemeMode {
  try {
    const source = storage ?? (typeof localStorage === 'undefined' ? undefined : localStorage)
    return normalizeTheme(source?.getItem(UI_THEME_KEY))
  } catch {
    return 'dark'
  }
}

/**
 * Applies a normalized theme and mirrors only that appearance preference.
 * IndexedDB settings.theme remains the authoritative source; callers should
 * invoke this after settings load and after a theme save succeeds.
 */
export function applyDocumentTheme(themeInput: unknown, options: ThemeApplicationOptions = {}): ThemeMode {
  const theme = normalizeTheme(themeInput)
  const documentRef = options.document ?? (typeof document === 'undefined' ? undefined : document)

  if (documentRef) {
    const root = documentRef.documentElement
    root.dataset.theme = theme
    root.style.colorScheme = theme
    documentRef.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute('content', themeColors[theme])
  }

  try {
    const storage = options.storage ?? (typeof localStorage === 'undefined' ? undefined : localStorage)
    storage?.setItem(UI_THEME_KEY, theme)
  } catch {
    // A UI preference mirror must never block the app.
  }

  return theme
}

/** Diagnostic-only marker. Never place record data in DOM datasets. */
export function markAppReady(documentRef: Document = document): void {
  documentRef.documentElement.dataset.appReady = 'true'
}
