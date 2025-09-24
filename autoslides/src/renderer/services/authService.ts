/// <reference path="../../../src/vite-env.d.ts" />

export interface LoginResult {
  success: boolean;
  token?: string;
  error?: string;
}

export class AuthService {
  private tokenManager: TokenManager;

  constructor(tokenManager: TokenManager) {
    this.tokenManager = tokenManager;
  }

  async loginAndGetToken(username: string, password: string): Promise<LoginResult> {
    try {
      const result = await window.electronAPI.auth.login(username, password);

      if (result.success && result.token) {
        this.tokenManager.saveToken(result.token);
      }

      return result;
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}

export class TokenManager {
  private readonly TOKEN_KEY = 'yanhekt_token';

  saveToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  clearToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
  }

  hasToken(): boolean {
    return !!this.getToken();
  }
}