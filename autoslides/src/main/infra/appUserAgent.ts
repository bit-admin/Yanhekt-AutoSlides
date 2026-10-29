import { app } from 'electron';

const PLATFORM_NAMES: Partial<Record<NodeJS.Platform, string>> = {
  win32: 'Windows',
  darwin: 'macOS',
  linux: 'Linux',
};

/**
 * Canonical `AutoSlides/<version> (<platform>; <arch>)` User-Agent, e.g.
 * `AutoSlides/5.2.0 (Windows; x64)`, for every request the app makes to
 * first-party (ruc.edu.kg) infrastructure — token verification, the built-in AI
 * proxy, and the share Worker (short links and the Index API) — so that backend
 * can identify genuine app traffic. Servers parse the leading
 * `AutoSlides/<version>`; keep it first.
 *
 * Do NOT use this for Yanhekt (`*.yanhekt.cn`) requests: those deliberately send
 * a browser User-Agent to mimic the Yanhekt web client.
 */
export function appPlatform(): string {
  const platform = PLATFORM_NAMES[process.platform] ?? process.platform;
  return `${platform}; ${process.arch}`;
}

export function appUserAgent(): string {
  return `${app.getName()}/${app.getVersion()} (${appPlatform()})`;
}
