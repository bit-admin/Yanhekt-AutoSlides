/**
 * Playback without a video file.
 *
 * The demo ships no media — a lecture clip would be megabytes of binary in a
 * source repo, and the pages worth showing are the chrome around the video, not
 * the video. So instead of letting hls.js reach for a manifest that does not
 * exist (and then run its whole retry ladder into an error screen), the player
 * hands the element to this stub through `demoHooks.playback`.
 *
 * The trick is that a `<video>` element's `duration`/`currentTime` are
 * ordinary properties as far as the app is concerned: PlaybackPage reads them
 * out of `loadedmetadata` and `timeupdate` events. Redefining them on this one
 * element and firing those events gives a transport bar with a real duration,
 * a sensible position, and a poster frame — all without a byte of media.
 */

import type { DemoExtractionSeed, DemoStreamKind, PlaybackDemo } from "../lib/demoRegistry";
import { cameraPosterSvg, demoDeck, demoSessionId, screenPosterSvg } from "./demoData";
import { demoFolderName } from "./seedSlides";

/** 1h40m, the length of a two-period lecture. */
const DURATION = 100 * 60;
/** Parked a third of the way in: a seek bar at 0 reads as "did not load". */
const POSITION = 34 * 60 + 12;

function freezeClock(video: HTMLVideoElement): void {
  Object.defineProperty(video, "duration", { value: DURATION, configurable: true });
  Object.defineProperty(video, "currentTime", {
    get: () => POSITION,
    // Seeks are accepted and ignored: the bar animates, nothing else happens.
    set: () => {},
    configurable: true,
  });
  Object.defineProperty(video, "readyState", { value: 4, configurable: true });
}

function announce(video: HTMLVideoElement): void {
  for (const type of ["loadedmetadata", "durationchange", "canplay", "timeupdate"]) {
    video.dispatchEvent(new Event(type));
  }
}

export const demoPlayback: PlaybackDemo = {
  attach(video: HTMLVideoElement, stream: DemoStreamKind): void {
    video.poster = stream === "camera" ? cameraPosterSvg() : screenPosterSvg();
    // No src at all: the element stays inert and never asks the network for
    // anything, so there is nothing to fail.
    video.removeAttribute("src");
    video.preload = "none";
    freezeClock(video);
    // Let the component's listeners attach first, then report "ready".
    setTimeout(() => announce(video), 0);
  },

  extraction(): DemoExtractionSeed {
    const folder = demoFolderName("501", 9);
    const slides = demoDeck("501")
      .filter((slide) => !slide.trash)
      .slice(0, 4)
      .map((slide, index) => ({
        id: `demo-${demoSessionId("501", 9)}-${index}`,
        title: slide.filename.replace(/\.png$/, ""),
        timestamp: new Date(Date.now() - (4 - index) * 8 * 60000).toISOString(),
        dataUrl: slide.dataUrl,
      }));
    return { folder, slides };
  },
};
