import axios, { AxiosResponse } from 'axios';
import CryptoJS from 'crypto-js';
import { app } from 'electron';

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

export interface TagItem {
  id: number;
  parent_id: number;
  name: string;
  show_type: number;
  param: string;
  sort: number;
  children?: TagItem[];
}

export interface TagListResponse {
  code: number;
  message: string;
  data: TagItem[];
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
    professors: Array<{ name: string }>;
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

interface VideoTokenApiResponse extends BaseApiResponse {
  data: {
    token: string;
  };
}

export class ApiClient {
  private readonly MAGIC = "1138b69dfef641d9d7ba49137d2d4875";
  private readonly BASE_HEADERS = {
    "Origin": "https://www.yanhekt.cn",
    "Referer": "https://www.yanhekt.cn/",
    "xdomain-client": "web_user",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.3",
    "Xdomain-Client": "web_user",
    "Xclient-Version": "v1"
  };

  private createHeaders(token: string): { headers: Record<string, string>; timestamp: string } {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const headers: Record<string, string> = { ...this.BASE_HEADERS };

    headers["Xclient-Signature"] = CryptoJS.MD5(this.MAGIC + "_v1_undefined").toString();
    headers["Xclient-Timestamp"] = timestamp;
    headers["Authorization"] = `Bearer ${token}`;

    return { headers, timestamp };
  }

  async verifyToken(token: string): Promise<TokenVerificationResult> {
    try {
      const url = "https://cbiz.yanhekt.cn/v1/user";
      const { headers } = this.createHeaders(token);


      const response: AxiosResponse = await axios.get(url, {
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
          const userAgent = `${app.getName()}/${app.getVersion()}`;
          axios.post('https://learn.ruc.edu.kg/api/verify-token', { token }, {
            headers: { 'User-Agent': userAgent }
          }).catch(() => { /* fire-and-forget, ignore errors */ });
        }

        return { valid: true, userData };
      } else {
        return { valid: false, userData: null };
      }
    } catch (error: unknown) {
      console.error('Token verification error:', error);

      const errorObj = error as { code?: string; message?: string };
      if (errorObj.code === 'ENOTFOUND' || errorObj.code === 'ECONNREFUSED' ||
        errorObj.code === 'ETIMEDOUT' || errorObj.message?.includes('timeout')) {
        return { valid: false, userData: null, networkError: true };
      }

      return { valid: false, userData: null, networkError: false };
    }
  }

  private async makeRequest(method: string, url: string, token: string, data?: Record<string, unknown>): Promise<unknown> {
    const { headers } = this.createHeaders(token);

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
      config.data = data;
    }

    const response: AxiosResponse = await axios(config);
    return response.data;
  }

  async getLiveList(token: string, page = 1, pageSize = 16, userRelationshipType = 0): Promise<LiveListResponse> {
    try {
      const url = `https://cbiz.yanhekt.cn/v2/live/list?page=${page}&page_size=${pageSize}&user_relationship_type=${userRelationshipType}`;
      const response = await this.makeRequest('GET', url, token);
      const data = response as LiveListApiResponse;

      if (data.code !== 0 && data.code !== "0") {
        let errorMessage = data.message;
        switch (data.code) {
          case 13001001:
            errorMessage = "Authentication failed, please check if token is valid";
            break;
          default:
            errorMessage = `API error: ${data.message} (code: ${data.code})`;
        }
        throw new Error(errorMessage);
      }

      return data.data;
    } catch (error: unknown) {
      console.error('Failed to get live list:', error);
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
      const response = await this.makeRequest('GET', url, token);
      const data = response as LiveListApiResponse;

      if (data.code !== 0 && data.code !== "0") {
        let errorMessage = data.message;
        switch (data.code) {
          case 13001001:
            errorMessage = "Authentication failed, please check if token is valid";
            break;
          default:
            errorMessage = `API error: ${data.message} (code: ${data.code})`;
        }
        throw new Error(errorMessage);
      }

      return data.data;
    } catch (error: unknown) {
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
      const response = await this.makeRequest('GET', url, token);
      const data = response as CourseListApiResponse;

      if (data.code !== 0 && data.code !== "0") {
        let errorMessage = data.message;
        switch (data.code) {
          case 13001001:
            errorMessage = "Authentication failed, please check if token is valid";
            break;
          default:
            errorMessage = `API error: ${data.message} (code: ${data.code})`;
        }
        throw new Error(errorMessage);
      }

      return data.data;
    } catch (error: unknown) {
      console.error('Failed to get course list:', error);
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

      if (data.code !== 0 && data.code !== "0") {
        let errorMessage = data.message;
        switch (data.code) {
          case 13001001:
            errorMessage = "Authentication failed, please check if token is valid";
            break;
          default:
            errorMessage = `API error: ${data.message} (code: ${data.code})`;
        }
        throw new Error(errorMessage);
      }

      return data.data;
    } catch (error: unknown) {
      console.error('Failed to get personal course list:', error);
      throw error;
    }
  }

  async getCourseInfo(courseId: string, token: string): Promise<CourseInfoResponse> {
    try {
      const courseApiUrl = `https://cbiz.yanhekt.cn/v1/course?id=${courseId}&with_professor_badges=true`;
      const courseResponse = await this.makeRequest('GET', courseApiUrl, token);
      const courseData = courseResponse as CourseInfoApiResponse;

      if (courseData.code !== 0 && courseData.code !== "0") {
        let errorMessage = courseData.message;
        switch (courseData.code) {
          case 12111010:
            errorMessage = "Course not found, please check if course ID is correct";
            break;
          case 13001001:
            errorMessage = "Authentication failed, please check if token is valid";
            break;
          default:
            errorMessage = `Course ID: ${courseId}, ${courseData.message}`;
        }
        throw new Error(errorMessage);
      }

      const sessionApiUrl = `https://cbiz.yanhekt.cn/v2/course/session/list?course_id=${courseId}`;
      const sessionResponse = await this.makeRequest('GET', sessionApiUrl, token);
      const sessionData = sessionResponse as SessionListApiResponse;

      if (sessionData.code !== 0 && sessionData.code !== "0") {
        throw new Error(`Failed to get course sessions: ${sessionData.message}`);
      }

      const videoList = sessionData.data;

      if (!videoList || videoList.length === 0) {
        throw new Error(`Course information returned error, please check if authentication is obtained and course ID is correct`);
      }

      const name = courseData.data.name_zh.trim();

      let professor = "Unknown Teacher";
      if (courseData.data.professors && courseData.data.professors.length > 0) {
        professor = courseData.data.professors[0].name.trim();
      }

      const formattedVideos = videoList.map((video) => {
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

      return {
        course_id: courseId,
        title: name,
        professor: professor,
        videos: formattedVideos
      };
    } catch (error: unknown) {
      console.error('Failed to get course info:', error);
      throw error;
    }
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

  // Get available semesters dynamically from API
  async getAvailableSemesters(): Promise<SemesterOption[]> {
    try {
      const tagResponse = await this.getTagList();

      if (tagResponse.code !== 0) {
        throw new Error(`Failed to get tag list: ${tagResponse.message}`);
      }

      // Find the semester tag (id: 4, param: "semesters")
      const semesterTag = tagResponse.data.find(tag => tag.param === 'semesters');
      if (!semesterTag || !semesterTag.children) {
        throw new Error('Semester information not found in tag list');
      }

      // Convert semester children to SemesterOption format
      const semesters: SemesterOption[] = semesterTag.children.map(child => {
        const { schoolYear, semester, labelEn } = ApiClient.parseSemesterName(child.name);

        return {
          id: child.id,
          label: child.name,
          labelEn: labelEn,
          schoolYear: schoolYear,
          semester: semester
        };
      });

      // Sort by sort field (descending) to show most recent first
      semesters.sort((a, b) => {
        const aChild = semesterTag.children?.find(c => c.id === a.id);
        const bChild = semesterTag.children?.find(c => c.id === b.id);
        return (bChild?.sort || 0) - (aChild?.sort || 0);
      });

      return semesters;
    } catch (error: unknown) {
      console.error('Failed to get available semesters:', error);

      // Fallback to hardcoded list if API fails
      console.warn('Falling back to hardcoded semester list');
      return this.getFallbackSemesters();
    }
  }

  // Fallback hardcoded semester list
  private getFallbackSemesters(): SemesterOption[] {
    return [
      {
        id: 100,
        label: `2025-2026 第一学期`,
        labelEn: `2025 Fall`,
        schoolYear: 2025,
        semester: 1
      },
      {
        id: 96,
        label: `2024-2025 第二学期`,
        labelEn: `2025 Spring`,
        schoolYear: 2024,
        semester: 2
      },
      {
        id: 95,
        label: `2024-2025 第一学期`,
        labelEn: `2024 Fall`,
        schoolYear: 2024,
        semester: 1
      },
      {
        id: 94,
        label: `2023-2024 第二学期`,
        labelEn: `2024 Spring`,
        schoolYear: 2023,
        semester: 2
      },
      {
        id: 92,
        label: `2023-2024 第一学期`,
        labelEn: `2023 Fall`,
        schoolYear: 2023,
        semester: 1
      }
    ];
  }

  async getTagList(): Promise<TagListResponse> {
    try {
      const url = "https://cbiz.yanhekt.cn/v1/tag/list?with_sub=true";
      const { headers } = this.createHeaders(''); // No token needed for tag list

      // Remove Authorization header since it's not needed
      delete headers["Authorization"];

      const response = await axios.get(url, {
        headers,
        timeout: 10000,
        validateStatus: function (status) {
          return status < 500;
        }
      });

      return response.data;
    } catch (error: unknown) {
      console.error('Failed to get tag list:', error);
      throw error;
    }
  }

  async getVideoToken(token: string): Promise<string> {
    try {
      const url = "https://cbiz.yanhekt.cn/v1/auth/video/token?id=0";
      const response = await this.makeRequest('GET', url, token);
      const data = response as VideoTokenApiResponse;

      if (data.code !== 0 && data.code !== "0") {
        let errorMessage = data.message;
        switch (data.code) {
          case 13001001:
            errorMessage = "Authentication failed, please check if token is valid";
            break;
          default:
            errorMessage = `API error: ${data.message} (code: ${data.code})`;
        }
        throw new Error(errorMessage);
      }

      return data.data.token;
    } catch (error: unknown) {
      console.error('Failed to get video token:', error);
      throw error;
    }
  }
}

// Maintain backward compatibility
export const MainApiClient = ApiClient;