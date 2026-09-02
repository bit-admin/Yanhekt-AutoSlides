// Generic runtime-environment flags (production infra; demo-agnostic).
//
// `isDemoMode()` reads the preload-exposed flag set by `npm run demo`
// (DEMO_MODE=1 → forwarded as a `--demo-mode` argv entry, read in the preload).
// It lives here — not in the demo folder — so production code that merely *gates*
// on the flag (entry points, onboarding suppression) keeps compiling after the
// demo/ folders are deleted. The flag is simply always false in a normal launch.

export function isDemoMode(): boolean {
  return window.electronAPI?.isDemoMode === true
}

// App version is not part of AppConfig. Prefetch once before mount so onboarding
// resolution in App.vue is synchronous (no empty-frame flash).
let appVersion = ''

export async function loadAppVersion(): Promise<void> {
  try {
    appVersion = (await window.electronAPI.app?.getVersion()) || ''
  } catch {
    appVersion = ''
  }
}

export function getAppVersion(): string {
  return appVersion
}
