/**
 * Campus SSO sign-in, main-process side.
 *
 * The CAS protocol itself lives in ./campusSso; this class is the seam the IPC
 * layer talks to. Its job is to own the three-outcome contract — signed in,
 * failed, or "needs an SMS code" — and to persist the remembered-device cookies
 * that let a second factor be skipped next time.
 */
import type { ConfigService, StoredSsoCookie } from './configService';
import { CasSignInError, finishSecondFactor, startPasswordSignIn } from './campusSso/casFlow';
import {
  abandonChallenge,
  claimChallenge,
  parkChallenge,
} from './campusSso/pendingVerifications';
import { describeErrorSafely, type SignInReason } from './campusSso/casDiagnostics';
import { createLogger } from '@main/infra/logger';

const log = createLogger('PlatformAuth');

export type { SignInReason };

/** The SMS prompt the renderer needs to render, minus anything sensitive. */
export interface SmsChallenge {
  /** Opaque handle for the parked flow. The flow itself never leaves main. */
  challengeId: string;
  /** Masked number exactly as CAS renders it, or '' if it did not supply one. */
  phoneHint: string;
  expiresInSeconds: number;
}

export interface LoginResult {
  success: boolean;
  token?: string;
  error?: string;
  /** Machine-readable failure class, so the UI can localize and decide on retry. */
  reason?: SignInReason;
  /** Set instead of `token`/`error` when CAS demands a second factor. */
  smsChallenge?: SmsChallenge;
}

export class MainAuthService {
  constructor(private readonly configService?: ConfigService) {}

  /**
   * Password sign-in. Resolves with a token, a failure, or an SMS challenge to
   * be completed via `submitSmsCode`.
   */
  async loginAndGetToken(username: string, password: string): Promise<LoginResult> {
    try {
      const outcome = await startPasswordSignIn(
        username,
        password,
        this.configService?.getSsoDeviceCookies() ?? [],
      );

      if (outcome.kind === 'token') {
        this.rememberDevice(outcome.durableCookies);
        log.debug('Password sign-in completed without a second factor');
        return { success: true, token: outcome.token };
      }

      const ticket = parkChallenge(outcome.handle);
      return { success: false, smsChallenge: ticket };
    } catch (error) {
      return this.toFailure(error);
    }
  }

  /** Finish a parked second factor with the code the user entered. */
  async submitSmsCode(challengeId: string, code: string): Promise<LoginResult> {
    const handle = claimChallenge(challengeId);
    if (!handle) {
      return {
        success: false,
        reason: 'challenge_expired',
        error: 'This verification request has expired. Please sign in again.',
      };
    }

    try {
      const { token, durableCookies } = await finishSecondFactor(handle, code);
      this.rememberDevice(durableCookies);
      log.debug('Second factor completed');
      return { success: true, token };
    } catch (error) {
      return this.toFailure(error);
    }
  }

  /** Discard a challenge the user backed out of. */
  cancelSmsChallenge(challengeId: string): void {
    abandonChallenge(challengeId);
  }

  /**
   * Persist the cookies CAS marked long-lived. Absent a `trustDevice` cookie
   * this is a no-op write of an empty list, so behaviour is unchanged from
   * before this existed.
   */
  private rememberDevice(cookies: readonly StoredSsoCookie[]): void {
    if (!this.configService || cookies.length === 0) return;
    try {
      this.configService.setSsoDeviceCookies([...cookies]);
    } catch (error) {
      // Never let a persistence hiccup fail an otherwise-successful sign-in.
      log.warn('Could not persist trusted-device state:', describeErrorSafely(error));
    }
  }

  private toFailure(error: unknown): LoginResult {
    if (error instanceof CasSignInError) {
      log.debug('Sign-in rejected:', error.reason);
      return { success: false, error: error.message, reason: error.reason };
    }

    // Summarized, never dumped — a transport error carries the request config,
    // and that means cookies and the credential form body.
    log.error('Sign-in error:', describeErrorSafely(error));
    return {
      success: false,
      reason: 'network',
      error:
        error instanceof Error
          ? error.message
          : 'Network error or server exception. If this persists, please sign in with browser.',
    };
  }
}
