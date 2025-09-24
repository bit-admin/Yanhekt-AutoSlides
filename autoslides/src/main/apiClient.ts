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

export class MainApiClient {
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

  async getLiveList(token: string, page: number = 1, pageSize: number = 16, userRelationshipType: number = 0): Promise<LiveListResponse> {
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

  async getPersonalLiveList(token: string, page: number = 1, pageSize: number = 16): Promise<LiveListResponse> {
    return this.getLiveList(token, page, pageSize, 1);
  }

  async searchLiveList(token: string, keyword: string, page: number = 1, pageSize: number = 16): Promise<LiveListResponse> {
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
}