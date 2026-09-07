/**
 * Runtime override slots — the web analogue of the desktop app's
 * `shared/overrideRegistry.ts`.
 *
 * This module is production infrastructure and knows nothing about the demo:
 * it declares slots, production code reads `demoHooks.x ?? real`, and only the
 * demo build's bootstrap ever fills them in. Deleting `src/demo/` therefore
 * leaves an empty object and a fully real app.
 *
 * It is deliberately tiny. Everything the browser can fake at the network
 * boundary (courses, sessions, notes, login, AI) is faked there instead — see
 * `src/demo/transport.ts`. Only playback needs a slot, because the demo ships
 * no video and hls.js would otherwise run its retry ladder into an error.
 *
 * Every read site is guarded by `__DEMO__`, a compile-time constant, so these
 * branches are dead-code-eliminated from the production bundle.
 */

/** Which of a lecture's two streams a `<video>` element is showing. */
export type DemoStreamKind = "screen" | "camera";

export interface DemoExtractionSeed {
  /** IndexedDB folder the fake run "wrote" into. */
  folder: string;
  slides: Array<{ id: string; title: string; timestamp: string; dataUrl: string }>;
}

export interface PlaybackDemo {
  /**
   * Stand in for a real HLS attach: paint a poster and give the element a
   * plausible duration/position so the transport bar renders, then leave it
   * paused. Called instead of `new Hls(...)`, so no network request is made.
   */
  attach(video: HTMLVideoElement, stream: DemoStreamKind): void;
  /** Pre-captured slides for the extraction panel and its gallery strip. */
  extraction(): DemoExtractionSeed;
}

export interface DemoHooks {
  playback?: PlaybackDemo;
}

export const demoHooks: DemoHooks = {};
