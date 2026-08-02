/**
 * Yanhekt data API client. Ported from the AutoSlides desktop app
 * (autoslides/src/main/platform/apiClient.ts); the transport is a fetch to
 * this site's Worker proxy (/api/yanhekt/*), which injects the signature
 * headers and forwards to cbiz.yanhekt.cn.
 */

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
  title: string;
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

/** Fetch through the Worker proxy and unwrap the {code, message, data} envelope. */
async function request<T>(path: string, token: string | null): Promise<T> {
  return requestMethod<T>("GET", path, token);
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
  const data = (await response.json()) as BaseApiResponse & { data: T };
  return unwrapEnvelope(data);
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
    professor,
    professors: professorNames,
    college_name: courseData.college_name || courseData.college?.name,
    school_year: courseData.school_year,
    semester: courseData.semester,
    image_url: courseData.image_url || courseData.college?.image_url || undefined,
    videos: formattedVideos,
  };
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

export async function getAvailableSemesters(): Promise<SemesterOption[]> {
  try {
    // No Authorization header — the tag list is a public endpoint.
    const tags = await request<TagItem[]>("/v1/tag/list?with_sub=true", null);

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
