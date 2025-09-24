import axios, { AxiosResponse } from 'axios';
import CryptoJS from 'crypto-js';

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
  private readonly MAGIC = "1138b69dfef641d9d7ba49137d2d4875";
  private readonly BASE_HEADERS = {
    "Origin": "https://www.yanhekt.cn",
    "Referer": "https://www.yanhekt.cn/",
    "xdomain-client": "web_user",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 Edg/107.0.1418.26",
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

      console.log('Verifying token with API...');

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
        console.log('Token verification successful');
        const userData: UserData = {
          badge: data.data?.badge || "",
          nickname: data.data?.nickname || "",
          gender: data.data?.gender || 3,
          phone: data.data?.phone || ""
        };
        return { valid: true, userData };
      } else {
        console.log('Token verification failed - invalid token, code:', data.code, 'message:', data.message);
        return { valid: false, userData: null };
      }
    } catch (error: unknown) {
      console.error('Token verification error:', error);

      const errorObj = error as { code?: string; message?: string };
      if (errorObj.code === 'ENOTFOUND' || errorObj.code === 'ECONNREFUSED' ||
        errorObj.code === 'ETIMEDOUT' || errorObj.message?.includes('timeout')) {
        console.log('Network error detected during token verification');
        return { valid: false, userData: null, networkError: true };
      }

      return { valid: false, userData: null, networkError: false };
    }
  }

  private async makeRequest(method: string, url: string, token: string, data?: any): Promise<any> {
    const { headers } = this.createHeaders(token);

    const config: any = {
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
      const data = await this.makeRequest('GET', url, token);

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
      const data = await this.makeRequest('GET', url, token);

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
      const data = await this.makeRequest('GET', url, token);

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
      const data = await this.makeRequest('GET', url, token);

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
      const courseData = await this.makeRequest('GET', courseApiUrl, token);

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
      const sessionData = await this.makeRequest('GET', sessionApiUrl, token);

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

      const formattedVideos = videoList.map((video: any) => {
        const realVideoId = video.videos && video.videos.length > 0 ? video.videos[0].id : null;
        const videoData = video.videos && video.videos.length > 0 ? video.videos[0] : null;
        const mainUrl = videoData ? videoData.main : null;
        const vgaUrl = videoData ? videoData.vga : null;

        return {
          session_id: video.id,
          video_id: realVideoId,
          title: video.title,
          duration: videoData ? parseInt(videoData.duration) : null,
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

  // Calculate semester ID based on school year and semester number
  static calculateSemesterId(schoolYear: number, semesterNumber: number): number {
    if (typeof schoolYear !== 'number' || semesterNumber < 1 || semesterNumber > 2) {
      throw new Error('Invalid school year or semester number');
    }
    return (schoolYear - 1977) * 2 + semesterNumber;
  }

  // Generate available semesters from 2020-2021 to current year
  static getAvailableSemesters(): SemesterOption[] {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // getMonth() returns 0-11

    // Determine current semester based on date
    // Fall semester: Aug 1 to Feb 1 (next year)
    // Spring semester: Feb 1 to Aug 1 (same year)
    let currentSchoolYear = currentYear;
    if (currentMonth >= 8 || (currentMonth <= 1)) {
      // Fall semester or early Spring semester
      if (currentMonth <= 1) {
        currentSchoolYear = currentYear - 1; // We're in Spring of school year that started last year
      }
    }

    const semesters: SemesterOption[] = [];

    // Start from 2020-2021 school year to current school year
    for (let year = 2020; year <= currentSchoolYear; year++) {
      // Fall semester (first semester)
      const firstSemesterId = this.calculateSemesterId(year, 1);
      semesters.push({
        id: firstSemesterId,
        label: `${year}-${year + 1} 第一学期`,
        labelEn: `${year} Fall`,
        schoolYear: year,
        semester: 1
      });

      // Spring semester (second semester)
      const secondSemesterId = this.calculateSemesterId(year, 2);
      semesters.push({
        id: secondSemesterId,
        label: `${year}-${year + 1} 第二学期`,
        labelEn: `${year + 1} Spring`,
        schoolYear: year,
        semester: 2
      });
    }

    return semesters.reverse(); // Show most recent semesters first
  }

  async getVideoToken(token: string): Promise<string> {
    try {
      const url = "https://cbiz.yanhekt.cn/v1/auth/video/token";
      const data = await this.makeRequest('GET', url, token);

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