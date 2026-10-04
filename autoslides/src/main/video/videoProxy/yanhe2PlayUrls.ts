/**
 * URL shapes for the `/yanhe2` proxy route (see `yanhe2Play.ts`): the local URL
 * the renderer is given, and the playlist rewrite that keeps every segment
 * coming back through it.
 */
import { isYanhe2PlayUrl } from '@main/platform/yanhe2/yanhe2Playback';

export const YANHE2_PLAY_ROUTE = '/yanhe2';

export function yanhe2PlayProxyUrl(port: number, account: string, upstreamUrl: string): string {
  return `http://localhost:${port}${YANHE2_PLAY_ROUTE}?account=${encodeURIComponent(account)}&u=${encodeURIComponent(upstreamUrl)}`;
}

/**
 * Point every media line of a playlist back at this route, so each segment is
 * signed when hls.js asks for it. Signing them all here would age out on a long
 * lecture: a signature is good for about three hours.
 */
export function rewriteYanhe2Playlist(content: string, playlistUrl: string, port: number, account: string): string {
  const proxied = (reference: string): string | null => {
    let absolute: string;
    try {
      absolute = new URL(reference, playlistUrl).toString();
    } catch {
      return null;
    }
    return isYanhe2PlayUrl(absolute) ? yanhe2PlayProxyUrl(port, account, absolute) : null;
  };

  return content
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (!trimmed.startsWith('#')) return proxied(trimmed) ?? line;
      // A tag that names a file (`#EXT-X-MAP:URI="init.mp4"`).
      return line.replace(/URI="([^"]+)"/, (whole, reference: string) => {
        const url = proxied(reference);
        return url ? `URI="${url}"` : whole;
      });
    })
    .join('\n');
}
