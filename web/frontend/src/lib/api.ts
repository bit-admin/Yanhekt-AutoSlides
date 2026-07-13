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
  id: string;
  live_id?: string;
  title: string;
  subtitle?: string;
  status: number; // 0=ended, 1=live, 2=upcoming
  schedule_started_at: string;
  schedule_ended_at: string;
  participant_count?: number;
  session?: {
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
}

export interface CourseListResponse {
  data: CourseData[];
  current_page: number;
  last_page: number;
  per_page: number;
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
    // those exist only in the course list/search responses.
    college_name?: string;
    college?: { name?: string };
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

/** Fetch through the Worker proxy and unwrap the {code, message, data} envelope. */
async function request<T>(path: string, token: string | null): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(`${PROXY_BASE}${path}`, { headers });
  const data = (await response.json()) as BaseApiResponse & { data: T };

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

export interface LoginResult {
  success: boolean;
  token?: string;
  error?: string;
}

/** Password login through the Worker's CAS-scrape route. */
export async function loginWithPassword(username: string, password: string): Promise<LoginResult> {
  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    return (await response.json()) as LoginResult;
  } catch {
    return { success: false, error: "Network error, please try again" };
  }
}
