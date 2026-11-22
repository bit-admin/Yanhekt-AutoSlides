import crypto from 'node:crypto';
import type { DevPlaybackSource } from '@common/devPlayback';
import { YANHE2_ORIGIN } from '@common/yanhe2';
import { isYanhe2LiveUrl, isYanhe2PlayUrl } from '@main/platform/yanhe2/yanhe2Playback';
import { fixUrlEscaping } from './urlHelpers';

type Media = Pick<DevPlaybackSource, 'url' | 'format' | 'live'>;
export type DevPlaybackUrl = Media & (
  { platform: 'yanhe2' } | { platform: 'yanhekt'; route: 'recorded' | 'live' | 'audio' }
);

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * A file stem for a pasted URL, which has no course or lecture to name it:
 * `dev_<platform>_<file>_<url hash>_<local time>`. The time keeps a second
 * download of one URL from replacing the first. No double underscore, so the
 * queue's sanitizer returns it unchanged.
 */
export function devDownloadStem(source: Pick<DevPlaybackUrl, 'platform' | 'url'>, now: Date): string {
  const { pathname } = new URL(source.url);
  const file = (pathname.split('/').pop() ?? '').replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'media';
  const hash = crypto.createHash('md5').update(pathname).digest('hex').slice(0, 8);
  const time = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `dev_${source.platform}_${file}_${hash}_${time}`.replace(/_{2,}/g, '_');
}

export function isDevDownloadStem(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 120 && /^dev_(yanhekt|yanhe2)_[A-Za-z0-9_-]+$/.test(value) && !value.includes('__');
}

/** Accept API media URLs, not lecture pages, API endpoints or arbitrary URLs. */
export function parseDevPlaybackUrl(input: unknown): DevPlaybackUrl | null {
  if (typeof input !== 'string') return null;
  let url: URL;
  try {
    url = new URL(fixUrlEscaping(input.trim()));
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.port || url.username || url.password) return null;
  url.hash = '';

  const path = url.pathname;
  const format = /\.m3u8$/i.test(path) ? 'hls' : /\.mp4$/i.test(path) ? 'mp4' : /\.aac$/i.test(path) ? 'aac' : null;
  if (!format) return null;

  const upstream = url.href;
  if (url.origin === YANHE2_ORIGIN && (isYanhe2PlayUrl(upstream) || isYanhe2LiveUrl(upstream))) {
    // Replace a pasted signature with this account's at request time. Keep live routing params.
    url.searchParams.delete('t');
    return { platform: 'yanhe2', url: url.href, format, live: path.startsWith('/live/') };
  }
  if (url.hostname === 'cvideo.yanhekt.cn' && path.startsWith('/vod/')) {
    if (format === 'aac') return { platform: 'yanhekt', route: 'audio', url: upstream, format, live: false };
    // Yanhekt's signer expects the raw API playlist URL; it appends its own query.
    if (format === 'hls' && !url.search) return { platform: 'yanhekt', route: 'recorded', url: upstream, format, live: false };
  }
  if (/^clive\d+\.yanhekt\.cn$/.test(url.hostname) && path.startsWith('/live/') && format === 'hls') {
    return { platform: 'yanhekt', route: 'live', url: upstream, format, live: true };
  }
  return null;
}
