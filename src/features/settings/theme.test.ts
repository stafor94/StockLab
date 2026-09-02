import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_THEME_MODE, THEME_STORAGE_KEY, initializeThemeMode, readThemeMode, setThemeMode } from './theme'

afterEach(() => {
  document.documentElement.removeAttribute('data-theme')
})

describe('theme settings', () => {
  it('defaults to light mode when no valid preference is stored', () => {
    expect(readThemeMode()).toBe(DEFAULT_THEME_MODE)

    localStorage.setItem(THEME_STORAGE_KEY, 'unknown')
    expect(readThemeMode()).toBe('light')
  })

  it('restores a stored dark preference before the app renders', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')

    expect(initializeThemeMode()).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('persists and applies theme changes', () => {
    setThemeMode('dark')

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')

    setThemeMode('light')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
