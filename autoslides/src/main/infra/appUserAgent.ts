import { app } from 'electron';

/**
 * Canonical `AutoSlides/<version>` User-Agent for every request the app makes to
 * first-party (ruc.edu.kg) infrastructure — token verification, the built-in AI
 * proxy, and the AutoSlides Index share Worker — so that backend can identify
 * genuine app traffic.
 *
 * Do NOT use this for Yanhekt (`*.yanhekt.cn`) requests: those deliberately send
 * a browser User-Agent to mimic the Yanhekt web client.
 */
export function appUserAgent(): string {
  return `${app.getName()}/${app.getVersion()}`;
}
