/**
 * Developer → SSO: runs the campus CAS sign-in one step at a time and shows
 * every request. Main drives the real flow and redacts before anything crosses
 * the bridge, unless the developer turns on raw values (`reveal`); nothing the
 * lab produces is stored either way.
 */

export type DevSsoStepId =
  | 'discover_service'
  | 'load_login_page'
  | 'captcha_probe'
  | 'submit_password'
  | 'lookup_phone'
  | 'send_sms'
  | 'check_code'
  | 'submit_code'
  | 'exchange_ticket'
  | 'mint_yanhe2';

/** `yanhekt` = cbiz; `both` = cbiz, then Yanhe 2.0 on the same CAS session; `yanhe2` = Yanhe 2.0 only. */
export type DevSsoTarget = 'yanhekt' | 'both' | 'yanhe2';

export type DevSsoStatus =
  | 'idle'
  | 'running'
  | 'paused'
  /** Stopped before the SMS goes out; it never goes out on its own. */
  | 'awaiting_sms_send'
  | 'awaiting_code'
  | 'succeeded'
  | 'failed'
  | 'stopped';

export interface DevSsoStartRequest {
  username: string;
  password: string;
  target: DevSsoTarget;
  /** Seed the trusted-device cookies this computer has stored (read only). */
  useTrustedDevice: boolean;
  /** Pause before every step, starting with the first. */
  stepMode: boolean;
}

export type DevSsoControl = 'pause' | 'resume' | 'step' | 'stop';

export interface DevSsoExchange {
  id: number;
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody: string;
  requestBodyKind: 'form' | 'json' | 'raw' | null;
  status: number | null;
  statusText: string;
  responseHeaders: Record<string, string>;
  responseBody: string;
  /** Length of the whole body when `responseBody` was cut. */
  responseBodyTruncatedFrom: number | null;
  error: string | null;
  startedAt: number;
  durationMs: number;
}

export interface DevSsoStep {
  id: DevSsoStepId;
  state: 'waiting' | 'running' | 'done' | 'failed';
  /** When it was reached; a paused step stays `waiting`. */
  reachedAt: number;
  notes: Record<string, string>;
  exchanges: DevSsoExchange[];
}

export interface DevSsoSnapshot {
  runId: number;
  status: DevSsoStatus;
  /** Raw values: tokens, cookies, tickets and codes unmasked. Off until switched on. */
  reveal: boolean;
  stepMode: boolean;
  /** A pause is requested and takes effect before the next step. */
  pauseRequested: boolean;
  target: DevSsoTarget;
  startedAt: number | null;
  finishedAt: number | null;
  /** Trusted-device cookies seeded into this run. */
  seededCookies: number;
  /** Trusted-device cookies stored on this computer right now. */
  storedTrustedCookies: number;
  phoneHint: string;
  steps: DevSsoStep[];
  result: {
    yanhekt: string | null;
    yanhe2: string | null;
    durableCookies: Array<{ name: string; host: string; expiresAt: number; /** Only with `reveal`. */ value: string | null }>;
  } | null;
  error: { reason: string; message: string } | null;
}
