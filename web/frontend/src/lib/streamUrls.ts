/**
 * Builds the PlaybackData stream map the video player consumes (same shape as
 * the desktop app's videoProxyService.getVideoPlaybackUrls /
 * getLiveStreamUrls results).
 *
 * Recorded streams go through a relay (public Worker or a local Electron LAN
 * relay) that signs Yanhekt's anti-hotlink scheme and rewrites the playlist so
 * any HLS player can stream it. The base URL is configStore.relayEndpoint —
 * default https://relay.ruc.edu.kg. The generated URL embeds the login token —
 * treat it as a secret (never log it or surface it in shareable UI; use
 * original_url for that).
 *
 * Live streams are unsigned and their CDN is CORS-open, so they play
 * directly from the raw m3u8.
 */
import type { LiveStream, SessionData } from "./api";
import { configStore, PUBLIC_RELAY_ENDPOINT } from "../stores/configStore";

export interface VideoStream {
  type: "camera" | "screen";
  name: string;
  url: string;
  original_url: string;
}

export interface PlaybackData {
  streams: Record<string, VideoStream>;
}

/** Current relay origin (no trailing slash). Falls back to the public Worker. */
export function getRelayBase(): string {
  const ep = (configStore.relayEndpoint || "").trim().replace(/\/+$/, "");
  return ep || PUBLIC_RELAY_ENDPOINT;
}

function relayPlaylistUrl(m3u8Url: string, loginToken: string): string {
  return `${getRelayBase()}/playlist?u=${encodeURIComponent(m3u8Url)}&t=${encodeURIComponent(loginToken)}`;
}

/** Recorded sessions: main_url = camera, vga_url = screen; keys match the desktop app. */
export function getRecordedPlaybackData(session: SessionData, loginToken: string): PlaybackData {
  const streams: Record<string, VideoStream> = {};

  if (session.main_url) {
    streams.main = {
      type: "camera",
      name: "Camera",
      url: relayPlaylistUrl(session.main_url, loginToken),
      original_url: session.main_url,
    };
  }

  if (session.vga_url) {
    streams.vga = {
      type: "screen",
      name: "Screen",
      url: relayPlaylistUrl(session.vga_url, loginToken),
      original_url: session.vga_url,
    };
  }

  return { streams };
}

/** Live streams: target = camera, target_vga = screen; played directly. */
export function getLivePlaybackData(stream: Pick<LiveStream, "target" | "target_vga">): PlaybackData {
  const streams: Record<string, VideoStream> = {};

  if (stream.target) {
    streams.camera = {
      type: "camera",
      name: "Camera",
      url: stream.target,
      original_url: stream.target,
    };
  }

  if (stream.target_vga) {
    streams.screen = {
      type: "screen",
      name: "Screen",
      url: stream.target_vga,
      original_url: stream.target_vga,
    };
  }

  return { streams };
}
