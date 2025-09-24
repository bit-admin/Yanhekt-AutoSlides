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

export class ApiClient {
  async verifyToken(token: string): Promise<TokenVerificationResult> {
    try {
      return await window.electronAPI.auth.verifyToken(token);
    } catch (error) {
      console.error('Token verification error:', error);
      return { valid: false, userData: null, networkError: false };
    }
  }

  async getPersonalLiveList(token: string, page: number = 1, pageSize: number = 16): Promise<LiveListResponse> {
    try {
      return await window.electronAPI.api.getPersonalLiveList(token, page, pageSize);
    } catch (error) {
      console.error('Failed to get personal live list:', error);
      throw error;
    }
  }

  async searchLiveList(token: string, keyword: string, page: number = 1, pageSize: number = 16): Promise<LiveListResponse> {
    try {
      return await window.electronAPI.api.searchLiveList(token, keyword, page, pageSize);
    } catch (error) {
      console.error('Failed to search live list:', error);
      throw error;
    }
  }
}