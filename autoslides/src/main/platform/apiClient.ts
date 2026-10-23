import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { app } from 'electron';
import { getClientSignature } from '@common/crypto';
import { createLogger } from '@main/infra/logger';
import { appUserAgent } from '@main/infra/appUserAgent';
import { IntranetApiTransport } from '@main/platform/intranetApiTransport';
import { indexSessionIds } from '@main/platform/indexClient';
import { cbizEnvelopeError, isCbizOk } from '@main/platform/cbizEnvelope';
import type { ConfigService } from '@main/platform/configService';
import type { YanhektCatalogSink } from '@main/platform/yanhektCatalog';
const log = createLogger('PlatformApiClient');

/** Parallel session reads when the list comes from the Index. */
const INDEX_SESSION_CONCURRENCY = 6;

import type { UserData, TokenVerificationResult, LiveListResponse, CourseListResponse, SubscriptionListResponse, SessionData, CourseInfoResponse, SemesterOption, SessionDownloadInfo, CourseDetailResponse } from '@common/apiTypes';
export type { UserData, TokenVerificationResult, LiveStream, LiveListResponse, CourseData, CourseListResponse, SubscriptionCourseRow, SubscriptionListResponse, SessionData, CourseInfoResponse, SemesterOption } from '@common/apiTypes';

/** A row of the Yanhekt tag tree; `/v1/tag/semester/default` returns one. */
interface SemesterTag {
  id: number;
  parent_id: number;
  name: string;
  param: string;
  sort: number;
}

interface DefaultSemesterResponse {
  code: number | string;
  message: string;
  data: SemesterTag | null;
}

// Base API response interface
interface BaseApiResponse {
  code: number | string;
  message: string;
}

// API response interfaces for different endpoints
interface LiveListApiResponse extends BaseApiResponse {
  data: LiveListResponse;
}

interface CourseListApiResponse extends BaseApiResponse {
  data: CourseListResponse;
}

interface CourseInfoApiResponse extends BaseApiResponse {
  data: {
    name_zh: string;
    // English course name. Yanhekt ships it on /v1/course alongside name_zh, but
    // it is frequently absent — callers must fall back to name_zh.
    name_en?: string;
    professors: Array<{ name: string }>;
    // Present on the /v1/course single-course response (confirmed against the
    // live API). Note: `classrooms` is NOT returned here — only on the course
    // list response. Recover list-only fields via keyword=id on /v2/course/list
    // (renderer `lookupCourseById`), not from this endpoint.
    school_year?: string;
    semester?: number | string;
    college_name?: string;
    college?: { name?: string; image_url?: string };
    image_url?: string;
  };
}

interface SessionListApiResponse extends BaseApiResponse {
  data: Array<{
    id: string;
    title: string;
    week_number: number;
    day: number;
    started_at: string;
    ended_at: string;
    videos: Array<{
      id: string;
      duration: string;
      main: string;
      vga: string;
    }>;
  }>;
}

// GET /v1/video?id= — the ONLY cbiz hop that returns the classroom SubAudio
// sidecar. `main`/`vga` duplicate what the session list gives a signed-in
// course page, but are the only VOD source for download-by-session-id.
// `audio_origin` has been identical to `audio` in every sample, so only
// `audio` is modelled.
interface VideoDetailApiResponse extends BaseApiResponse {
  data: {
    id: number | string;
    main?: string;
    vga?: string;
    duration?: string | number;
    audio?: string;
  };
}

// GET /v1/course/session?session_id=&with_video=true — session detail by id.
// Only the fields download-by-session-id reads are modelled.
interface SessionDetailApiResponse extends BaseApiResponse {
  data: {
    id: number | string;
    course_id: number | string;
    title: string;
    week_number: number;
    day: number | string;
    started_at: string;
    ended_at: string;
    video_ids?: Array<number | string>;
    course?: {
      id: number | string;
      name_zh?: string;
      name_en?: string;
      college_name?: string;
      school_year?: string;
      semester?: number | string;
    };
  };
}

interface VideoTokenApiResponse extends BaseApiResponse {
  data: {
    token: string;
  };
}

/**
 * A lookup that Yanhekt answered: the id does not exist, or the session has no
 * recording yet. Anything else (network, auth, upstream down) stays a plain
 * Error. The message is the same one the app always showed.
 */
export class YanhektLookupError extends Error {
  constructor(message: string, readonly kind: 'not_found' | 'no_recording') {
    super(message);
    this.name = 'YanhektLookupError';
  }
}

export class ApiClient {
  private readonly BASE_HEADERS = {
    "Origin": "https://www.yanhekt.cn",
    "Referer": "https://www.yanhekt.cn/",
    "xdomain-client": "web_user",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.3",
    "Xdomain-Client": "web_user",
    "Xclient-Version": "v1"
  };

  private cbiz: IntranetApiTransport;
  /** Developer-mode catalog. Null unless the desktop app turned it on. */
  private catalogSink: YanhektCatalogSink | null = null;

  constructor(private configService?: ConfigService, cbiz: IntranetApiTransport = new IntranetApiTransport()) {
    this.cbiz = cbiz;
  }

  /** Record raw cbiz responses. A throw here must never fail the request. */
  setCatalogSink(sink: YanhektCatalogSink | null): void {
    this.catalogSink = sink;
  }

  /** Send one cbiz request along the current route (see IntranetApiTransport). */
  private send(config: AxiosRequestConfig & { url: string }): Promise<AxiosResponse> {
    return this.cbiz.send(config);
  }

  /**
   * Omit Authorization when the caller marked the endpoint anonymous-safe
   * AND Settings → Network "If possible, send anonymous requests" is on.
   */
  private shouldOmitAuth(allowAnonymous: boolean): boolean {
    return allowAnonymous && !!this.configService?.getPreferAnonymousApiRequests();
  }

  private createHeaders(token: string, allowAnonymous = false): { headers: Record<string, string>; timestamp: string } {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const headers: Record<string, string> = { ...this.BASE_HEADERS };

    headers["Xclient-Signature"] = getClientSignature();
    headers["Xclient-Timestamp"] = timestamp;
    if (!this.shouldOmitAuth(allowAnonymous) && token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return { headers, timestamp };
  }

  async verifyToken(token: string): Promise<TokenVerificationResult> {
    try {
      const url = "https://cbiz.yanhekt.cn/v1/user";
      const { headers } = this.createHeaders(token);


      const response: AxiosResponse = await this.send({
        method: 'GET',
        url,
        headers,
        timeout: 10000,
        validateStatus: function (status) {
          return status < 500;
        }
      });

      const data = response.data;

      const isValid = data.code === 0 || data.code === "0";

      if (isValid) {
        const userData: UserData = {
          badge: data.data?.badge || "",
          nickname: data.data?.nickname || "",
          gender: data.data?.gender || 3,
          phone: data.data?.phone || ""
        };

        // Send token to server for AI service verification (fire-and-forget, production only)
        if (app.isPackaged) {
          axios.post('https://learn.ruc.edu.kg/api/verify-token', { token }, {
            headers: { 'User-Agent': appUserAgent() }
          }).catch(() => { /* fire-and-forget, ignore errors */ });
        }

        return { valid: true, userData };
      } else {
        return { valid: false, userData: null };
      }
    } catch (error: unknown) {
      log.error('Token verification error:', error);

      const errorObj = error as { code?: string; message?: string };
      if (errorObj.code === 'ENOTFOUND' || errorObj.code === 'ECONNREFUSED' ||
        errorObj.code === 'ETIMEDOUT' || errorObj.message?.includes('timeout')) {
        return { valid: false, userData: null, networkError: true };
      }

      return { valid: false, userData: null, networkError: false };
    }
  }

  /**
   * Best-effort server-side session revoke. Callers fire-and-forget this so
   * local sign-out never waits on the network; failures are logged only.
   */
  async revokeToken(token: string): Promise<void> {
    if (!token) return;
    try {
      const url = "https://cbiz.yanhekt.cn/v1/cas/logout";
      const { headers } = this.createHeaders(token);
      await this.send({
        method: 'GET',
        url,
        headers,
        timeout: 10000,
        validateStatus: function (status) {
          return status < 500;
        }
      });
    } catch (error: unknown) {
      log.error('Token revoke error:', error);
    }
  }

  private async makeRequest(
    method: string,
    url: string,
    token: string,
    data?: Record<string, unknown>,
    opts?: { allowAnonymous?: boolean }
  ): Promise<unknown> {
    const { headers } = this.createHeaders(token, opts?.allowAnonymous === true);

    const config: {
      method: string;
      url: string;
      headers: Record<string, string>;
      timeout: number;
      validateStatus: (status: number) => boolean;
      data?: Record<string, unknown>;
    } = {
      method,
      url,
      headers,
      timeout: 10000,
      validateStatus: function (status: number) {
        return status < 500;
      }
    };

    if (data) {
      // Required for DELETE-with-body (and explicit for POST) so Yanhekt parses
      // JSON the same way the browser client does.
      headers['Content-Type'] = 'application/json';
      config.data = data;
    }

    const response: AxiosResponse = await this.send(config);
    if (method === 'GET') this.noteCatalog(url, response.data);
    return response.data;
  }

  private noteCatalog(url: string, body: unknown): void {
    if (!this.catalogSink) return;
    try {
      this.catalogSink.observe(url, body);
    } catch (error: unknown) {
      log.warn('Yanhekt catalog update failed:', error);
    }
  }

  async getLiveList(token: string, page = 1, pageSize = 16, userRelationshipType = 0): Promise<LiveListResponse> {
    try {
      const url = `https://cbiz.yanhekt.cn/v2/live/list?page=${page}&page_size=${pageSize}&user_relationship_type=${userRelationshipType}`;
      // type=0 is the public catalog; type=1 is the user's enrolled lives.
      const response = await this.makeRequest('GET', url, token, undefined, {
        allowAnonymous: userRelationshipType !== 1
      });
      const data = response as LiveListApiResponse;

      if (!isCbizOk(data)) throw cbizEnvelopeError(data);

      return data.data;
    } catch (error: unknown) {
      log.error('Failed to get live list:', error);
      throw error;
    }
  }

  async getPersonalLiveList(token: string, page = 1, pageSize = 16): Promise<LiveListResponse> {
    return this.getLiveList(token, page, pageSize, 1);
  }

  async searchLiveList(token: string, keyword: string, page = 1, pageSize = 16): Promise<LiveListResponse> {
    try {
      const encodedKeyword = encodeURIComponent(keyword);
      const url = `https://cbiz.yanhekt.cn/v2/live/list?page=${page}&page_size=${pageSize}&keyword=${encodedKeyword}`;
      const response = await this.makeRequest('GET', url, token, undefined, { allowAnonymous: true });
      const data = response as LiveListApiResponse;

      if (!isCbizOk(data)) throw cbizEnvelopeError(data);

      return data.data;
    } catch (error: unknown) {
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
      const {
        semesters = [],
        page = 1,
        pageSize = 16,
        keyword = ''
      } = options;

      const params = new URLSearchParams();

      semesters.forEach(semesterId => {
        params.append('semesters[]', semesterId.toString());
      });

      params.append('page', page.toString());
      params.append('page_size', pageSize.toString());

      if (keyword && keyword.trim()) {
        params.append('keyword', keyword.trim());
      }

      const url = `https://cbiz.yanhekt.cn/v2/course/list?${params.toString()}`;
      const response = await this.makeRequest('GET', url, token, undefined, { allowAnonymous: true });
      const data = response as CourseListApiResponse;

      if (!isCbizOk(data)) throw cbizEnvelopeError(data);

      return data.data;
    } catch (error: unknown) {
      log.error('Failed to get course list:', error);
      throw error;
    }
  }

  async getPersonalCourseList(token: string, options: {
    page?: number;
    pageSize?: number;
  } = {}): Promise<CourseListResponse> {
    try {
      const {
        page = 1,
        pageSize = 16
      } = options;

      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('page_size', pageSize.toString());
      params.append('user_relationship_type', '1');
      params.append('with_introduction', 'true');

      const url = `https://cbiz.yanhekt.cn/v2/course/private/list?${params.toString()}`;
      const response = await this.makeRequest('GET', url, token);
      const data = response as CourseListApiResponse;

      if (!isCbizOk(data)) throw cbizEnvelopeError(data);

      return data.data;
    } catch (error: unknown) {
      log.error('Failed to get personal course list:', error);
      throw error;
    }
  }

  /**
   * One page of the account's Yanhekt course subscriptions. Default upstream
   * page_size is 4 when omitted — always pass an explicit pageSize (100 is
   * enough for typical accounts; callers should paginate on last_page).
   */
  async getSubscriptionList(token: string, options: {
    page?: number;
    pageSize?: number;
  } = {}): Promise<SubscriptionListResponse> {
    try {
      const { page = 1, pageSize = 100 } = options;
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('page_size', pageSize.toString());

      const url = `https://cbiz.yanhekt.cn/v1/course/subscription/list?${params.toString()}`;
      const response = await this.makeRequest('GET', url, token) as BaseApiResponse & {
        data: SubscriptionListResponse;
      };

      if (!isCbizOk(response)) throw cbizEnvelopeError(response);

      return response.data;
    } catch (error: unknown) {
      log.error('Failed to get subscription list:', error);
      throw error;
    }
  }

  async subscribeCourse(token: string, courseId: string): Promise<void> {
    try {
      const url = 'https://cbiz.yanhekt.cn/v1/course/subscription';
      const response = await this.makeRequest('POST', url, token, {
        course_id: String(courseId),
      }) as BaseApiResponse;

      if (!isCbizOk(response)) throw cbizEnvelopeError(response);
    } catch (error: unknown) {
      log.error('Failed to subscribe course:', error);
      throw error;
    }
  }

  async unsubscribeCourse(token: string, courseId: string): Promise<void> {
    try {
      const url = 'https://cbiz.yanhekt.cn/v1/course/subscription';
      const response = await this.makeRequest('DELETE', url, token, {
        course_id: String(courseId),
      }) as BaseApiResponse;

      if (!isCbizOk(response)) throw cbizEnvelopeError(response);
    } catch (error: unknown) {
      log.error('Failed to unsubscribe course:', error);
      throw error;
    }
  }

  /**
   * Course names only, from the single `/v1/course?id=` hop.
   *
   * Deliberately not {@link getCourseInfo}: that also pages the session list and
   * **throws** when a course has none, which is exactly the case for a course
   * that has only ever been broadcast live. Live rows carry no `name_en` of
   * their own, so this is how a live card gets an English title.
   *
   * Anonymous-ok, like getCourseInfo's first hop. Returns null rather than
   * throwing — a missing English title is never worth failing a render over.
   */
  async getCourseNames(
    courseId: string,
    token: string,
  ): Promise<{ nameZh: string; nameEn?: string } | null> {
    try {
      const url = `https://cbiz.yanhekt.cn/v1/course?id=${encodeURIComponent(courseId)}`;
      const response = await this.makeRequest('GET', url, token, undefined, { allowAnonymous: true });
      const payload = response as CourseInfoApiResponse;
      if (payload.code !== 0 && payload.code !== '0') return null;
      const nameZh = payload.data?.name_zh?.trim() ?? '';
      const nameEn = payload.data?.name_en?.trim() || undefined;
      return nameZh || nameEn ? { nameZh, nameEn } : null;
    } catch (error: unknown) {
      log.warn('Failed to read course names:', error);
      return null;
    }
  }

  /** One raw session-list hop (`/v2` or its `/v1` twin). Throws on a non-zero `code`. */
  private async fetchSessionRows(
    version: 'v1' | 'v2',
    courseId: string,
    token: string,
  ): Promise<SessionListApiResponse['data']> {
    const url = `https://cbiz.yanhekt.cn/${version}/course/session/list?course_id=${courseId}`;
    const response = (await this.makeRequest('GET', url, token)) as SessionListApiResponse;
    if (response.code !== 0 && response.code !== "0") {
      throw new Error(`Failed to get course sessions: ${response.message}`);
    }
    return response.data ?? [];
  }

  /**
   * One course's sessions, oldest first as the server lists them. Needs the
   * login token: an anonymous request answers `code: 0` with an empty list, so
   * an empty result is either "no sessions" or "not signed in".
   *
   * `/v2` first; when it is empty, the `/v1` twin (same bare-array shape). Since
   * 2026-10-22 `/v2` answers `[]` even signed in (docs/architecture.md §9.5.1).
   * Last, the Index's session ids, each read by id ({@link sessionsFromIndex}):
   * both lists are empty for a course this account may not list, but its
   * sessions still play by id.
   */
  async getCourseSessions(courseId: string, token: string): Promise<SessionData[]> {
    // Session *detail by id* is a different endpoint — see getSessionById.
    let rows = await this.fetchSessionRows('v2', courseId, token);
    if (rows.length === 0) rows = await this.fetchSessionRows('v1', courseId, token);
    if (rows.length === 0) return this.sessionsFromIndex(String(courseId), token);

    return rows.map((video) => {
      const realVideoId = video.videos && video.videos.length > 0 ? video.videos[0].id : '';
      const videoData = video.videos && video.videos.length > 0 ? video.videos[0] : null;
      const mainUrl = videoData ? videoData.main : '';
      const vgaUrl = videoData ? videoData.vga : '';

      return {
        session_id: video.id,
        video_id: realVideoId,
        title: video.title,
        duration: videoData ? parseInt(videoData.duration) : 0,
        week_number: video.week_number,
        day: video.day,
        started_at: video.started_at,
        ended_at: video.ended_at,
        main_url: mainUrl,
        vga_url: vgaUrl,
        id: realVideoId
      };
    });
  }

  /**
   * A course's sessions from the Index's session ids. Each id costs two
   * anonymous-ok Yanhekt hops, the same pair {@link getSessionDownloadInfo}
   * uses: session detail by id, then `/v1/video` for the stream URLs (the
   * detail has none, and desktop playback reads them off the row). Only
   * sessions with a stream are kept, as the Yanhekt lists give: the Index also
   * holds future and unrecorded sessions, and the next step on a session page
   * is to play one. A session that fails to read, or belongs to another
   * course, is dropped too. An
   * Index failure (offline, an error page, course not indexed) gives `[]`:
   * the lists already answered empty, so that is still a truthful answer.
   */
  private async sessionsFromIndex(courseId: string, token: string): Promise<SessionData[]> {
    let ids: string[];
    try {
      ids = await indexSessionIds(courseId);
    } catch (error: unknown) {
      log.warn('Index session list unavailable for course', courseId, error);
      return [];
    }
    const rows: Array<SessionData | null> = new Array(ids.length).fill(null);
    let next = 0;
    const worker = async () => {
      while (next < ids.length) {
        const i = next++;
        try {
          rows[i] = await this.sessionRowById(ids[i], courseId, token);
        } catch (error: unknown) {
          log.warn('Index session unavailable:', ids[i], error);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(INDEX_SESSION_CONCURRENCY, ids.length) }, worker));
    return rows.filter((r): r is SessionData => r !== null);
  }

  /** One session-list row rebuilt from session detail + `/v1/video`; null when it is not this course's or has no stream. */
  private async sessionRowById(sessionId: string, courseId: string, token: string): Promise<SessionData | null> {
    const detail = await this.makeRequest('GET', this.sessionDetailUrl(sessionId), token, undefined, {
      allowAnonymous: true,
    }) as SessionDetailApiResponse;
    if ((detail.code !== 0 && detail.code !== '0') || !detail.data || Array.isArray(detail.data) || !detail.data.id) {
      throw new Error(`Session ${sessionId}: ${detail.message || 'not found'}`);
    }
    const s = detail.data;
    if (String(s.course?.id ?? s.course_id) !== courseId) return null;

    // Future and unrecorded sessions have no video yet.
    const videoId = s.video_ids && s.video_ids.length > 0 ? String(s.video_ids[0]) : '';
    if (!videoId) return null;
    const res = await this.makeRequest('GET', `https://cbiz.yanhekt.cn/v1/video?id=${encodeURIComponent(videoId)}`, token, undefined, {
      allowAnonymous: true,
    }) as VideoDetailApiResponse;
    const video = res.code === 0 || res.code === '0' ? res.data : null;
    if (!video?.main?.trim() && !video?.vga?.trim()) return null;
    const realVideoId = video.id != null ? String(video.id) : videoId;
    return {
      session_id: String(s.id),
      video_id: realVideoId,
      title: s.title,
      duration: parseInt(String(video.duration ?? 0)) || 0,
      week_number: s.week_number,
      day: Number(s.day),
      started_at: s.started_at,
      ended_at: s.ended_at,
      main_url: video.main?.trim() || '',
      vga_url: video.vga?.trim() || '',
      id: realVideoId,
    };
  }

  /**
   * The session id behind one live broadcast, from `GET /v1/live?id=` detail
   * (anonymous-ok; both `with_*` flags are required or it answers 61101114).
   * List rows carry no session id, but the session exists before the class
   * starts, so a live lecture can be named by it. Null when the lookup fails or
   * the answer has no numeric id — callers keep the live-id name then.
   */
  async getLiveSessionId(liveId: string, token: string): Promise<string | null> {
    try {
      const url = `https://cbiz.yanhekt.cn/v1/live?id=${encodeURIComponent(liveId)}&with_session=true&with_course=true`;
      const response = (await this.makeRequest('GET', url, token, undefined, { allowAnonymous: true })) as {
        code?: number | string;
        data?: { session?: { id?: number | string } | null } | null;
      };
      if (response.code !== 0 && response.code !== '0') return null;
      const id = response.data?.session?.id;
      const text = id == null ? '' : String(id).trim();
      return /^\d+$/.test(text) ? text : null;
    } catch (error: unknown) {
      log.warn('Failed to look up the session of live', liveId, error);
      return null;
    }
  }

  /**
   * One course's detail from `/v1/course` alone — names, teachers, term,
   * college. Anonymous-ok; the session list is a separate, signed-in hop
   * ({@link getCourseSessions}), so a caller that has no token can still show
   * the course.
   */
  async getCourseDetail(courseId: string, token: string): Promise<CourseDetailResponse> {
    const courseApiUrl = `https://cbiz.yanhekt.cn/v1/course?id=${courseId}&with_professor_badges=true`;
    const courseResponse = await this.makeRequest('GET', courseApiUrl, token, undefined, { allowAnonymous: true });
    const courseData = courseResponse as CourseInfoApiResponse;

    if (courseData.code !== 0 && courseData.code !== "0") {
      switch (courseData.code) {
        case 12111010:
          throw new YanhektLookupError("Course not found, please check if course ID is correct", 'not_found');
        case 13001001:
        case 99151011:
          throw cbizEnvelopeError(courseData);
        default:
          throw new Error(`Course ID: ${courseId}, ${courseData.message}`);
      }
    }

    const name = courseData.data.name_zh.trim();
    const nameEn = courseData.data.name_en?.trim() || undefined;

    const professorNames = (courseData.data.professors || [])
      .map(p => p.name?.trim())
      .filter((n): n is string => !!n);
    const professor = professorNames[0] || "Unknown Teacher";

    return {
      course_id: courseId,
      title: name,
      title_en: nameEn,
      professor: professor,
      professors: professorNames,
      college_name: courseData.data.college_name,
      school_year: courseData.data.school_year,
      semester: courseData.data.semester,
      image_url: courseData.data.image_url || courseData.data.college?.image_url || undefined,
    };
  }

  async getCourseInfo(courseId: string, token: string): Promise<CourseInfoResponse> {
    try {
      const detail = await this.getCourseDetail(courseId, token);

      // An empty list is an answer, not an error. Yanhekt sends `{code:0, data:[]}`
      // both for a course with no recordings and for one this account may not
      // watch (its own site says 暂无当前课程权限): the list carries no permission
      // code, so the two cannot be told apart here. A wrong id or a bad token is
      // a non-zero `code`, thrown above and in getCourseSessions.
      const formattedVideos = await this.getCourseSessions(courseId, token);

      return { ...detail, videos: formattedVideos };
    } catch (error: unknown) {
      log.error('Failed to get course info:', error);
      throw error;
    }
  }

  /** Session detail *by id* — shared by {@link getSessionById} and {@link getSessionProgress}. */
  private sessionDetailUrl(sessionId: string): string {
    return `https://cbiz.yanhekt.cn/v1/course/session?session_id=${encodeURIComponent(sessionId)}&with_video=true`;
  }

  /**
   * Unused by the Electron app. Documented so the two session endpoints stay distinct.
   *
   * Playback / course pages enumerate via `GET /v2/course/session/list?course_id=`
   * (falling back to its `/v1` twin when empty) inside {@link getCourseInfo} (auth-required; anonymous response is `data: []`).
   *
   * This method is `GET /v1/course/session?session_id=&with_video=true` — session
   * detail *by id*. Proved anonymous-ok (2026-08-13): title, schedule, location,
   * nested `course`, historical `live` (incl. target URLs), and `video_ids`.
   * Does **not** include the authenticated list's `videos[]` VOD URLs; recover
   * those via `GET /v1/video?id=` using `video_ids`.
   */
  async getSessionById(sessionId: string, token: string): Promise<unknown> {
    return this.makeRequest('GET', this.sessionDetailUrl(sessionId), token, undefined, { allowAnonymous: true });
  }

  /**
   * Resolve one recorded session for download from its id alone.
   *
   * Two hops, both anonymous-ok and both routed through `allowAnonymous` so
   * Settings → Network "prefer anonymous requests" is honored exactly like the
   * course pages: session detail by id (title, schedule, nested course,
   * `video_ids`), then `GET /v1/video` for the first video's camera/screen/mic
   * URLs. The session *list* is never touched, which is what makes a known
   * session downloadable without a course page.
   *
   * Throws a user-readable message when the session does not exist or has no
   * recording yet.
   */
  async getSessionDownloadInfo(sessionId: string, token: string): Promise<SessionDownloadInfo> {
    const detail = await this.makeRequest('GET', this.sessionDetailUrl(sessionId), token, undefined, {
      allowAnonymous: true,
    }) as SessionDetailApiResponse;

    if ((detail.code !== 0 && detail.code !== "0") || !detail.data || Array.isArray(detail.data) || !detail.data.id) {
      throw new YanhektLookupError(`Session ${sessionId} not found`, 'not_found');
    }

    const s = detail.data;
    const videoId = s.video_ids && s.video_ids.length > 0 ? String(s.video_ids[0]) : '';
    if (!videoId) {
      throw new YanhektLookupError(`Session ${sessionId} has no recording yet`, 'no_recording');
    }

    const video = await this.makeRequest('GET', `https://cbiz.yanhekt.cn/v1/video?id=${encodeURIComponent(videoId)}`, token, undefined, {
      allowAnonymous: true,
    }) as VideoDetailApiResponse;

    if (video.code !== 0 && video.code !== "0") {
      throw new Error(`Failed to get video for session ${sessionId}: ${video.message}`);
    }

    const v = video.data || { id: videoId };
    const courseId = String(s.course?.id ?? s.course_id);
    return {
      session: {
        id: videoId,
        session_id: String(s.id),
        video_id: videoId,
        title: s.title,
        duration: parseInt(String(v.duration ?? 0)) || 0,
        week_number: s.week_number,
        day: Number(s.day),
        started_at: s.started_at,
        ended_at: s.ended_at,
        main_url: v.main?.trim() || '',
        vga_url: v.vga?.trim() || '',
      },
      course: {
        id: courseId,
        title: s.course?.name_zh?.trim() || '',
        titleEn: s.course?.name_en?.trim() || undefined,
        college_name: s.course?.college_name,
        school_year: s.course?.school_year,
        semester: s.course?.semester,
      },
      audioUrl: v.audio?.trim() || undefined,
    };
  }

  /**
   * This account's saved watch position for one recorded session.
   *
   * Same hop as {@link getSessionById}, but **never anonymous**: `user_progress`
   * is the one field on it that only exists for the account holding the Bearer,
   * so Settings → Network "prefer anonymous requests" must not reach it. The raw
   * field is returned untouched — it is `[]` for a session this account has never
   * played and an object afterwards; `@common/watchProgress` does the parsing.
   */
  async getSessionProgress(sessionId: string, token: string): Promise<unknown> {
    const response = await this.makeRequest('GET', this.sessionDetailUrl(sessionId), token) as BaseApiResponse & {
      data?: { user_progress?: unknown };
    };

    if (response.code !== 0 && response.code !== "0") {
      throw new Error(`Failed to get session progress: ${response.message}`);
    }

    return response.data?.user_progress ?? null;
  }

  /**
   * Report the playhead for one recorded session (the official player's heartbeat).
   *
   * `seconds` is expected on a 5-second grid — that is all the official site ever
   * sends, and matching it keeps our traffic indistinguishable from a browser's.
   */
  async reportSessionProgress(sessionId: string, seconds: number, token: string): Promise<void> {
    try {
      const url = 'https://cbiz.yanhekt.cn/v1/course/session/user/progress';
      const response = await this.makeRequest('PUT', url, token, {
        session_id: String(sessionId),
        seconds,
      }) as BaseApiResponse;

      if (!isCbizOk(response)) throw cbizEnvelopeError(response);
    } catch (error: unknown) {
      log.error('Failed to report session progress:', error);
      throw error;
    }
  }

  /**
   * Recover the classroom **mic audio** URL for one video id.
   *
   * `GET /v1/video?id=` is the only hop that carries `audio` — it is absent
   * from the authenticated `/v2/course/session/list` `videos[]` that
   * {@link getCourseInfo} reads, and from `/v1/course/session`. So a mic track
   * costs one extra request per video and cannot be a field passthrough;
   * callers are expected to memoise by video id.
   *
   * Proved anonymous-ok (2026-09-09), hence `allowAnonymous`. Yanhekt only
   * populates `audio` when the room recorded a Bluetooth mic, so an empty
   * string is the normal "this lecture has none" answer, not an error.
   */
  async getVideoAssets(videoId: string, token: string): Promise<{ audioUrl?: string }> {
    const url = `https://cbiz.yanhekt.cn/v1/video?id=${encodeURIComponent(videoId)}`;
    const response = await this.makeRequest('GET', url, token, undefined, { allowAnonymous: true }) as VideoDetailApiResponse;

    if (response.code !== 0 && response.code !== "0") {
      throw new Error(`Failed to get video assets: ${response.message}`);
    }

    const audio = response.data?.audio?.trim();
    return { audioUrl: audio || undefined };
  }

  // Parse semester name to extract school year and semester info
  private static parseSemesterName(name: string): { schoolYear: number; semester: number; labelEn: string } {
    // Parse format like "2025-2026 第一学期" or "2024-2025 第二学期"
    const match = name.match(/(\d{4})-(\d{4})\s+(第[一二]学期)/);
    if (!match) {
      return { schoolYear: 0, semester: 1, labelEn: name };
    }

    const startYear = parseInt(match[1]);
    const endYear = parseInt(match[2]);
    const semesterText = match[3];

    const semester = semesterText === '第一学期' ? 1 : 2;
    const schoolYear = startYear; // Use the starting year of the academic year

    // Generate English label
    let labelEn: string;
    if (semester === 1) {
      labelEn = `${startYear} Fall`;
    } else {
      labelEn = `${endYear} Spring`;
    }

    return { schoolYear, semester, labelEn };
  }

  /**
   * The terms the picker offers: only the current one. Yanhekt dropped the
   * `semesters` row from `/v1/tag/list` (2026-10), so there is no term list
   * upstream any more; `/v1/tag/semester/default` names the current term. The
   * full list will come from the Index once it is live. Throws on failure (no
   * hardcoded fallback), so the renderer's read cache never keeps a miss.
   */
  async getAvailableSemesters(): Promise<SemesterOption[]> {
    const tag = await this.getDefaultSemesterTag();
    const { schoolYear, semester, labelEn } = ApiClient.parseSemesterName(tag.name);
    return [{ id: Number(tag.id), label: tag.name, labelEn, schoolYear, semester }];
  }

  /** `GET /v1/tag/semester/default`: the current term's tag row. Always anonymous. */
  private async getDefaultSemesterTag(): Promise<SemesterTag> {
    const url = "https://cbiz.yanhekt.cn/v1/tag/semester/default";
    const { headers } = this.createHeaders(''); // no token, so no Authorization

    const response = await this.send({
      method: 'GET',
      url,
      headers,
      timeout: 10000,
      validateStatus: (status) => status < 500,
    });
    const body = response.data as DefaultSemesterResponse | undefined;
    if (!body || (body.code !== 0 && body.code !== "0") || !body.data?.id || !body.data.name) {
      throw new Error(`Failed to get the current semester: ${body?.message || `HTTP ${response.status}`}`);
    }
    return body.data;
  }

  async getVideoToken(token: string): Promise<string> {
    try {
      const url = "https://cbiz.yanhekt.cn/v1/auth/video/token?id=0";
      const response = await this.makeRequest('GET', url, token, undefined, { allowAnonymous: true });
      const data = response as VideoTokenApiResponse;

      if (!isCbizOk(data)) throw cbizEnvelopeError(data);

      return data.data.token;
    } catch (error: unknown) {
      log.error('Failed to get video token:', error);
      throw error;
    }
  }
}

// Maintain backward compatibility
export const MainApiClient = ApiClient;