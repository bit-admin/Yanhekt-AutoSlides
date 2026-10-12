/**
 * The one way main reads Yanhe 2.0 JSON.
 *
 * On aita a GET is not always a read (`course-collect/down` adds a favorite,
 * `learn-record` writes a watch position), so nothing builds a URL from a
 * caller's path: `YANHE2_READ_PATHS` is the whole list of what may be
 * requested.
 *
 * Bodies carry teacher badges and more than any page needs. Callers parse them
 * into plain rows and never log them.
 */
import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { YANHE2_ORIGIN, YANHE2_TENANT_ID } from '@common/yanhe2';

export const YANHE2_READ_PATHS = {
  dayList: '/courseapi/v3/course-live-role/search-role-course-list',
  weekSchedule: '/courseapi/v2/schedule/get-week-schedules',
  subInfo: '/courseapi/v3/portal-home-setting/get-sub-info',
  // The site calls this under `/personal/courseapi/`, which is the SPA's proxy
  // path: it answers 404 unless the request looks like the page's own XHR
  // (Referer + x-requested-with). The back end itself is reachable here.
  myCourses: '/vlabpassportapi/v1/account-profile/course',
  courseDetail: '/courseapi/v3/multi-search/get-course-detail',
  slides: '/pptnote/v1/schedule/search-ppt',
  transcript: '/courseapi/v3/web-socket/search-trans-result',
} as const;

export type Yanhe2ReadPath = (typeof YANHE2_READ_PATHS)[keyof typeof YANHE2_READ_PATHS];

const TIMEOUT_MS = 20_000;

export type Yanhe2Fetched<T> =
  | { kind: 'ok'; data: T }
  /** 401/403: the token is not accepted. */
  | { kind: 'rejected' }
  | { kind: 'network' }
  /** `detail` says why, for the log: a path and a status, never a body. This module stays free of the logger so its parsers can be unit-tested. */
  | { kind: 'failed'; detail?: string };

/** Sends one request; `config.url` is the public URL. */
export type Yanhe2Send = (config: AxiosRequestConfig & { url: string }) => Promise<AxiosResponse>;

// Straight to the public host until main installs the shared API transport
// (`routeYanhe2Through`). Kept as a plain function so this module, and the
// parsers that import it, load without Electron in unit tests.
let send: Yanhe2Send = (config) => axios.request(config);

/**
 * Send every Yanhe 2.0 JSON request through `sender` from now on. Main passes
 * the shared API transport, which uses the campus intranet when it is
 * reachable. Called once at startup.
 */
export function routeYanhe2Through(sender: Yanhe2Send): void {
  send = sender;
}

/**
 * GET one Yanhe 2.0 JSON URL with the account's bearer. Every JSON request to
 * aita goes through here, so a new endpoint takes the intranet route without
 * doing anything for it. Returns null when no answer came back.
 */
export async function getYanhe2Json(jwt: string, url: string): Promise<{ status: number; data: unknown } | null> {
  try {
    const response = await send({
      method: 'GET',
      url,
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/json',
        'tenant-id': String(YANHE2_TENANT_ID),
      },
      // The bearer must not follow a redirect to another host.
      maxRedirects: 0,
      timeout: TIMEOUT_MS,
      // Statuses are the caller's to judge; the body is parsed only if it is JSON.
      validateStatus: () => true,
    });
    return { status: response.status, data: response.data };
  } catch {
    return null;
  }
}

export async function readYanhe2(
  jwt: string,
  path: Yanhe2ReadPath,
  params: Record<string, string>,
): Promise<Yanhe2Fetched<unknown>> {
  const url = new URL(path, YANHE2_ORIGIN);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await getYanhe2Json(jwt, url.toString());
  if (!response) return { kind: 'network' };
  // A bad or expired token is a bare 403 with an empty body.
  if (response.status === 401 || response.status === 403) return { kind: 'rejected' };
  // Status only: a body can carry names and badges.
  if (response.status < 200 || response.status >= 300) {
    return { kind: 'failed', detail: `${path} answered HTTP ${response.status}` };
  }
  if (!response.data || typeof response.data !== 'object') {
    return { kind: 'failed', detail: `${path} answered without JSON` };
  }
  return { kind: 'ok', data: response.data };
}
