/**
 * Yanhekt API payload models shared by the main-process ApiClient, the
 * renderer ApiClient/transport, and the preload typings. Single source of
 * truth — do not redeclare these shapes elsewhere (they used to live in both
 * apiClient.ts files and again as ambient types in vite-env.d.ts).
 *
 * Note: list/detail payloads carry ids as **numbers** at runtime even where
 * typed `string`; normalise with `String(...)` at map/route boundaries.
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
    // The real course id behind this broadcast. Verified present on 63/63
    // sampled live rows — far more reliable than the sibling `course` object
    // (14/63), which is why this is the source used for live identity.
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

// Raw row from GET /v1/course/subscription/list — professors may be objects
// (like /v1/course) or already strings; professor_names is preferred when present.
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
  // Rich course context surfaced from /v1/course so callers (e.g. the sessions
  // page) can hydrate a thin course — notably one opened from a pin, which
  // carries only id + title. `classrooms` is intentionally absent (not returned
  // by this endpoint).
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
