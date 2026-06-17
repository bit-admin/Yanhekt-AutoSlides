// Type definitions are available globally

import { overrides } from '../overrideRegistry'

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
    // Mirror to electron-store so add-ons windows can read it via IPC
    window.electronAPI?.config?.setAuthToken?.(token);
  }

  getToken(): string | null {
    // A registered override (demo mode) returns a sentinel token so the app
    // appears logged in without a real one in localStorage/electron-store.
    const sentinel = overrides.authToken?.();
    if (sentinel) return sentinel;
    return localStorage.getItem(this.TOKEN_KEY);
  }

  // Ensure electron-store mirror is up to date with localStorage.
  // Called once on main renderer init so add-ons windows see the token via IPC.
  syncToConfig(): void {
    const token = this.getToken();
    window.electronAPI?.config?.setAuthToken?.(token ?? null);
  }

  clearToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    window.electronAPI?.config?.setAuthToken?.(null);
  }

  hasToken(): boolean {
    return !!this.getToken();
  }
}

export const tokenManager = new TokenManager();