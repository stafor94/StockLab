export const THEME_STORAGE_KEY = 'stocklab.theme'

export type ThemeMode = 'light' | 'dark'

export const DEFAULT_THEME_MODE: ThemeMode = 'light'

const THEME_COLOR: Record<ThemeMode, string> = {
  light: '#f7f8fa',
  dark: '#0b0c0f',
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function readThemeMode(storage: Pick<Storage, 'getItem'> | null = getStorage()): ThemeMode {
  if (!storage) return DEFAULT_THEME_MODE
  try {
    return storage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : DEFAULT_THEME_MODE
  } catch {
    return DEFAULT_THEME_MODE
  }
}

export function applyThemeMode(themeMode: ThemeMode, root: HTMLElement | null = typeof document === 'undefined' ? null : document.documentElement): void {
  if (!root) return
  root.dataset.theme = themeMode
  if (typeof document !== 'undefined') {
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[themeMode])
  }
}

export function setThemeMode(themeMode: ThemeMode, storage: Pick<Storage, 'setItem'> | null = getStorage()): void {
  applyThemeMode(themeMode)
  if (!storage) return
  try {
    storage.setItem(THEME_STORAGE_KEY, themeMode)
  } catch {
    // Keep the selected theme active for this session even when persistence is unavailable.
  }
}

export function initializeThemeMode(): ThemeMode {
  const themeMode = readThemeMode()
  applyThemeMode(themeMode)
  return themeMode
}
