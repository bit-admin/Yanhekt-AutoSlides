import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, markRaw, nextTick, ref, watch, type EffectScope } from "vue";
import { Events, ErrorDetails, ErrorTypes } from "hls.js";
import type { SessionData } from "../../lib/api";
import type { Course } from "../useCourseList";
import { DUAL_STREAM_KEY, useVideoPlayer } from "./useVideoPlayer";

const mocks = vi.hoisted(() => {
  const state = { supported: true, resume: null as number | null };
  const instances: MockHls[] = [];
  class MockHls {
    static isSupported() { return state.supported; }
    handlers = new Map<string, Array<(event: string, data: unknown) => void>>();
    url = "";
    loadSource = vi.fn((url: string) => { this.url = url; });
    attachMedia = vi.fn();
    stopLoad = vi.fn();
    startLoad = vi.fn();
    recoverMediaError = vi.fn();
    destroy = vi.fn();
    constructor(public config: Record<string, unknown>) { instances.push(this); }
    on(event: string, handler: (event: string, data: unknown) => void) {
      const handlers = this.handlers.get(event) ?? [];
      handlers.push(handler);
      this.handlers.set(event, handlers);
    }
    emit(event: string, data: unknown = {}) {
      for (const handler of this.handlers.get(event) ?? []) handler(event, data);
    }
  }
  return {
    state, instances, MockHls,
    probe: vi.fn(async (): Promise<"allowed" | "blocked" | "unknown"> => "allowed"),
    runtime: { config: { value: { relay: { mode: "binding", origin: "" } } } },
  };
});

vi.mock("hls.js", async (importOriginal) => ({
  ...await importOriginal<typeof import("hls.js")>(),
  default: mocks.MockHls,
}));
vi.mock("../../stores/authStore", () => ({ authStore: { token: { value: "test-token" } } }));
vi.mock("../../stores/configStore", () => ({
  configStore: { relayEndpoint: "", resumeFromServerProgress: true },
}));
vi.mock("../../stores/runtimeConfigStore", () => ({
  runtimeConfigStore: mocks.runtime,
  ensureRuntimeConfig: vi.fn(async () => undefined),
}));
vi.mock("../../lib/relayDiagnostics", () => ({ probeRelayReach: mocks.probe }));
vi.mock("../../lib/api", () => ({ getMicAudioUrl: vi.fn(async () => undefined) }));
vi.mock("./useWatchProgress", () => ({
  createWatchProgressSync: () => ({
    resume: async () => mocks.state.resume,
    start: vi.fn(), stop: vi.fn(), fragmentLoader: () => undefined,
  }),
}));

function videoElement() {
  const target = Object.assign(new EventTarget(), {
    currentTime: 0, duration: 3600, paused: true, ended: false, readyState: 0,
    playbackRate: 1, volume: 1, muted: false, src: "",
    error: null as { code: number; message: string } | null,
    canPlayType: () => "probably",
    play: vi.fn(async () => undefined), pause: vi.fn(),
    load: vi.fn(), setAttribute: vi.fn(),
    removeAttribute: vi.fn((name: string) => { if (name === "src") target.src = ""; }),
  });
  return markRaw(target as unknown as HTMLVideoElement);
}

const missingPlaylist = (code = 404) => ({
  fatal: true, type: ErrorTypes.NETWORK_ERROR,
  details: ErrorDetails.MANIFEST_LOAD_ERROR,
  response: { code, text: "", url: "" },
});

async function settle() {
  for (let i = 0; i < 6; i++) await Promise.resolve();
  await nextTick();
}

let scope: EffectScope;
let player: ReturnType<typeof useVideoPlayer>;

async function open(mode: "live" | "recorded" = "recorded") {
  scope = effectScope();
  player = scope.run(() => useVideoPlayer({
    mode, course: ref({
      id: "fixture-course", target: "https://media.example/camera.m3u8",
      target_vga: "https://media.example/screen.m3u8",
    } as Course),
    session: ref({
      session_id: "fixture-session", video_id: "fixture-video",
      main_url: "https://media.example/camera.m3u8",
      vga_url: "https://media.example/screen.m3u8",
    } as SessionData),
  }))!;
  player.videoPlayer.value = videoElement();
  await player.loadVideoStreams();
  return mocks.instances.at(-1)!;
}

async function openDual() {
  await open();
  const single = player.videoPlayer.value!;
  player.cameraVideoPlayer.value = videoElement();
  player.screenVideoPlayer.value = videoElement();
  player.selectedStream.value = DUAL_STREAM_KEY;
  await player.switchStream();
  player.videoPlayer.value = null;
  player.screenVideoPlayer.value!.currentTime = 125;
  scope.run(() => watch(player.isDualStreamSelected, (isDual) => {
    if (!isDual) player.videoPlayer.value = single;
  }, { flush: "sync" }));
  return { camera: mocks.instances.at(-2)!, screen: mocks.instances.at(-1)! };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("__DEMO__", false);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  mocks.state.supported = true;
  mocks.state.resume = null;
  mocks.instances.length = 0;
  mocks.runtime.config.value.relay = { mode: "binding", origin: "" };
  mocks.probe.mockReset().mockResolvedValue("allowed");
});

afterEach(() => {
  player?.cleanup();
  scope?.stop();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("web stream fallback", () => {
  it("switches a missing screen playlist to the camera without retries, at the same position and rate", async () => {
    const screen = await open();
    player.videoPlayer.value!.currentTime = 125;
    player.currentPlaybackRate.value = 2;
    screen.emit(Events.ERROR, missingPlaylist());
    await settle();

    expect(player.selectedStream.value).toBe("main");
    expect(player.fallbackNotice.value).toEqual({ from: "screen", to: "camera", reason: "missing" });
    expect(mocks.instances.at(-1)!.config.startPosition).toBe(125);
    expect(screen.startLoad).not.toHaveBeenCalled();
    mocks.instances.at(-1)!.emit(Events.MANIFEST_PARSED);
    await vi.advanceTimersByTimeAsync(400);
    expect(player.videoPlayer.value!.playbackRate).toBe(2);
    expect(player.error.value).toBeNull();
  });

  it("joins the surviving live stream at its live edge rather than seeking into the old stream's clock", async () => {
    const screen = await open("live");
    player.videoPlayer.value!.currentTime = 125;
    screen.emit(Events.ERROR, missingPlaylist());
    await settle();
    expect(player.selectedStream.value).toBe("camera");
    expect(mocks.instances.at(-1)!.config.startPosition).toBeUndefined();
    expect(player.fallbackNotice.value?.reason).toBe("missing");
  });

  it("preserves the saved resume point if the first stream fails before it becomes playable", async () => {
    mocks.state.resume = 650;
    const screen = await open();
    screen.emit(Events.ERROR, missingPlaylist(410));
    await settle();
    expect(mocks.instances.at(-1)!.config.startPosition).toBe(650);
  });

  it("moves on from an empty finished stream, but not an empty live playlist", async () => {
    const screen = await open();
    screen.emit(Events.LEVEL_LOADED, { details: { live: true, totalduration: 0 } });
    expect(player.selectedStream.value).toBe("vga");
    screen.emit(Events.LEVEL_LOADED, { details: { live: false, totalduration: 0 } });
    await settle();
    expect(player.selectedStream.value).toBe("main");
    expect(player.fallbackNotice.value?.reason).toBe("empty");
    expect(player.visibleEmptyStreamTypes.value).toEqual([]);
  });

  it("reports the final error instead of looping back to another failed stream", async () => {
    const screen = await open();
    screen.emit(Events.ERROR, missingPlaylist());
    await settle();
    mocks.instances.at(-1)!.emit(Events.ERROR, missingPlaylist());
    await settle();
    expect(player.error.value).toMatch(/not found/);
    expect(player.fallbackNotice.value).toBeNull();
    expect(mocks.instances).toHaveLength(2);
  });

  it("lets a manual pick retry that stream and clears the notice", async () => {
    const screen = await open();
    screen.emit(Events.ERROR, missingPlaylist());
    await settle();
    player.selectedStream.value = "vga";
    await player.switchStream();
    expect(player.fallbackNotice.value).toBeNull();
    expect(player.selectedStream.value).toBe("vga");
    // The camera now fails; the manually retried screen is available again.
    player.selectedStream.value = "main";
    await player.switchStream();
    mocks.instances.at(-1)!.emit(Events.ERROR, missingPlaylist());
    await settle();
    expect(player.selectedStream.value).toBe("vga");
    expect(player.error.value).toBeNull();
  });

  it("reloads with an empty failed-stream set", async () => {
    const screen = await open();
    screen.emit(Events.ERROR, missingPlaylist());
    await settle();
    player.retryLoad();
    await settle();
    expect(player.selectedStream.value).toBe("vga");
    expect(player.fallbackNotice.value).toBeNull();
    mocks.instances.at(-1)!.emit(Events.ERROR, missingPlaylist());
    await settle();
    expect(player.selectedStream.value).toBe("main");
    expect(player.error.value).toBeNull();
  });

  it("exhausts ordinary network recovery before falling back, without retrying the new source with old timers", async () => {
    const screen = await open();
    const forbidden = missingPlaylist(403);
    screen.emit(Events.ERROR, forbidden);
    await settle();
    expect(player.selectedStream.value).toBe("vga");
    expect(player.fallbackNotice.value).toBeNull();
    for (let i = 0; i < 3; i++) screen.emit(Events.ERROR, forbidden);
    await settle();
    expect(player.selectedStream.value).toBe("main");
    expect(player.fallbackNotice.value?.reason).toBe("failed");
    const camera = mocks.instances.at(-1)!;
    await vi.advanceTimersByTimeAsync(6000);
    expect(camera.loadSource).toHaveBeenCalledTimes(1);
  });

  it("does not apply delayed media recovery from the old stream to its replacement", async () => {
    const screen = await open();
    screen.emit(Events.ERROR, {
      fatal: true, type: ErrorTypes.MEDIA_ERROR, details: ErrorDetails.BUFFER_APPEND_ERROR,
    });
    screen.emit(Events.ERROR, missingPlaylist());
    await settle();
    const camera = mocks.instances.at(-1)!;
    await vi.advanceTimersByTimeAsync(2000);
    expect(camera.recoverMediaError).not.toHaveBeenCalled();
  });

  it("leaves relay access failures on the existing explanation instead of falling back", async () => {
    mocks.runtime.config.value.relay = { mode: "direct", origin: "https://relay.example" };
    mocks.probe.mockResolvedValue("blocked");
    const screen = await open();
    screen.emit(Events.ERROR, { fatal: true, type: ErrorTypes.OTHER_ERROR, details: "internalException" });
    await settle();
    expect(player.errorKind.value).toBe("relay_offcampus");
    expect(player.selectedStream.value).toBe("vga");
    expect(player.fallbackNotice.value).toBeNull();
    expect(mocks.instances).toHaveLength(1);
  });

  it("ignores errors from an old HLS instance after switching", async () => {
    const screen = await open();
    player.selectedStream.value = "main";
    await player.switchStream();
    screen.emit(Events.ERROR, missingPlaylist());
    await settle();
    expect(player.selectedStream.value).toBe("main");
    expect(player.fallbackNotice.value).toBeNull();
    expect(player.error.value).toBeNull();
  });

  it.each(["camera", "screen"] as const)("leaves dual mode for the surviving stream when %s is missing", async (type) => {
    const streams = await openDual();
    streams[type].emit(Events.ERROR, missingPlaylist());
    await settle();
    expect(player.selectedStream.value).toBe(type === "camera" ? "vga" : "main");
    expect(player.fallbackNotice.value).toEqual({
      from: type, to: type === "camera" ? "screen" : "camera", reason: "missing",
    });
    expect(mocks.instances.at(-1)!.config.startPosition).toBe(125);
    expect(player.error.value).toBeNull();
  });

  it("moves on when native HLS reports a recording with zero duration", async () => {
    mocks.state.supported = false;
    await open();
    Object.assign(player.videoPlayer.value!, { duration: 0 });
    player.videoPlayer.value!.dispatchEvent(new Event("loadedmetadata"));
    await settle();
    expect(player.selectedStream.value).toBe("main");
    expect(player.fallbackNotice.value?.reason).toBe("empty");
  });

  it("classifies a native-HLS missing playlist and preserves position", async () => {
    mocks.state.supported = false;
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    await open();
    const video = player.videoPlayer.value!;
    video.currentTime = 80;
    Object.assign(video, { error: { code: 4, message: "unsupported source" } });
    await player.onVideoError({ target: video } as unknown as Event);
    await settle();
    expect(player.selectedStream.value).toBe("main");
    expect(player.fallbackNotice.value?.reason).toBe("missing");
    video.dispatchEvent(new Event("loadedmetadata"));
    await vi.advanceTimersByTimeAsync(150);
    expect(video.currentTime).toBe(80);
  });

  it.each(["camera", "screen"] as const)("handles native-HLS failure in the %s dual pane and removes old listeners", async (type) => {
    mocks.state.supported = false;
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 410 })));
    await openDual();
    const video = type === "camera" ? player.cameraVideoPlayer.value! : player.screenVideoPlayer.value!;
    Object.assign(video, { error: { code: 4, message: "unsupported source" } });
    video.dispatchEvent(new Event("error"));
    await settle();
    expect(player.selectedStream.value).toBe(type === "camera" ? "vga" : "main");
    expect(player.fallbackNotice.value?.reason).toBe("missing");
    const fetchCount = vi.mocked(fetch).mock.calls.length;
    video.dispatchEvent(new Event("error"));
    await settle();
    expect(vi.mocked(fetch).mock.calls).toHaveLength(fetchCount);
  });

  it("ignores a native status probe that finishes after a manual stream switch", async () => {
    mocks.state.supported = false;
    let resolveProbe!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { resolveProbe = resolve; })));
    await open();
    const video = player.videoPlayer.value!;
    Object.assign(video, { error: { code: 4, message: "unsupported source" } });
    const failure = player.onVideoError({ target: video } as unknown as Event);
    await settle();
    player.selectedStream.value = "main";
    await player.switchStream();
    resolveProbe(new Response("", { status: 404 }));
    await failure;
    expect(player.selectedStream.value).toBe("main");
    expect(player.fallbackNotice.value).toBeNull();
    expect(player.error.value).toBeNull();
  });
});
