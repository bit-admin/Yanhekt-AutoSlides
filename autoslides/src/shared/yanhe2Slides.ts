/**
 * Yanhe 2.0 server slides — the slide list aita detects after a lecture.
 *
 * One row per change the server saw on the screen recording: when it happened
 * and the frame at that moment. It is raw change detection (no deduplication,
 * no filtering), and a lecture may have none.
 */

export interface Yanhe2Slide {
  /** When the slide appeared, in seconds on the screen recording's clock. */
  seconds: number;
  /** The 1280×720 JPEG. What the renderer gets is a local proxy URL. */
  url: string;
}
