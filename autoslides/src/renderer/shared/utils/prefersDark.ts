/**
 * The renderer never decides colors from `prefers-color-scheme` itself — that
 * swap lives in theme.css tokens. The only legitimate JS use is *re-reading*
 * tokens when the scheme flips (main flips `nativeTheme.themeSource`, which
 * Chromium surfaces as a media-query change). Keep that one listener here so
 * components do not grow their own theme forks.
 */
const QUERY = '(prefers-color-scheme: dark)'

/** Resolve a theme.css custom property to its current literal value. */
export function themeToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/** Invoke `callback` whenever the effective color scheme changes; returns an unsubscribe. */
export function onColorSchemeChange(callback: () => void): () => void {
  const mql = window.matchMedia(QUERY)
  const handler = () => callback()
  mql.addEventListener('change', handler)
  return () => mql.removeEventListener('change', handler)
}
