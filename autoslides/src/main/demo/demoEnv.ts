// Main-process demo-launch plumbing.
//
// The renderer's demo data + behavior lives in src/renderer/demo/; this module
// holds the few main-process enablement hooks for `npm run demo` / the
// screenshot script (which set DEMO_MODE=1). Deleting this file plus its call
// sites in main.ts and windowManager.ts removes demo support from the main
// process — real launches are unaffected (the flag is simply never set).

import type { App } from 'electron'

export function isDemoLaunch(): boolean {
  return process.env.DEMO_MODE === '1'
}

// Isolate persistence to a separate `AutoSlides-Demo` userData dir so demo boots
// with fresh defaults and never reads/writes the real profile. Must run BEFORE
// `new ConfigService()` (electron-store resolves its path from userData at
// construction). Pins the app name first so both `electron-forge start` and the
// raw `electron` launch used by the screenshot script resolve the same dir.
export function applyDemoUserData(app: App): void {
  if (!isDemoLaunch()) return
  app.setName('AutoSlides')
  app.setPath('userData', app.getPath('userData') + '-Demo')
}

// webPreferences fragment forwarding the demo flag to a renderer as an argv entry
// (process.env is not dependable in the Vite-built preload bundle). Empty in a
// normal launch. Spread into a BrowserWindow's webPreferences.
export function demoWebPreferences(): { additionalArguments?: string[] } {
  return isDemoLaunch() ? { additionalArguments: ['--demo-mode'] } : {}
}
