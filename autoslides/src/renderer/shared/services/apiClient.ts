// Type definitions are available globally

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
  videos: SessionData[];
}

export interface SemesterOption {
  id: number;
  label: string;
  labelEn: string;
  schoolYear: number;
  semester: number;
}

export class ApiClient {
  async verifyToken(token: string): Promise<TokenVerificationResult> {
    try {
      return await window.electronAPI.auth.verifyToken(token);
    } catch (error) {
      console.error('Token verification error:', error);
      return { valid: false, userData: null, networkError: false };
    }
  }

  async getPersonalLiveList(token: string, page = 1, pageSize = 16): Promise<LiveListResponse> {
    try {
      return await window.electronAPI.api.getPersonalLiveList(token, page, pageSize);
    } catch (error) {
      console.error('Failed to get personal live list:', error);
      throw error;
    }
  }

  async searchLiveList(token: string, keyword: string, page = 1, pageSize = 16): Promise<LiveListResponse> {
    try {
      return await window.electronAPI.api.searchLiveList(token, keyword, page, pageSize);
    } catch (error) {
      console.error('Failed to search live list:', error);
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
      return await window.electronAPI.api.getCourseList(token, options);
    } catch (error) {
      console.error('Failed to get course list:', error);
      throw error;
    }
  }

  async getPersonalCourseList(token: string, options: {
    page?: number;
    pageSize?: number;
  } = {}): Promise<CourseListResponse> {
    try {
      return await window.electronAPI.api.getPersonalCourseList(token, options);
    } catch (error) {
      console.error('Failed to get personal course list:', error);
      throw error;
    }
  }

  async getCourseInfo(courseId: string, token: string): Promise<CourseInfoResponse> {
    try {
      return await window.electronAPI.api.getCourseInfo(courseId, token);
    } catch (error) {
      console.error('Failed to get course info:', error);
      throw error;
    }
  }

  async getAvailableSemesters(): Promise<SemesterOption[]> {
    try {
      return await window.electronAPI.api.getAvailableSemesters();
    } catch (error) {
      console.error('Failed to get available semesters:', error);
      throw error;
    }
  }
}