/**
 * Fullscreen with an iPhone fallback.
 *
 * iPhone Safari ships no Element Fullscreen API at all — `requestFullscreen`
 * is undefined on every element (iPad has it, iPhone does not). The player
 * wraps its video in a `<div>` so the custom control bar can ride along in
 * fullscreen, so `container.requestFullscreen()` threw a TypeError straight
 * into the caller's catch and the button did nothing, while Picture-in-Picture
 * — which iPhone does implement — kept working.
 *
 * The one fullscreen an iPhone offers is the video element's own
 * `webkitEnterFullscreen()`, which hands playback to the system player (our
 * overlay controls are not part of that, and cannot be). Falling back to it
 * means the button does the expected thing everywhere; `document.fullscreenElement`
 * simply stays null on that path, so callers tracking fullscreen state see no
 * change — correct, since iOS draws its own chrome over the page.
 */

interface WebkitFullscreenVideo extends HTMLVideoElement {
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
  webkitDisplayingFullscreen?: boolean;
}

/** True when the browser can put an arbitrary element into fullscreen. */
export function supportsElementFullscreen(el: HTMLElement | null): boolean {
  return !!el && typeof el.requestFullscreen === 'function' && document.fullscreenEnabled !== false;
}

/**
 * Toggle fullscreen for a player: the wrapper when the browser supports
 * element fullscreen, otherwise the video element's native iOS fullscreen.
 */
export async function togglePlayerFullscreen(
  container: HTMLElement | null,
  video: HTMLVideoElement | null,
): Promise<void> {
  if (supportsElementFullscreen(container)) {
    if (document.fullscreenElement === container) {
      await document.exitFullscreen();
    } else {
      await container!.requestFullscreen();
    }
    return;
  }

  const native = video as WebkitFullscreenVideo | null;
  if (!native) return;

  if (native.webkitDisplayingFullscreen && typeof native.webkitExitFullscreen === 'function') {
    native.webkitExitFullscreen();
    return;
  }
  if (typeof native.webkitEnterFullscreen === 'function') {
    native.webkitEnterFullscreen();
  }
}
