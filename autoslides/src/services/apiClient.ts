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
  async verifyToken(token: string): Promise<TokenVerificationResult> {
    try {
      return await window.electronAPI.auth.verifyToken(token);
    } catch (error) {
      console.error('Token verification error:', error);
      return { valid: false, userData: null, networkError: false };
    }
  }
}