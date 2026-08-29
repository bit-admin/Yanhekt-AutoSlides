/**
 * Builds the PlaybackData stream map the video player consumes (same shape as
 * the desktop app's videoProxyService.getVideoPlaybackUrls /
 * getLiveStreamUrls results).
 *
 * Recorded streams go through a relay that signs Yanhekt's anti-hotlink
 * scheme and rewrites the playlist so any HLS player can stream it. Empty
 * `configStore.relayEndpoint` (the default) uses this origin's `/playlist`
 * (the web Worker service-binds the sibling relay). A custom origin is a
 * LAN / local `wrangler dev` relay. The generated URL embeds the login
 * token — treat it as a secret (never log it or surface it in shareable UI;
 * use original_url for that).
 *
 * Live streams are unsigned and their CDN is CORS-open, so they play
 * directly from the raw m3u8.
 */
import type { LiveStream, SessionData } from "./api";
import { configStore } from "../stores/configStore";

export interface VideoStream {
  type: "camera" | "screen";
  name: string;
  url: string;
  original_url: string;
}

export interface PlaybackData {
  streams: Record<string, VideoStream>;
}

/** Current custom relay origin (no trailing slash), or "" for built-in. */
export function getRelayBase(): string {
  return (configStore.relayEndpoint || "").trim().replace(/\/+$/, "");
}

function relayPlaylistUrl(m3u8Url: string, loginToken: string): string {
  const query = `/playlist?u=${encodeURIComponent(m3u8Url)}&t=${encodeURIComponent(loginToken)}`;
  const base = getRelayBase();
  return base ? `${base}${query}` : query;
}

/** Yanhekt sometimes JSON-escapes slashes in stream URLs (`https:\/\/...`). */
function fixUrlEscaping(url: string): string {
  return url.replace(/\\\//g, "/");
}

/** Recorded sessions: main_url = camera, vga_url = screen; keys match the desktop app. */
export function getRecordedPlaybackData(session: SessionData, loginToken: string): PlaybackData {
  const streams: Record<string, VideoStream> = {};

  if (session.main_url) {
    const original = fixUrlEscaping(session.main_url);
    streams.main = {
      type: "camera",
      name: "Camera",
      url: relayPlaylistUrl(original, loginToken),
      original_url: original,
    };
  }

  if (session.vga_url) {
    const original = fixUrlEscaping(session.vga_url);
    streams.vga = {
      type: "screen",
      name: "Screen",
      url: relayPlaylistUrl(original, loginToken),
      original_url: original,
    };
  }

  return { streams };
}

/** Live streams: target = camera, target_vga = screen; played directly. */
export function getLivePlaybackData(stream: Pick<LiveStream, "target" | "target_vga">): PlaybackData {
  const streams: Record<string, VideoStream> = {};

  if (stream.target) {
    const original = fixUrlEscaping(stream.target);
    streams.camera = {
      type: "camera",
      name: "Camera",
      url: original,
      original_url: original,
    };
  }

  if (stream.target_vga) {
    const original = fixUrlEscaping(stream.target_vga);
    streams.screen = {
      type: "screen",
      name: "Screen",
      url: original,
      original_url: original,
    };
  }

  return { streams };
}
