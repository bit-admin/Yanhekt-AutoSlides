/**
 * Yanhe 2.0 (aita.yanhekt.cn) sessions, main-process side.
 *
 * Every path that produces a token — the combined cbiz+Yanhe 2.0 SSO sign-in,
 * the Yanhe 2.0-only SSO sign-in, the browser sign-in, and a pasted cookie —
 * ends in `adopt`, which checks the token against `infosimple` and stores it
 * with the three profile fields media signing will need.
 *
 * The JWT is not part of `AppConfig` (it carries the real name and a password
 * hash). The renderer learns the outcome from the returned result and from
 * `yanhe2SessionExpiry`, and reads the JWT back only for the Settings field
 * (`getJwt`). Callers broadcast config after a change.
 */
import { session } from 'electron';
import type { Yanhe2SessionState, Yanhe2SignInResult } from '@common/yanhe2';
import type { ConfigService } from '../configService';
import { fetchYanhe2Profile } from './yanhe2Api';
import { decodeYanhe2Claims, extractYanhe2Jwt } from './yanhe2Token';
import { createLogger } from '@main/infra/logger';

const log = createLogger('Yanhe2');

/** The browser sign-in webview's partition, shared with the main account's. */
const BROWSER_PARTITION = 'persist:browserlogin';

export class Yanhe2Service {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Check a JWT and store it under its own `account`. With `expectedAccount`,
   * a token for any other student id is refused — a Yanhe 2.0 session is only
   * ever attached to the AutoSlides account of the same person.
   */
  async adopt(jwt: string, expectedAccount: string | null): Promise<Yanhe2SignInResult> {
    const claims = decodeYanhe2Claims(jwt);
    if (!claims) {
      return { success: false, reason: 'no_token', error: 'That does not contain a Yanhe 2.0 token.' };
    }
    const expiresAt = claims.exp * 1000;
    if (expiresAt <= Date.now()) {
      return { success: false, reason: 'expired', error: 'That Yanhe 2.0 token has expired.' };
    }
    if (expectedAccount !== null && claims.account !== expectedAccount) {
      return {
        success: false,
        reason: 'account_mismatch',
        error: 'That Yanhe 2.0 account belongs to a different student id.',
      };
    }

    const checked = await fetchYanhe2Profile(jwt);
    if (checked.kind === 'network') {
      return { success: false, reason: 'network', error: 'Could not reach Yanhe 2.0.' };
    }
    if (checked.kind === 'rejected') {
      return { success: false, reason: 'token_rejected', error: 'Yanhe 2.0 did not accept that token.' };
    }

    this.configService.setYanhe2Session(claims.account, {
      jwt,
      expiresAt,
      userId: checked.profile.userId,
      tenantId: checked.profile.tenantId,
      playSigningPhone: checked.profile.playSigningPhone,
    });
    log.debug('Yanhe 2.0 session stored');
    return { success: true, account: claims.account, expiresAt };
  }

  /**
   * Re-check a stored session with `infosimple`. A rejected token becomes the
   * expired marker; a network failure keeps it, like the main token check.
   */
  async check(account: string): Promise<Yanhe2SessionState> {
    const stored = this.configService.getYanhe2Session(account);
    if (!stored) return 'none';
    if (!stored.jwt) return 'expired';

    const checked = await fetchYanhe2Profile(stored.jwt);
    if (checked.kind === 'network') return 'network';
    if (checked.kind === 'rejected') {
      this.configService.expireYanhe2Session(account);
      return 'expired';
    }
    const { userId, tenantId, playSigningPhone } = checked.profile;
    if (
      userId !== stored.userId
      || tenantId !== stored.tenantId
      || playSigningPhone !== stored.playSigningPhone
    ) {
      this.configService.setYanhe2Session(account, { ...stored, userId, tenantId, playSigningPhone });
    }
    return 'signed_in';
  }

  /** Local only: aita has no revocation, and its logout would also end the browser's CAS session. */
  signOut(account: string): void {
    this.configService.clearYanhe2Session(account);
  }

  /**
   * The stored JWT, for the Settings field only. Empty when this account has no
   * session. Not part of AppConfig: a broadcast would hand the real name and
   * password hash to every window on every settings change.
   */
  getJwt(account: string): string {
    return this.configService.getYanhe2Session(account)?.jwt ?? '';
  }

  /** `userId` and the play-signing phone, for the signed-in menu. Null without a live session. */
  getProfile(account: string): { userId: number; playSigningPhone: string } | null {
    const stored = this.configService.getYanhe2Session(account);
    if (!stored?.jwt || !stored.userId) return null;
    return { userId: stored.userId, playSigningPhone: stored.playSigningPhone };
  }

  /** Settings' paste field: a bare JWT, the `_token` cookie, or a whole Cookie header. */
  async adoptPasted(text: string, expectedAccount: string): Promise<Yanhe2SignInResult> {
    const jwt = extractYanhe2Jwt(text.trim());
    if (!jwt) {
      return { success: false, reason: 'no_token', error: 'That does not contain a Yanhe 2.0 token.' };
    }
    return this.adopt(jwt, expectedAccount);
  }

  /**
   * Called before the browser sign-in opens on Yanhe 2.0: drop any `_token`
   * left in the partition, so the next one found is from this sign-in.
   */
  async prepareBrowserSignIn(): Promise<void> {
    const ses = session.fromPartition(BROWSER_PARTITION);
    for (const cookie of await this.browserTokenCookies()) {
      const domain = (cookie.domain ?? '').replace(/^\./, '');
      await ses.cookies.remove(`https://${domain}${cookie.path || '/'}`, cookie.name);
    }
  }

  /** Poll target for the browser sign-in. `pending` until the partition holds a `_token`. */
  async adoptBrowserSession(expectedAccount: string): Promise<Yanhe2SignInResult> {
    for (const cookie of await this.browserTokenCookies()) {
      const jwt = extractYanhe2Jwt(`_token=${cookie.value}`);
      if (jwt) return this.adopt(jwt, expectedAccount);
    }
    return { success: false, reason: 'pending' };
  }

  private async browserTokenCookies(): Promise<Electron.Cookie[]> {
    const cookies = await session.fromPartition(BROWSER_PARTITION).cookies.get({ name: '_token' });
    return cookies.filter((cookie) => {
      const domain = (cookie.domain ?? '').replace(/^\./, '');
      return domain === 'yanhekt.cn' || domain.endsWith('.yanhekt.cn');
    });
  }
}
