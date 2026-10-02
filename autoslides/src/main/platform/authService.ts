/**
 * Campus SSO sign-in, main-process side.
 *
 * The CAS protocol itself lives in ./campusSso; this class is the seam the IPC
 * layer talks to. Its job is to own the three-outcome contract — signed in,
 * failed, or "needs an SMS code" — and to persist the remembered-device cookies
 * that let a second factor be skipped next time.
 */
import type { ConfigService, StoredSsoCookie } from './configService';
import {
  CasSignInError,
  finishSecondFactor,
  startPasswordSignIn,
  type SignInOptions,
  type SignInTokens,
} from './campusSso/casFlow';
import {
  abandonChallenge,
  claimChallenge,
  parkChallenge,
} from './campusSso/pendingVerifications';
import { describeErrorSafely, type SignInReason } from './campusSso/casDiagnostics';
import { keepableDurableCookies } from './campusSso/casTransport';
import type { Yanhe2Service } from './yanhe2/yanhe2Service';
import { decryptPassword } from './passwordCipher';
import type { Yanhe2SignInResult } from '@common/yanhe2';
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

const EXPIRED_CHALLENGE = {
  success: false,
  reason: 'challenge_expired',
  error: 'This verification request has expired. Please sign in again.',
} as const;

export class MainAuthService {
  constructor(
    private readonly configService?: ConfigService,
    private readonly yanhe2Service?: Yanhe2Service,
  ) {
    this.pruneStoredDeviceCookies();
  }

  /**
   * Password sign-in. Resolves with a token, a failure, or an SMS challenge to
   * be completed via `submitSmsCode`. With Settings' "also sign in to Yanhe
   * 2.0" on, the same CAS session mints and stores a Yanhe 2.0 session too.
   */
  async loginAndGetToken(username: string, password: string): Promise<LoginResult> {
    try {
      const outcome = await this.startSignIn(username, password, {
        target: 'yanhekt',
        alsoYanhe2: !!this.yanhe2Service && (this.configService?.getYanhe2SignInWithMain() ?? false),
      });

      if (outcome.kind === 'signed_in') {
        log.debug('Password sign-in completed without a second factor');
        return await this.finishMainSignIn(outcome.tokens);
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
    if (!handle || handle.options.target !== 'yanhekt') return { ...EXPIRED_CHALLENGE };

    try {
      const { tokens, durableCookies } = await finishSecondFactor(handle, code);
      this.rememberDevice(durableCookies);
      log.debug('Second factor completed');
      return await this.finishMainSignIn(tokens);
    } catch (error) {
      return this.toFailure(error);
    }
  }

  /**
   * Yanhe 2.0-only sign-in for an account already signed in to the app. The
   * session is stored only if CAS signed in the same student id.
   */
  async yanhe2Login(expectedAccount: string, username: string, password: string): Promise<Yanhe2SignInResult> {
    if (!this.yanhe2Service) return { success: false, reason: 'unknown' };
    try {
      const outcome = await this.startSignIn(username, password, { target: 'yanhe2' });
      if (outcome.kind === 'signed_in') return await this.adoptYanhe2(outcome.tokens, expectedAccount);
      return { success: false, smsChallenge: parkChallenge(outcome.handle) };
    } catch (error) {
      return this.toFailure(error);
    }
  }

  async yanhe2SubmitSmsCode(expectedAccount: string, challengeId: string, code: string): Promise<Yanhe2SignInResult> {
    const handle = claimChallenge(challengeId);
    if (!handle || handle.options.target !== 'yanhe2') return { ...EXPIRED_CHALLENGE };
    try {
      const { tokens, durableCookies } = await finishSecondFactor(handle, code);
      this.rememberDevice(durableCookies);
      return await this.adoptYanhe2(tokens, expectedAccount);
    } catch (error) {
      return this.toFailure(error);
    }
  }

  /**
   * Renew an expired Yanhe 2.0 session with the account's saved campus
   * password, under the same switches as the main account's Auto Sign In.
   * May still come back with an SMS challenge; the renderer decides whether to
   * show it.
   */
  async yanhe2AutoSignIn(account: string): Promise<Yanhe2SignInResult> {
    const unavailable = { success: false, reason: 'auto_sign_in_unavailable' } as const;
    const config = this.configService;
    if (!config || !config.getAutoSignIn() || !config.getRememberPassword()) return unavailable;
    const row = config.getSavedLogins().find((candidate) => candidate.badge === account);
    if (!row) return unavailable;
    const decrypted = decryptPassword(row.passwordEnc);
    if (!decrypted.ok || !row.username || !decrypted.value) return unavailable;
    log.debug('Yanhe 2.0 session expired; signing in with the saved password');
    return this.yanhe2Login(account, row.username, decrypted.value);
  }

  private async startSignIn(username: string, password: string, options: SignInOptions) {
    const outcome = await startPasswordSignIn(
      username,
      password,
      this.configService?.getSsoDeviceCookies() ?? [],
      options,
    );
    if (outcome.kind === 'signed_in') this.rememberDevice(outcome.durableCookies);
    return outcome;
  }

  /** cbiz token is the result; a Yanhe 2.0 token alongside it is stored on a best-effort basis. */
  private async finishMainSignIn(tokens: SignInTokens): Promise<LoginResult> {
    if (!tokens.yanhekt) {
      return { success: false, reason: 'unknown', error: 'Failed to extract token. Please sign in with browser.' };
    }
    if (tokens.yanhe2 && this.yanhe2Service) {
      try {
        const adopted = await this.yanhe2Service.adopt(tokens.yanhe2, null);
        if (!adopted.success) log.warn('Signed in, but the Yanhe 2.0 session was not stored:', adopted.reason);
      } catch (error) {
        log.warn('Signed in, but the Yanhe 2.0 session was not stored:', describeErrorSafely(error));
      }
    }
    return { success: true, token: tokens.yanhekt };
  }

  private async adoptYanhe2(tokens: SignInTokens, expectedAccount: string): Promise<Yanhe2SignInResult> {
    if (!tokens.yanhe2 || !this.yanhe2Service) {
      return { success: false, reason: 'no_token', error: 'Yanhe 2.0 did not issue a session.' };
    }
    return this.yanhe2Service.adopt(tokens.yanhe2, expectedAccount);
  }

  /** Discard a challenge the user backed out of. */
  cancelSmsChallenge(challengeId: string): void {
    abandonChallenge(challengeId);
  }

  /**
   * Replace the remembered-device cookies with what this sign-in produced.
   * Always a replace, even with an empty list: a successful sign-in is the
   * authoritative answer to "what should be replayed next time", and skipping
   * the empty write would leave whatever an older build persisted in place.
   */
  private rememberDevice(cookies: readonly StoredSsoCookie[]): void {
    if (!this.configService) return;
    try {
      this.configService.setSsoDeviceCookies([...cookies]);
    } catch (error) {
      // Never let a persistence hiccup fail an otherwise-successful sign-in.
      log.warn('Could not persist trusted-device state:', describeErrorSafely(error));
    }
  }

  /**
   * Older builds persisted every long-lived cookie the flow collected,
   * including the yanhekt callback's bearer token. Rewrite the stored bag
   * through the same filter the transport applies on seed, so those rows are
   * deleted at launch instead of waiting for a sign-in that may never come.
   */
  private pruneStoredDeviceCookies(): void {
    if (!this.configService) return;
    try {
      const stored = this.configService.getSsoDeviceCookies();
      // Written back unconditionally: `getSsoDeviceCookies` already drops
      // expired and malformed rows, so an unchanged count says nothing about
      // what is on disk. With nothing stored the setter skips the write.
      this.configService.setSsoDeviceCookies(keepableDurableCookies(stored));
    } catch (error) {
      log.warn('Could not prune trusted-device state:', describeErrorSafely(error));
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
