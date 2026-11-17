import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Events, ErrorTypes } from "hls.js";
import type Hls from "hls.js";
import { setupDualHlsErrorHandler } from "./useVideoErrorRecovery";

type Handler = (event: string, data: unknown) => void;

function fakeHls(video: HTMLVideoElement) {
  const handlers = new Map<string, Handler[]>();
  return {
    media: video as HTMLVideoElement | null,
    recoverMediaError: vi.fn(),
    startLoad: vi.fn(),
    on: (event: string, handler: Handler) => handlers.set(event, [...(handlers.get(event) ?? []), handler]),
    emit: (event: string, data: unknown = {}) => (handlers.get(event) ?? []).forEach((h) => h(event, data)),
  };
}

const mediaError = { fatal: true, type: ErrorTypes.MEDIA_ERROR, details: "bufferAppendError" };

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("dual-stream media recovery", () => {
  it("recovers and nudges the position of its own stream", () => {
    const video = { currentTime: 30 } as HTMLVideoElement;
    const hls = fakeHls(video);
    setupDualHlsErrorHandler(hls as unknown as Hls, video, "screen", { mode: "recorded", onFatal: vi.fn() });
    hls.emit(Events.ERROR, mediaError);
    vi.advanceTimersByTime(500);
    expect(hls.recoverMediaError).toHaveBeenCalledTimes(1);
    expect(video.currentTime).toBe(30.5);
  });

  it("does nothing once its HLS instance was destroyed", () => {
    const video = { currentTime: 30 } as HTMLVideoElement;
    const hls = fakeHls(video);
    setupDualHlsErrorHandler(hls as unknown as Hls, video, "screen", { mode: "recorded", onFatal: vi.fn() });
    hls.emit(Events.ERROR, mediaError);
    hls.emit(Events.DESTROYING);
    video.currentTime = 5;
    vi.advanceTimersByTime(5000);
    expect(hls.recoverMediaError).not.toHaveBeenCalled();
    expect(video.currentTime).toBe(5);
  });

  it("does not seek an element its instance no longer drives", () => {
    const video = { currentTime: 30 } as HTMLVideoElement;
    const hls = fakeHls(video);
    setupDualHlsErrorHandler(hls as unknown as Hls, video, "screen", { mode: "recorded", onFatal: vi.fn() });
    hls.emit(Events.ERROR, mediaError);
    hls.media = null;
    video.currentTime = 5;
    vi.advanceTimersByTime(500);
    expect(video.currentTime).toBe(5);
  });
});
