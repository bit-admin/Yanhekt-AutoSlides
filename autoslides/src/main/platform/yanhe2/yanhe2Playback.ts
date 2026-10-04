/**
 * Yanhe 2.0 playback: what one session has to play (`get-sub-info`), and the
 * `/play/` URL signature.
 *
 * `get-sub-info` is the only call made for a player. `learn-record` is shaped
 * like a read but writes the account's watch position, and is not on the list.
 */
import { createHash } from 'crypto';
import { YANHE2_ORIGIN } from '@common/yanhe2';
import type { Yanhe2SessionStatus } from '@common/yanhe2Calendar';
import type { Yanhe2StreamType } from '@common/yanhe2Playback';
import { YANHE2_READ_PATHS, readYanhe2, type Yanhe2Fetched } from './yanhe2Http';

/** One stream as upstream names it. `url` is the real media URL and stays in main. */
export interface Yanhe2Source {
  type: Yanhe2StreamType;
  format: 'hls' | 'mp4';
  url: string;
}

export interface Yanhe2SubInfo {
  status: Yanhe2SessionStatus;
  title: string;
  subTitle: string;
  teacher: string;
  room: string;
  startAt: number;
  endAt: number;
  duration: number;
  sources: Yanhe2Source[];
}

type Row = Record<string, unknown>;

const isRow = (value: unknown): value is Row => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
const seconds = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

const STATUS: Record<string, Yanhe2SessionStatus> = {
  '1': 'live',
  '2': 'upcoming',
  '3': 'processing',
  '5': 'ended',
  '6': 'playable',
};

/** `video_list[].type`: 3 teacher camera, 2 screen, 4 the student-facing room camera. */
const RECORDED_TYPE: Record<string, Yanhe2StreamType> = { '3': 'camera', '2': 'screen', '4': 'room' };

/** `live_url` keys. `output_tts` is a second teacher feed and is not offered. */
const LIVE_KEY: [string, Yanhe2StreamType][] = [
  ['output', 'camera'],
  ['output_ppt', 'screen'],
  ['output_student', 'room'],
];

const ORDER: Yanhe2StreamType[] = ['camera', 'screen', 'room'];

/** A recording URL the local proxy may sign: aita's own `/play/` tree, playlist, segment or MP4. */
export function isYanhe2PlayUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.origin === YANHE2_ORIGIN
    && url.pathname.startsWith('/play/')
    && !url.pathname.includes('..')
    && /\.(m3u8|ts|mp4)$/i.test(url.pathname)
  );
}

/** A live playlist on the Yanhekt live CDN (`clive*.yanhekt.cn`). Unsigned. */
function isLivePlaylistUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.endsWith('.yanhekt.cn') && /\.m3u8$/i.test(url.pathname);
  } catch {
    return false;
  }
}

function recordedSources(videoList: unknown): Yanhe2Source[] {
  // An object keyed "0", "1", "2" whose order changes between lectures: pick by `type`, never by key.
  const items = isRow(videoList) ? Object.values(videoList) : Array.isArray(videoList) ? videoList : [];
  const found = new Map<Yanhe2StreamType, Yanhe2Source>();
  for (const item of items) {
    if (!isRow(item)) continue;
    const type = RECORDED_TYPE[text(item.type)];
    const url = text(item.preview_url);
    if (!type || found.has(type) || !isYanhe2PlayUrl(url)) continue;
    const format = /\.m3u8$/i.test(new URL(url).pathname) ? 'hls' : /\.mp4$/i.test(new URL(url).pathname) ? 'mp4' : null;
    if (format) found.set(type, { type, format, url });
  }
  return ORDER.flatMap((type) => found.get(type) ?? []);
}

function liveSources(liveUrl: unknown): Yanhe2Source[] {
  if (!isRow(liveUrl)) return [];
  const out: Yanhe2Source[] = [];
  for (const [key, type] of LIVE_KEY) {
    const entry = liveUrl[key];
    const url = isRow(entry) ? text(entry.m3u8) : '';
    if (isLivePlaylistUrl(url)) out.push({ type, format: 'hls', url });
  }
  return out;
}

/** `{code:0, data}`. Recorded streams are in `video_list`, live ones in `live_url`. */
export function parseSubInfo(body: unknown): Yanhe2SubInfo | null {
  if (!isRow(body) || body.code !== 0 || !isRow(body.data)) return null;
  const data = body.data;
  const status = STATUS[text(data.sub_status)] ?? 'unknown';
  const sources = status === 'live'
    ? liveSources(data.live_url)
    : status === 'playable'
      ? recordedSources(data.video_list)
      : [];
  return {
    status,
    title: text(data.course_title),
    subTitle: text(data.sub_title),
    teacher: text(data.lecturer_name),
    room: text(data.room_name),
    // The row's own start/end is the timetable. `content.start_at` is a dead clock.
    startAt: seconds(data.start_at),
    endAt: seconds(data.end_at),
    duration: status === 'playable' ? seconds(data.duration) : 0,
    sources,
  };
}

export async function fetchYanhe2SubInfo(
  jwt: string,
  query: { courseId: string; subId: string },
): Promise<Yanhe2Fetched<Yanhe2SubInfo>> {
  const fetched = await readYanhe2(jwt, YANHE2_READ_PATHS.subInfo, {
    course_id: query.courseId,
    sub_id: query.subId,
  });
  if (fetched.kind !== 'ok') return fetched;
  const data = parseSubInfo(fetched.data);
  return data ? { kind: 'ok', data } : { kind: 'failed' };
}

export interface Yanhe2PlayIdentity {
  userId: number;
  tenantId: number;
  /** infosimple `phone`. The signing secret; never logged. */
  playSigningPhone: string;
}

/**
 * The `t` a `/play/` playlist, segment or MP4 needs:
 * `{userId}-{unix}-{md5(pathname + userId + tenantId + reverse(phone) + unix)}`.
 *
 * Bound to one pathname and one second, and accepted from about three hours
 * back to ten seconds ahead of the server's clock — so it is made per request,
 * never ahead of time for a whole playlist.
 */
export function signYanhe2PlayPath(pathname: string, identity: Yanhe2PlayIdentity, unixSeconds: number): string {
  const reversed = identity.playSigningPhone.split('').reverse().join('');
  const digest = createHash('md5')
    .update(`${pathname}${identity.userId}${identity.tenantId}${reversed}${unixSeconds}`)
    .digest('hex');
  return `${identity.userId}-${unixSeconds}-${digest}`;
}

/** `url` with a fresh `t`. The hash covers the pathname only, so an existing query is left as it is. */
export function signYanhe2PlayUrl(url: string, identity: Yanhe2PlayIdentity, nowMs: number): string {
  const parsed = new URL(url);
  parsed.searchParams.delete('t');
  parsed.searchParams.set('t', signYanhe2PlayPath(parsed.pathname, identity, Math.floor(nowMs / 1000)));
  return parsed.toString();
}
