import { overrides } from '../overrideRegistry'
import { cached, invalidate } from './requestCache'
import { parseUserProgress, progressBucket, resumePositionFor, type SessionWatchProgress } from '@common/watchProgress';
import { createLogger } from '@shared/utils/logger';
const log = createLogger('ServicesApiClient');

import type { TokenVerificationResult, LiveListResponse, CourseListResponse, SubscriptionListResponse, CourseInfoResponse, SemesterOption } from '@common/apiTypes';
export type { UserData, TokenVerificationResult, LiveStream, LiveListResponse, CourseData, CourseListResponse, SubscriptionCourseRow, SubscriptionListResponse, SessionData, CourseInfoResponse, SemesterOption } from '@common/apiTypes';
export type { SessionWatchProgress };

// The data source ApiClient delegates to. Default = the real preload bridge;
// a registered `overrides.apiTransport` (demo mode) returns fabricated data of
// the same shape. ApiClient keeps the error handling around these calls.
export interface ApiTransport {
  verifyToken(token: string): Promise<TokenVerificationResult>;
  getPersonalLiveList(token: string, page?: number, pageSize?: number): Promise<LiveListResponse>;
  searchLiveList(token: string, keyword: string, page?: number, pageSize?: number): Promise<LiveListResponse>;
  getCourseList(token: string, options?: { semesters?: number[]; page?: number; pageSize?: number; keyword?: string }): Promise<CourseListResponse>;
  getPersonalCourseList(token: string, options?: { page?: number; pageSize?: number }): Promise<CourseListResponse>;
  getSubscriptionList(token: string, options?: { page?: number; pageSize?: number }): Promise<SubscriptionListResponse>;
  subscribeCourse(token: string, courseId: string): Promise<void>;
  unsubscribeCourse(token: string, courseId: string): Promise<void>;
  getCourseInfo(courseId: string, token: string): Promise<CourseInfoResponse>;
  getVideoAssets(videoId: string, token: string): Promise<{ audioUrl?: string }>;
  getSessionProgress(sessionId: string, token: string): Promise<unknown>;
  reportSessionProgress(sessionId: string, seconds: number, token: string): Promise<void>;
  getAvailableSemesters(): Promise<SemesterOption[]>;
}

const realApiTransport: ApiTransport = {
  verifyToken: (token) => window.electronAPI.auth.verifyToken(token),
  getPersonalLiveList: (token, page = 1, pageSize = 16) => window.electronAPI.api.getPersonalLiveList(token, page, pageSize),
  searchLiveList: (token, keyword, page = 1, pageSize = 16) => window.electronAPI.api.searchLiveList(token, keyword, page, pageSize),
  getCourseList: (token, options = {}) => window.electronAPI.api.getCourseList(token, options),
  getPersonalCourseList: (token, options = {}) => window.electronAPI.api.getPersonalCourseList(token, options),
  getSubscriptionList: (token, options = {}) => window.electronAPI.api.getSubscriptionList(token, options),
  subscribeCourse: (token, courseId) => window.electronAPI.api.subscribeCourse(token, courseId),
  unsubscribeCourse: (token, courseId) => window.electronAPI.api.unsubscribeCourse(token, courseId),
  getCourseInfo: (courseId, token) => window.electronAPI.api.getCourseInfo(courseId, token),
  getAvailableSemesters: () => window.electronAPI.api.getAvailableSemesters(),
  getVideoAssets: (videoId, token) => window.electronAPI.api.getVideoAssets(videoId, token),
  getSessionProgress: (sessionId, token) => window.electronAPI.api.getSessionProgress(sessionId, token),
  reportSessionProgress: (sessionId, seconds, token) =>
    window.electronAPI.api.reportSessionProgress(sessionId, seconds, token),
};

/**
 * How long a resolved read may be reused, per transport method.
 *
 * Mirrors the web client's per-endpoint table (`web/frontend/src/lib/api.ts`).
 * Reads not listed here still **coalesce** — a second identical call while one
 * is in flight joins it — they are simply never memoized.
 *
 * Auth- and playhead-sensitive methods are excluded outright — see
 * UNCACHED_METHODS below.
 */
const READ_TTL_MS: Partial<Record<keyof ApiTransport, number>> = {
  getAvailableSemesters: 60 * 60 * 1000,
  getCourseInfo: 5 * 60 * 1000,
  getCourseList: 60 * 1000,
  getPersonalCourseList: 60 * 1000,
  getSubscriptionList: 60 * 1000,
  getPersonalLiveList: 30 * 1000,
  searchLiveList: 30 * 1000,
  getVideoAssets: 5 * 60 * 1000,
};

/**
 * Writes that make cached reads wrong — a subscribe changes the subscription
 * list and the course lists that mirror it, so it drops every cached read.
 *
 * `reportSessionProgress` is deliberately **not** here. It is a write, but it
 * writes this account's playhead and invalidates no list — and it is the
 * wall-clock 5-second watch heartbeat, so invalidating on it would empty the
 * cache every five seconds for the whole of a lecture.
 */
const WRITE_METHODS: ReadonlySet<keyof ApiTransport> = new Set([
  'subscribeCourse',
  'unsubscribeCourse',
]);

/**
 * Methods that pass straight through — never cached, coalesced or invalidating.
 *
 * `verifyToken` is the account-switch gate and must always reach the server.
 * `reportSessionProgress` is the 5s heartbeat (see above); coalescing it would
 * also be wrong, since two reports a second apart carry different seconds.
 * `getSessionProgress` is the account's live watch position — a memo there
 * would resurrect a stale playhead when a lecture is reopened.
 */
const UNCACHED_METHODS: ReadonlySet<keyof ApiTransport> = new Set([
  'verifyToken',
  'reportSessionProgress',
  'getSessionProgress',
]);

/**
 * Wrap a transport so identical concurrent reads share one round-trip, and
 * listed reads are briefly memoized.
 *
 * The desktop app has no request quota to protect, but it does have several
 * mounted playback tabs and a parallel task queue that ask the same questions at
 * once, plus grids that refetch on every visit to their sidebar tab.
 *
 * Only the **real** transport is wrapped — a demo override is left exactly as
 * it is, so `renderer/demo/` stays a deletable add-on.
 *
 * Keys include the caller's token: the app is multi-account, and switching
 * accounts must never serve the previous account's personal lists. That alone
 * is not the safety boundary — `tokenManager` clears the whole cache on any
 * identity change — but it keeps two accounts' entries apart in the meantime.
 */
function withRequestCache(transport: ApiTransport): ApiTransport {
  const wrapped = {} as Record<string, unknown>;
  for (const name of Object.keys(transport) as (keyof ApiTransport)[]) {
    const fn = transport[name] as (...args: unknown[]) => Promise<unknown>;
    if (UNCACHED_METHODS.has(name)) {
      wrapped[name] = fn;
      continue;
    }
    if (WRITE_METHODS.has(name)) {
      wrapped[name] = async (...args: unknown[]) => {
        try {
          return await fn(...args);
        } finally {
          // A subscribe changes the subscription list and the course lists that
          // mirror it, so a write drops every cached read.
          invalidate('');
        }
      };
      continue;
    }
    const ttl = READ_TTL_MS[name] ?? 0;
    wrapped[name] = (...args: unknown[]) =>
      cached(`${name}|${JSON.stringify(args)}`, ttl, () => fn(...args));
  }
  return wrapped as unknown as ApiTransport;
}

const cachedRealTransport = withRequestCache(realApiTransport);

/**
 * Memo for mic-audio lookups, keyed by video id.
 *
 * A mic URL costs a whole extra request (GET /v1/video is the only hop that
 * carries it), and three separate surfaces ask for the same one: the session
 * page's per-row download, "Download All Audio", and opening playback. The
 * answer is immutable for a finished recording, so it is cached for the life
 * of the renderer — including the negative answer, which is the common case.
 */
const audioUrlCache = new Map<string, string | undefined>();

export class ApiClient {
  // Resolved lazily per call so an override registered after construction (and
  // after this module is first imported) is still honored.
  private get transport(): ApiTransport {
    return overrides.apiTransport ?? cachedRealTransport;
  }

  async verifyToken(token: string): Promise<TokenVerificationResult> {
    try {
      return await this.transport.verifyToken(token);
    } catch (error) {
      log.error('Token verification error:', error);
      return { valid: false, userData: null, networkError: false };
    }
  }

  async getPersonalLiveList(token: string, page = 1, pageSize = 16): Promise<LiveListResponse> {
    try {
      return await this.transport.getPersonalLiveList(token, page, pageSize);
    } catch (error) {
      log.error('Failed to get personal live list:', error);
      throw error;
    }
  }

  async searchLiveList(token: string, keyword: string, page = 1, pageSize = 16): Promise<LiveListResponse> {
    try {
      return await this.transport.searchLiveList(token, keyword, page, pageSize);
    } catch (error) {
      log.error('Failed to search live list:', error);
      throw error;
    }
  }

  // Record mode API functions
  async getCourseList(token: string, options: {
    semesters?: number[];
    page?: number;
    pageSize?: number;
    keyword?: string;
  } = {}): Promise<CourseListResponse> {
    try {
      return await this.transport.getCourseList(token, options);
    } catch (error) {
      log.error('Failed to get course list:', error);
      throw error;
    }
  }

  async getPersonalCourseList(token: string, options: {
    page?: number;
    pageSize?: number;
  } = {}): Promise<CourseListResponse> {
    try {
      return await this.transport.getPersonalCourseList(token, options);
    } catch (error) {
      log.error('Failed to get personal course list:', error);
      throw error;
    }
  }

  async getSubscriptionList(token: string, options: {
    page?: number;
    pageSize?: number;
  } = {}): Promise<SubscriptionListResponse> {
    try {
      return await this.transport.getSubscriptionList(token, options);
    } catch (error) {
      log.error('Failed to get subscription list:', error);
      throw error;
    }
  }

  async subscribeCourse(token: string, courseId: string): Promise<void> {
    try {
      await this.transport.subscribeCourse(token, courseId);
    } catch (error) {
      log.error('Failed to subscribe course:', error);
      throw error;
    }
  }

  async unsubscribeCourse(token: string, courseId: string): Promise<void> {
    try {
      await this.transport.unsubscribeCourse(token, courseId);
    } catch (error) {
      log.error('Failed to unsubscribe course:', error);
      throw error;
    }
  }

  async getCourseInfo(courseId: string, token: string): Promise<CourseInfoResponse> {
    try {
      return await this.transport.getCourseInfo(courseId, token);
    } catch (error) {
      log.error('Failed to get course info:', error);
      throw error;
    }
  }

  /**
   * Mic-audio URL for a video id, or undefined when the lecture has none.
   *
   * Never throws: a missing mic track is ordinary, and every caller treats a
   * failure the same way as an absent one. A network failure is deliberately
   * NOT cached, so a retry can still succeed.
   */
  async getMicAudioUrl(videoId: string, token: string): Promise<string | undefined> {
    if (!videoId) return undefined;
    if (audioUrlCache.has(videoId)) return audioUrlCache.get(videoId);

    try {
      const { audioUrl } = await this.transport.getVideoAssets(videoId, token);
      audioUrlCache.set(videoId, audioUrl);
      return audioUrl;
    } catch (error) {
      log.error('Failed to get mic audio URL:', error);
      return undefined;
    }
  }

  /**
   * This account's saved watch position for a recorded session, as the second to
   * seek to — or null for "start at the beginning".
   *
   * Never throws: an unwatched session, a logged-out account and a network
   * failure are all the same answer to the only caller that asks.
   */
  async getResumePosition(sessionId: string, token: string): Promise<number | null> {
    try {
      const raw = await this.transport.getSessionProgress(sessionId, token);
      return resumePositionFor(parseUserProgress(raw));
    } catch (error) {
      log.warn('Failed to read server watch progress:', error);
      return null;
    }
  }

  /**
   * Report the playhead, floored onto the official player's 5-second grid.
   * Never throws — a dropped heartbeat costs nothing and the next one is 5s away.
   */
  async reportWatchProgress(sessionId: string, seconds: number, token: string): Promise<void> {
    try {
      await this.transport.reportSessionProgress(sessionId, progressBucket(seconds), token);
    } catch (error) {
      log.warn('Failed to report watch progress:', error);
    }
  }

  async getAvailableSemesters(): Promise<SemesterOption[]> {
    try {
      return await this.transport.getAvailableSemesters();
    } catch (error) {
      log.error('Failed to get available semesters:', error);
      throw error;
    }
  }
}