// Type definitions are available globally

import { overrides } from '../overrideRegistry'
import { createLogger } from '@shared/utils/logger';
const log = createLogger('ServicesAuth');

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
      log.error('Login error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}

export class TokenManager {
  // electron-store is the single source of truth for the auth token. This is a
  // renderer-local read accelerator hydrated once at startup (see hydrate()) so
  // getToken() can stay synchronous; writes update it and write through to the store.
  private cachedToken: string | null = null;

  saveToken(token: string): void {
    this.cachedToken = token;
    window.electronAPI?.config?.setAuthToken?.(token);
  }

  getToken(): string | null {
    // A registered override (demo mode) returns a sentinel token so the app
    // appears logged in without a real one in electron-store.
    const sentinel = overrides.authToken?.();
    if (sentinel) return sentinel;
    return this.cachedToken;
  }

  // Load the token from electron-store into the in-memory cache once at startup,
  // before app.mount. Performs a one-time migration off the legacy localStorage key.
  async hydrate(): Promise<void> {
    let token = await window.electronAPI.config.getAuthToken();
    const legacy = localStorage.getItem('yanhekt_token');
    if (legacy) {
      if (!token) {
        token = legacy;
        window.electronAPI?.config?.setAuthToken?.(legacy);
      }
      localStorage.removeItem('yanhekt_token');
    }
    this.cachedToken = token;
  }

  clearToken(): void {
    this.cachedToken = null;
    window.electronAPI?.config?.setAuthToken?.(null);
  }

  hasToken(): boolean {
    return !!this.getToken();
  }
}

export const tokenManager = new TokenManager();