/**
 * Yanhekt data API client. Ported from the AutoSlides desktop app
 * (autoslides/src/main/platform/apiClient.ts); the transport is a fetch to
 * this site's Worker proxy (/api/yanhekt/*), which injects the signature
 * headers and forwards to cbiz.yanhekt.cn.
 */
import { parseUserProgress, progressBucket, resumePositionFor } from "./watchProgress";
import { cached, invalidate } from "./requestCache";


export interface UserData {
  badge: string;
  nickname: string;
  gender?: number;
  phone?: string;
}

export interface TokenVerificationResult {
  valid: boolean;
  userData: UserData | null;
  networkError?: boolean;
}

export interface LiveStream {
  // The BROADCAST id (what /live/<id> refers to), not a course id.
  id: string;
  live_id?: string;
  title: string;
  subtitle?: string;
  status: number; // 0=ended, 1=live, 2=upcoming
  schedule_started_at: string;
  schedule_ended_at: string;
  participant_count?: number;
  // Cover art from the live list. Prefer `img`; nested course.image_url is a
  // secondary source and is often "".
  img?: string;
  course?: {
    id?: number | string;
    image_url?: string;
    /** Only on `GET /v1/live?id=` detail — list rows carry no classrooms at
     *  all, and their `course` object has no `id` either. */
    classrooms?: Array<{ name: string }>;
    /** Also detail-only. This is the single source of an English title for a
     *  live broadcast; list rows have no `name_en` anywhere. Display only. */
    name_en?: string;
  };
  session?: {
    // The real course id behind this broadcast (present on every sampled live
    // row, unlike the partial sibling `course` object).
    course_id?: number | string;
    professor?: {
      name: string;
    };
    section_group_title?: string;
  };
  target?: string; // Camera stream URL
  target_vga?: string; // Screen stream URL
}

export interface LiveListResponse {
  data: LiveStream[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface CourseData {
  id: string;
  name_zh: string;
  /** English course name. Present on /v2/course/list and /v1/course; often absent.
   *  Display only — never let it reach a folder key, note title, or slide metadata. */
  name_en?: string;
  professors: string[];
  classrooms: { name: string }[];
  school_year: string;
  semester: string;
  college_name: string;
  participant_count: number;
  /** Course cover from Yanhekt (college banner or custom). Empty string = missing. */
  image_url?: string;
}

export interface CourseListResponse {
  data: CourseData[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

/** Raw row from GET /v1/course/subscription/list (professors may be objects). */
export interface SubscriptionCourseRow {
  id: number | string;
  name_zh: string;
  /** English course name. Present on /v2/course/list and /v1/course; often absent.
   *  Display only — never let it reach a folder key, note title, or slide metadata. */
  name_en?: string;
  professor_names?: string[];
  professors?: Array<{ name?: string } | string>;
  classrooms?: Array<{ name: string }>;
  participant_count?: number;
  college_name?: string;
  college?: { name?: string; image_url?: string };
  school_year?: string | number;
  semester?: string | number;
  image_url?: string;
}

export interface SubscriptionListResponse {
  data: SubscriptionCourseRow[];
  current_page: number;
  last_page: number;
  per_page: number | string;
  total: number;
}

export interface SessionData {
  id: string;
  session_id: string;
  video_id: string;
  title: string;
  duration: number;
  week_number: number;
  day: number;
  started_at: string;
  ended_at: string;
  main_url?: string;
  vga_url?: string;
}

export interface CourseInfoResponse {
  course_id: string;
  /** Chinese course name (name_zh). The canonical title — the IndexedDB folder key,
   *  slide metadata and managed note titles all derive from this one. */
  title: string;
  /** English course name (name_en), when the API supplied one. Display only. */
  title_en?: string;
  professor: string;
  professors?: string[];
  college_name?: string;
  school_year?: string;
  semester?: number | string;
  /** Cover from /v1/course; empty string treated as missing by callers. */
  image_url?: string;
  videos: SessionData[];
}

export interface SemesterOption {
  id: number;
  label: string;
  labelEn: string;
  schoolYear: number;
  semester: number;
}

interface TagItem {
  id: number;
  parent_id: number;
  name: string;
  show_type: number;
  param: string;
  sort: number;
  children?: TagItem[];
}

interface BaseApiResponse {
  code: number | string;
  message: string;
}

interface CourseInfoApiResponse extends BaseApiResponse {
  data: {
    name_zh: string;
    // English course name, when the teacher filled it in. Frequently absent or a
    // placeholder — callers must fall back to name_zh.
    name_en?: string;
    professors: Array<{ name: string }>;
    school_year?: string;
    semester?: number | string;
    // Often empty ("") even when the nested college object is populated —
    // verified against the live API. NO classrooms / participant_count here;
    // those exist only in the course list/search responses (recover via
    // `lookupCourseById` — keyword = course id, all semesters).
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

const PROXY_BASE = "/api/yanhekt";

function unwrapEnvelope<T>(data: BaseApiResponse & { data: T }): T {
  if (data.code !== 0 && data.code !== "0") {
    switch (data.code) {
      case 13001001:
        throw new Error("Authentication failed, please check if token is valid");
      case 99151011:
        throw new Error("Remote server error or is temporarily down, please try again later");
      case 12111010:
        throw new Error("Course not found, please check if course ID is correct");
      default:
        throw new Error(`API error: ${data.message} (code: ${data.code})`);
    }
  }
  return data.data;
}

/**
 * How long a resolved GET may be reused, by upstream path prefix. Every entry
 * here is a Worker invocation saved: the proxy answers `no-store`, so without
 * this a nav ping-pong between two sidebar tabs re-fetches both lists each time.
 *
 * TTLs are deliberately short and per-endpoint rather than one global number —
 * a semester tree is stable for months, a live list is not. Paths with no entry
 * (`/v1/user`, `/v1/video`) are never memoized; they still coalesce.
 */
const GET_TTL_MS: ReadonlyArray<readonly [prefix: string, ttlMs: number]> = [
  ["/v1/tag/list", 60 * 60 * 1000],
  // Course detail is static within a session. This is what collapses the three
  // getCourseInfo runs a single lecture open used to make (session page, then
  // PlayerRoute, then PlaybackPage) into one.
  ["/v2/course/session/list", 5 * 60 * 1000],
  ["/v1/course/subscription/list", 60 * 1000],
  ["/v2/course/private/list", 60 * 1000],
  ["/v2/course/list", 60 * 1000],
  // Never memoize: this hop carries `user_progress`, the account's live watch
  // position. A memo would resurrect a stale playhead when a lecture is
  // reopened. First match wins, so this must stay above the /v1/course rule.
  ["/v1/course/session", 0],
  ["/v1/course", 5 * 60 * 1000],
  // Live status genuinely changes while the user is looking at it.
  ["/v2/live/list", 30 * 1000],
  ["/v1/live", 30 * 1000],
];

/** First matching prefix wins, so ordering in GET_TTL_MS is load-bearing.
 *  Exported for api.test.ts. */
export function ttlFor(path: string): number {
  const hit = GET_TTL_MS.find(([prefix]) => path.startsWith(prefix));
  return hit ? hit[1] : 0;
}

/**
 * Cache key for a GET. The token rides in it (truncated — this is a cache key,
 * not a credential) so switching accounts can never be served the previous
 * account's data; sign-out additionally clears the whole cache.
 */
function cacheKey(path: string, token: string | null): string {
  return `GET ${path}|${token ? token.slice(0, 8) : "anon"}`;
}

/**
 * Fetch through the Worker proxy and unwrap the {code, message, data} envelope.
 *
 * GETs are coalesced (a repeat click joins the in-flight request instead of
 * issuing a second one) and, where GET_TTL_MS allows, briefly memoized.
 */
async function request<T>(path: string, token: string | null): Promise<T> {
  return cached(cacheKey(path, token), ttlFor(path), () =>
    requestMethod<T>("GET", path, token),
  );
}

/** Method+body variant (POST/DELETE) — same envelope/error handling as GET. */
async function requestMethod<T>(
  method: string,
  path: string,
  token: string | null,
  body?: Record<string, unknown>,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  const response = await fetch(`${PROXY_BASE}${path}`, init);
  if (response.status === 403) {
    throw new Error("Authentication failed, please check if token is valid");
  }
  const data = (await response.json()) as BaseApiResponse & { data: T };
  const unwrapped = unwrapEnvelope(data);
  // A write invalidates every cached read, because a subscribe/unsubscribe
  // changes both the subscription list and the course lists that mirror it.
  if (method !== "GET") invalidate("GET ");
  return unwrapped;
}

export async function verifyToken(token: string): Promise<TokenVerificationResult> {
  try {
    const response = await fetch(`${PROXY_BASE}/v1/user`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await response.json()) as BaseApiResponse & { data?: UserData };

    if (data.code === 0 || data.code === "0") {
      return {
        valid: true,
        userData: {
          badge: data.data?.badge || "",
          nickname: data.data?.nickname || "",
          gender: data.data?.gender || 3,
          phone: data.data?.phone || "",
        },
      };
    }
    return { valid: false, userData: null };
  } catch (error) {
    console.error("Token verification error:", error);
    return { valid: false, userData: null, networkError: true };
  }
}

/**
 * Best-effort server-side session revoke via the Worker proxy. Callers
 * fire-and-forget this so local sign-out never waits on the network.
 */
export async function revokeToken(token: string): Promise<void> {
  if (!token) return;
  try {
    await fetch(`${PROXY_BASE}/v1/cas/logout`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // best-effort — ignore network failures
  }
}

export async function getLiveList(
  token: string,
  page = 1,
  pageSize = 16,
  userRelationshipType = 0,
): Promise<LiveListResponse> {
  return request<LiveListResponse>(
    `/v2/live/list?page=${page}&page_size=${pageSize}&user_relationship_type=${userRelationshipType}`,
    token,
  );
}

export async function getPersonalLiveList(token: string, page = 1, pageSize = 16): Promise<LiveListResponse> {
  return getLiveList(token, page, pageSize, 1);
}

export async function searchLiveList(
  token: string,
  keyword: string,
  page = 1,
  pageSize = 16,
): Promise<LiveListResponse> {
  return request<LiveListResponse>(
    `/v2/live/list?page=${page}&page_size=${pageSize}&keyword=${encodeURIComponent(keyword)}`,
    token,
  );
}

/**
 * One live broadcast by its id.
 *
 * There is no by-id endpoint on the live *list*, so a cold deep link to
 * /player/live/:id used to page the personal list and then the public list
 * (up to 10 requests) hunting for a matching row. This is the official SPA's
 * own call and answers in one.
 *
 * Both `with_*` flags are required — dropping either answers `61101114
 * 系统繁忙`, not a partial payload. Anonymous-ok (the Worker strips the Bearer).
 *
 * Returns a payload shaped like a live-list row so `transformLiveStreamToCourse`
 * consumes it unchanged. It is strictly richer than a list row except for
 * `participant_count`, which this endpoint does not carry (it reports
 * `looking_count`, a live viewer count — a different number, so it is
 * deliberately not mapped onto it).
 */
export async function getLiveById(liveId: string, token: string): Promise<LiveStream> {
  const id = String(liveId || "").trim();
  return request<LiveStream>(
    `/v1/live?id=${encodeURIComponent(id)}&with_session=true&with_course=true`,
    token,
  );
}

/**
 * Course names only, from the single `/v1/course?id=` hop.
 *
 * Deliberately not {@link getCourseInfo}, which also pages the session list and
 * **throws** when a course has none — the case for a course that has only ever
 * been broadcast live. Live rows carry no `name_en`, so this is how a live
 * player title becomes English. Anonymous-ok (the Worker strips the Bearer).
 *
 * Resolves null instead of throwing: a missing English title never justifies
 * failing a render.
 */
export async function getCourseNames(
  courseId: string,
  token: string,
): Promise<{ nameZh: string; nameEn?: string } | null> {
  try {
    const data = await request<{ name_zh?: string; name_en?: string }>(
      `/v1/course?id=${encodeURIComponent(courseId)}`,
      token,
    );
    const nameZh = data?.name_zh?.trim() ?? "";
    const nameEn = data?.name_en?.trim() || undefined;
    return nameZh || nameEn ? { nameZh, nameEn } : null;
  } catch (error) {
    console.warn("Failed to read course names:", error);
    return null;
  }
}

export async function getCourseList(
  token: string,
  options: { semesters?: number[]; page?: number; pageSize?: number; keyword?: string } = {},
): Promise<CourseListResponse> {
  const { semesters = [], page = 1, pageSize = 16, keyword = "" } = options;

  const params = new URLSearchParams();
  semesters.forEach((semesterId) => params.append("semesters[]", semesterId.toString()));
  params.append("page", page.toString());
  params.append("page_size", pageSize.toString());
  if (keyword && keyword.trim()) params.append("keyword", keyword.trim());

  return request<CourseListResponse>(`/v2/course/list?${params.toString()}`, token);
}

export async function getPersonalCourseList(
  token: string,
  options: { page?: number; pageSize?: number } = {},
): Promise<CourseListResponse> {
  const { page = 1, pageSize = 16 } = options;

  const params = new URLSearchParams();
  params.append("page", page.toString());
  params.append("page_size", pageSize.toString());
  params.append("user_relationship_type", "1");
  params.append("with_introduction", "true");

  return request<CourseListResponse>(`/v2/course/private/list?${params.toString()}`, token);
}

/**
 * One page of the account's Yanhekt course subscriptions. Upstream defaults to
 * page_size=4 when omitted — always pass an explicit pageSize (100 is enough
 * for typical accounts; callers should paginate on last_page).
 */
export async function getSubscriptionList(
  token: string,
  options: { page?: number; pageSize?: number } = {},
): Promise<SubscriptionListResponse> {
  const { page = 1, pageSize = 100 } = options;
  const params = new URLSearchParams();
  params.append("page", page.toString());
  params.append("page_size", pageSize.toString());
  return request<SubscriptionListResponse>(
    `/v1/course/subscription/list?${params.toString()}`,
    token,
  );
}

export async function subscribeCourse(token: string, courseId: string): Promise<void> {
  await requestMethod<unknown>("POST", "/v1/course/subscription", token, {
    course_id: String(courseId),
  });
}

export async function unsubscribeCourse(token: string, courseId: string): Promise<void> {
  await requestMethod<unknown>("DELETE", "/v1/course/subscription", token, {
    course_id: String(courseId),
  });
}

export async function getCourseInfo(courseId: string, token: string): Promise<CourseInfoResponse> {
  const courseData = await request<CourseInfoApiResponse["data"]>(
    `/v1/course?id=${courseId}&with_professor_badges=true`,
    token,
  );
  const videoList = await request<SessionListApiResponse["data"]>(
    `/v2/course/session/list?course_id=${courseId}`,
    token,
  );

  if (!videoList || videoList.length === 0) {
    throw new Error(
      "Course information returned error, please check if authentication is obtained and course ID is correct",
    );
  }

  const name = courseData.name_zh.trim();
  const nameEn = courseData.name_en?.trim() || undefined;
  const professorNames = (courseData.professors || [])
    .map((p) => p.name?.trim())
    .filter((n): n is string => !!n);
  const professor = professorNames[0] || "Unknown Teacher";

  const formattedVideos: SessionData[] = videoList.map((video) => {
    const videoData = video.videos && video.videos.length > 0 ? video.videos[0] : null;
    // The API returns numeric ids at runtime despite the declared string
    // types (the Electron app String()s them at every use site). Normalize
    // here so router params and Map keys compare reliably.
    const realVideoId = videoData ? String(videoData.id) : "";

    return {
      session_id: String(video.id),
      video_id: realVideoId,
      title: video.title,
      duration: videoData ? parseInt(videoData.duration) : 0,
      week_number: video.week_number,
      day: video.day,
      started_at: video.started_at,
      ended_at: video.ended_at,
      main_url: videoData ? videoData.main : "",
      vga_url: videoData ? videoData.vga : "",
      id: realVideoId,
    };
  });

  return {
    course_id: String(courseId),
    title: name,
    title_en: nameEn,
    professor,
    professors: professorNames,
    college_name: courseData.college_name || courseData.college?.name,
    school_year: courseData.school_year,
    semester: courseData.semester,
    image_url: courseData.image_url || courseData.college?.image_url || undefined,
    videos: formattedVideos,
  };
}

interface VideoDetailData {
  id: number | string;
  audio?: string;
}

const audioUrlCache = new Map<string, string | undefined>();

/**
 * Classroom mic sidecar for a recorded video. The URL lives only on
 * GET /v1/video (anonymous upstream); the session list does not carry it.
 * Memoised by video id, including known-absent, so a playback tab, a
 * stream switch and a re-open of the same lecture share one request.
 * Network failures are not cached.
 */
export async function getMicAudioUrl(videoId: string, token: string): Promise<string | undefined> {
  const id = String(videoId || "").trim();
  if (!id) return undefined;
  if (audioUrlCache.has(id)) return audioUrlCache.get(id);

  try {
    const data = await request<VideoDetailData>(`/v1/video?id=${encodeURIComponent(id)}`, token);
    const audioUrl = data?.audio?.trim() || undefined;
    audioUrlCache.set(id, audioUrl);
    return audioUrl;
  } catch (error) {
    console.error("Failed to get mic audio URL:", error);
    return undefined;
  }
}

/**
 * This account's saved watch position for a recorded session, as the second to
 * seek to — or null for "start at the beginning".
 *
 * The Worker keeps the Bearer on this hop deliberately: `user_progress` is the
 * one field on it that only exists for the account holding the token. Never
 * throws — an unwatched session, a logged-out account and a network failure are
 * all the same answer to the only caller that asks.
 */
export async function getResumePosition(sessionId: string, token: string): Promise<number | null> {
  const id = String(sessionId || "").trim();
  if (!id || !token) return null;

  try {
    const data = await request<{ user_progress?: unknown }>(
      `/v1/course/session?session_id=${encodeURIComponent(id)}&with_video=true`,
      token,
    );
    return resumePositionFor(parseUserProgress(data?.user_progress));
  } catch (error) {
    console.warn("Failed to read server watch progress:", error);
    return null;
  }
}

/**
 * Report the playhead directly. This is the *only* billed report the client
 * makes, and it fires just at the edges — on pause and on close — because that
 * is when segment fetches, and with them the free relay-side heartbeat, stop.
 * There is deliberately no wall-clock fallback for browsers that cannot
 * piggyback. `seconds` is expected on the 5-second grid the official player uses.
 *
 * `keepalive` so a report fired from `pagehide` survives the page going away.
 * Never throws — a dropped heartbeat costs nothing.
 */
export async function reportWatchProgress(sessionId: string, seconds: number, token: string): Promise<void> {
  const id = String(sessionId || "").trim();
  if (!id || !token || !(seconds > 0)) return;

  try {
    await fetch(`${PROXY_BASE}/v1/course/session/user/progress`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: id, seconds: progressBucket(seconds) }),
      keepalive: true,
    });
  } catch (error) {
    console.warn("Failed to report watch progress:", error);
  }
}

function parseSemesterName(name: string): { schoolYear: number; semester: number; labelEn: string } {
  // Parse format like "2025-2026 第一学期" or "2024-2025 第二学期"
  const match = name.match(/(\d{4})-(\d{4})\s+(第[一二]学期)/);
  if (!match) {
    return { schoolYear: 0, semester: 1, labelEn: name };
  }

  const startYear = parseInt(match[1]);
  const endYear = parseInt(match[2]);
  const semester = match[3] === "第一学期" ? 1 : 2;
  const labelEn = semester === 1 ? `${startYear} Fall` : `${endYear} Spring`;

  return { schoolYear: startYear, semester, labelEn };
}

export async function getAvailableSemesters(token: string): Promise<SemesterOption[]> {
  try {
    // Worker still requires a 32-hex Bearer; it omits Authorization upstream.
    const tags = await request<TagItem[]>("/v1/tag/list?with_sub=true", token);

    const semesterTag = tags.find((tag) => tag.param === "semesters");
    if (!semesterTag || !semesterTag.children) {
      throw new Error("Semester information not found in tag list");
    }

    const semesters: SemesterOption[] = semesterTag.children.map((child) => {
      const { schoolYear, semester, labelEn } = parseSemesterName(child.name);
      return { id: child.id, label: child.name, labelEn, schoolYear, semester };
    });

    semesters.sort((a, b) => {
      const aChild = semesterTag.children?.find((c) => c.id === a.id);
      const bChild = semesterTag.children?.find((c) => c.id === b.id);
      return (bChild?.sort || 0) - (aChild?.sort || 0);
    });

    return semesters;
  } catch (error) {
    console.error("Failed to get available semesters, falling back to hardcoded list:", error);
    return getFallbackSemesters();
  }
}

function getFallbackSemesters(): SemesterOption[] {
  return [
    { id: 107, label: "2025-2026 第二学期", labelEn: "2026 Spring", schoolYear: 2025, semester: 2 },
    { id: 100, label: "2025-2026 第一学期", labelEn: "2025 Fall", schoolYear: 2025, semester: 1 },
    { id: 96, label: "2024-2025 第二学期", labelEn: "2025 Spring", schoolYear: 2024, semester: 2 },
    { id: 95, label: "2024-2025 第一学期", labelEn: "2024 Fall", schoolYear: 2024, semester: 1 },
    { id: 94, label: "2023-2024 第二学期", labelEn: "2024 Spring", schoolYear: 2023, semester: 2 },
    { id: 92, label: "2023-2024 第一学期", labelEn: "2023 Fall", schoolYear: 2023, semester: 1 },
  ];
}

/** Why a sign-in did not produce a token. Mirrors SignInReason in the Worker. */
export type SignInReason =
  | "bad_credentials"
  | "account_locked"
  | "account_inactive"
  | "account_dormant"
  | "code_rejected"
  | "captcha_required"
  | "risk_rejected"
  | "challenge_expired"
  | "sms_unavailable"
  | "sms_send_failed"
  | "unsupported_page"
  | "network"
  | "unknown";

export interface LoginResult {
  success: boolean;
  token?: string;
  error?: string;
  reason?: SignInReason;
  /**
   * Sealed remembered-device state. Opaque to us; handing it back on the next
   * sign-in is what lets campus SSO skip the SMS second factor.
   */
  deviceKeepsake?: string;
  /**
   * Set instead of token/error when campus SSO demands a texted code. Finish
   * with submitSmsCode(); the resume token is a short-lived session secret, so
   * keep it in memory only.
   */
  smsRequired?: {
    phoneHint: string;
    resumeToken: string;
    resumeNonce: string;
    expiresIn: number;
  };
}

/** Shape the Worker returns on 202. */
interface SmsRequiredBody {
  status?: string;
  phoneHint?: string;
  resumeToken?: string;
  resumeNonce?: string;
  expiresIn?: number;
}

/**
 * Password login through the Worker's CAS route. A 202 means the password was
 * accepted but an SMS code is still needed.
 */
export async function loginWithPassword(
  username: string,
  password: string,
  deviceKeepsake?: string | null,
): Promise<LoginResult> {
  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, deviceKeepsake: deviceKeepsake ?? undefined }),
    });

    if (response.status === 202) {
      const body = (await response.json()) as SmsRequiredBody;
      if (body.resumeToken) {
        return {
          success: false,
          smsRequired: {
            phoneHint: body.phoneHint ?? "",
            resumeToken: body.resumeToken,
            resumeNonce: body.resumeNonce ?? "",
            expiresIn: body.expiresIn ?? 300,
          },
        };
      }
      return { success: false, reason: "unknown", error: "Verification could not be started" };
    }

    return (await response.json()) as LoginResult;
  } catch {
    return { success: false, reason: "network", error: "Network error, please try again" };
  }
}

/** Answer an SMS second factor, completing the sign-in the 202 started. */
export async function submitSmsCode(
  resumeToken: string,
  resumeNonce: string,
  code: string,
): Promise<LoginResult> {
  try {
    const response = await fetch("/api/login/sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeToken, resumeNonce, code }),
    });
    return (await response.json()) as LoginResult;
  } catch {
    return { success: false, reason: "network", error: "Network error, please try again" };
  }
}
