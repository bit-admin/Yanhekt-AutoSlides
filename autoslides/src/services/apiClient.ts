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
    const headers = { ...this.BASE_HEADERS };

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

      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
        console.log('Network error detected during token verification');
        return { valid: false, userData: null, networkError: true };
      }

      return { valid: false, userData: null, networkError: false };
    }
  }

  private async makeRequest(method: string, url: string, token: string, data: unknown = null): Promise<unknown> {
    try {
      const { headers } = this.createHeaders(token);

      const config: Record<string, unknown> = {
        method,
        url,
        headers,
        timeout: 10000,
        validateStatus: function (status) {
          return status < 500;
        }
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error(`API request error (${method} ${url}):`, error);
      throw error;
    }
  }

  async get(url: string, token: string): Promise<unknown> {
    return this.makeRequest('GET', url, token);
  }

  async post(url: string, token: string, data: unknown): Promise<unknown> {
    return this.makeRequest('POST', url, token, data);
  }
}