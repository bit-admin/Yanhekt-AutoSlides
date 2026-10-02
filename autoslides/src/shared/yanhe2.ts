/**
 * Yanhe 2.0 (aita.yanhekt.cn) — the shapes both processes agree on.
 *
 * "Yanhe 2.0" is the UI name; the host is aita.yanhekt.cn. Its session is a
 * 24-hour HS256 JWT that carries the student's real name and a password hash,
 * so the token itself never leaves the main process. The renderer sees only
 * which accounts are signed in and until when (`AppConfig.yanhe2SessionExpiry`),
 * plus the results below.
 */

export const YANHE2_ORIGIN = 'https://aita.yanhekt.cn';
export const YANHE2_TENANT_ID = 21;

/** Any aita page works as the casapi `forward`; this is what the SPA uses. */
export const YANHE2_LANDING_URL = `${YANHE2_ORIGIN}/course`;

const FORWARD = encodeURIComponent(YANHE2_LANDING_URL);

/** casapi hop 1: seats PHPSESSID, then 302s to the yjlogin "choose BIT" page. */
export const YANHE2_CASAPI_ENTRY_URL =
  `${YANHE2_ORIGIN}/casapi/index.php?r=auth/login&auType=&tenant_code=${YANHE2_TENANT_ID}&forward=${FORWARD}`;

/** casapi hop 2: what yjlogin opens once BIT is chosen. 302s to campus CAS. */
export const YANHE2_CASAPI_CAS_URL =
  `${YANHE2_ORIGIN}/casapi/index.php?forward=${FORWARD}&r=auth/login&auType=cas&tenant_code=${YANHE2_TENANT_ID}`;

/** Why a Yanhe 2.0 sign-in or check did not produce a session. */
export type Yanhe2FailureReason =
  /** The token belongs to a different student id than the signed-in account. */
  | 'account_mismatch'
  /** Nothing that looks like a Yanhe 2.0 token was found in the input. */
  | 'no_token'
  /** The token has passed its `exp`. */
  | 'expired'
  /** Yanhe 2.0 answered 403 to `infosimple`. */
  | 'token_rejected'
  /** The browser sign-in has not produced a token yet. Not an error. */
  | 'pending'
  /** Auto sign-in is off, or there is no saved password for the account. */
  | 'auto_sign_in_unavailable';

/**
 * Same three-outcome contract as the main account's `auth:login`: signed in,
 * failed (+`reason`), or an SMS challenge to answer with `submitSmsCode`.
 * `reason` is either a Yanhe 2.0 reason or a campus SSO `SignInReason`.
 */
export interface Yanhe2SignInResult {
  success: boolean;
  /** Student id the session was stored under. */
  account?: string;
  /** Epoch ms. */
  expiresAt?: number;
  reason?: Yanhe2FailureReason | string;
  /** English fallback; the renderer localizes by `reason` where it can. */
  error?: string;
  smsChallenge?: { challengeId: string; phoneHint: string; expiresInSeconds: number };
}

/** Result of re-checking a stored session against `infosimple`. */
export type Yanhe2SessionState =
  /** No session stored for that account (never signed in, or signed out). */
  | 'none'
  | 'signed_in'
  /** Stored but past `exp`, or rejected by the server. Kept as an auto sign-in marker. */
  | 'expired'
  /** Could not reach Yanhe 2.0. The session is kept as-is. */
  | 'network';
