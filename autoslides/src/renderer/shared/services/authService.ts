// Type definitions are available globally

import { overrides } from '../overrideRegistry'
import { invalidateAll } from './requestCache'
import { createLogger } from '@shared/utils/logger';
const log = createLogger('ServicesAuth');

// The bridge's AuthResponse is only reachable through the Window declaration
// (vite-env.d.ts is a module, so its interfaces are not ambient). Deriving the
// type from the call keeps this in sync with the preload contract for free.
export type LoginResult = Awaited<ReturnType<ElectronAuthApi['login']>>;
type ElectronAuthApi = NonNullable<Window['electronAPI']>['auth'];

export class AuthService {
  private tokenManager: TokenManager;

  constructor(tokenManager: TokenManager) {
    this.tokenManager = tokenManager;
  }

  async loginAndGetToken(username: string, password: string): Promise<LoginResult> {
    return this.capture(() => window.electronAPI.auth.login(username, password));
  }

  /**
   * Answer an SMS second factor. Same result contract as a password login, so
   * callers can funnel both through one success path.
   */
  async submitSmsCode(challengeId: string, code: string): Promise<LoginResult> {
    return this.capture(() => window.electronAPI.auth.submitSmsCode(challengeId, code));
  }

  /** Release a parked challenge in main so it is not left waiting for a code. */
  async cancelSmsChallenge(challengeId: string): Promise<void> {
    try {
      await window.electronAPI.auth.cancelSmsChallenge(challengeId);
    } catch (error) {
      // Nothing to recover: the challenge times out on its own regardless.
      log.debug('Could not cancel SMS challenge:', error);
    }
  }

  private async capture(run: () => Promise<LoginResult>): Promise<LoginResult> {
    try {
      const result = await run();
      if (result.success && result.token) {
        this.tokenManager.saveToken(result.token);
      }
      return result;
    } catch (error) {
      log.error('Login error:', error);
      return {
        success: false,
        reason: 'network',
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
    const previous = this.cachedToken;
    this.cachedToken = token;
    window.electronAPI?.config?.setAuthToken?.(token);
    // This app is multi-account: switchAccount lands here with a different
    // token but the same isLoggedIn. Cached reads are keyed by token, which
    // keeps entries apart, but clearing outright is the actual boundary — one
    // account must never be served another's personal lists.
    if (previous !== token) invalidateAll();
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
    invalidateAll();
  }

  hasToken(): boolean {
    return !!this.getToken();
  }
}

export const tokenManager = new TokenManager();