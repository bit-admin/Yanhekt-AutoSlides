/**
 * Stand-in for `hls.js` in the demo build.
 *
 * The demo ships no media. `useVideoPlayer` / `useDualStreamPlayer` both check
 * `__DEMO__ && demoHooks.playback` and hand the element to `demo/playback.ts`
 * instead — see lib/demoRegistry.ts — so `new Hls(...)` is unreachable here.
 * Rollup cannot prove that (`demoHooks.playback` is a mutable property), so
 * without this alias the demo ships 745 kB of player it can never construct.
 *
 * The enums are Proxies that echo the key back as its value. hls.js's real
 * enums are string enums, and the app only ever compares them against each
 * other, so echoing keeps every comparison self-consistent. It also means a
 * future `ErrorDetails.SOMETHING_NEW` resolves to a distinct string rather
 * than silently to `undefined`, which is the failure mode a hand-listed set of
 * keys would have — and one that would only ever show up in the demo build.
 */

const echoEnum = new Proxy(
  {},
  { get: (_target, key) => (typeof key === "string" ? key : undefined) },
) as Record<string, string>;

export const Events = echoEnum;
export const ErrorTypes = echoEnum;
export const ErrorDetails = echoEnum;

export default class HlsUnavailableInDemo {
  /** False, so any caller that did reach this falls through to native HLS. */
  static isSupported(): boolean {
    return false;
  }

  constructor() {
    // Reaching this means the playback hook was not installed — a real bug in
    // the demo bootstrap, worth failing loudly rather than papering over.
    throw new Error(
      "AutoSlides demo: hls.js is not bundled in the demo build; playback goes through demoHooks.playback.",
    );
  }
}
