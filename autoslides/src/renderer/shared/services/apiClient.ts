// Type definitions are available globally

import { overrides } from '../overrideRegistry'
import { createLogger } from '@shared/utils/logger';
const log = createLogger('ServicesApiClient');

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
  // Rich course context from /v1/course (used to hydrate thin/pinned courses).
  // `classrooms` is not provided by this endpoint — recover via lookupCourseById.
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
};

export class ApiClient {
  // Resolved lazily per call so an override registered after construction (and
  // after this module is first imported) is still honored.
  private get transport(): ApiTransport {
    return overrides.apiTransport ?? realApiTransport;
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

  async getAvailableSemesters(): Promise<SemesterOption[]> {
    try {
      return await this.transport.getAvailableSemesters();
    } catch (error) {
      log.error('Failed to get available semesters:', error);
      throw error;
    }
  }
}