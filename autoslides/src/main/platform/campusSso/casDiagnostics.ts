/**
 * Turning CAS's numeric rejection codes into something the UI can act on.
 *
 * `reason` is the machine-readable half: the renderer localizes it and decides
 * whether to keep the OTP panel open for a retry. `message` is the
 * English fallback shown wherever there is no localized copy (error dialogs),
 * matching how the rest of main-process auth reports failures.
 */

export type SignInReason =
  | 'bad_credentials'
  | 'account_locked'
  | 'account_inactive'
  | 'account_dormant'
  | 'code_rejected'
  | 'captcha_required'
  | 'risk_rejected'
  | 'challenge_expired'
  | 'sms_send_failed'
  | 'unsupported_page'
  | 'network'
  | 'unknown';

interface CodedFailure {
  reason: SignInReason;
  message: string;
}

/**
 * Codes CAS returns in `#login-error-code`. Values are ours, not the server's
 * Chinese strings — `#login-error-msg` is preferred over these whenever the
 * page actually supplies one.
 */
const CODED_FAILURES: Record<string, CodedFailure> = {
  '1030027': { reason: 'bad_credentials', message: 'Incorrect username or password.' },
  '1030031': { reason: 'bad_credentials', message: 'Incorrect username or password.' },
  '1030028': {
    reason: 'account_locked',
    message: 'This account is locked. Please unlock it on the campus identity portal.',
  },
  '1320007': {
    reason: 'code_rejected',
    message: 'That verification code is incorrect or has expired.',
  },
  '1320010': {
    reason: 'captcha_required',
    message: 'An image captcha is required. Please sign in with browser.',
  },
  '1330001': {
    reason: 'risk_rejected',
    message: 'Sign-in was blocked by campus risk control. Please sign in with browser.',
  },
  '1410040': { reason: 'account_inactive', message: 'This account is not in a valid state.' },
  '1410041': { reason: 'account_inactive', message: 'This account is not in a valid state.' },
  '3910001': {
    reason: 'account_dormant',
    message: 'This account is dormant. Please activate it on the campus identity portal.',
  },
};

/**
 * Map a page's error text/code to a reason. When CAS supplies its own message
 * we surface that (it is localized for the user and more specific than
 * anything we could guess) but still classify by code so the UI behaves right.
 */
export function classifyPageError(
  message: string,
  code: string,
  fallback: CodedFailure,
): CodedFailure {
  let trimmedMessage = message.trim();
  let trimmedCode = code.trim();

  // Some responses put the code in the message slot and leave the code empty.
  if (!trimmedCode && /^\d+$/.test(trimmedMessage)) {
    trimmedCode = trimmedMessage;
    trimmedMessage = '';
  }

  const known = CODED_FAILURES[trimmedCode];
  if (known) {
    return { reason: known.reason, message: trimmedMessage || known.message };
  }
  if (trimmedMessage) {
    return { reason: fallback.reason, message: trimmedMessage };
  }
  return fallback;
}

/**
 * CAS answers a resend inside the validity window with an error-shaped body
 * that actually means "the code we already sent is still good". Treat it as
 * success rather than failing a login the user could have completed.
 */
export function isCodeStillValidNotice(message: string): boolean {
  return message.includes('验证码') && message.includes('有效期内') && message.includes('重复发送');
}

/** Pull a human-readable message out of one of CAS's JSON API envelopes. */
export function readApiMessage(payload: unknown): string {
  const keys = ['message', 'msg', 'errorMessage'] as const;
  const fromRecord = (record: Record<string, unknown>): string => {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value) return value;
    }
    return '';
  };

  if (!isRecord(payload)) return '';
  const direct = fromRecord(payload);
  if (direct) return direct;
  return isRecord(payload.data) ? fromRecord(payload.data) : '';
}

/** CAS uses `code: 200` inside the body, independent of the HTTP status. */
export function readApiCode(payload: unknown): number | null {
  if (!isRecord(payload)) return null;
  const code = payload.code;
  if (typeof code === 'number') return code;
  if (typeof code === 'string' && /^\d+$/.test(code)) return Number(code);
  return null;
}

export function readApiData(payload: unknown): Record<string, unknown> | null {
  if (!isRecord(payload)) return null;
  return isRecord(payload.data) ? payload.data : null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * A one-line, log-safe description of a thrown error.
 *
 * Never log a transport error object directly: an axios error carries its
 * `config`, which for this flow means the request's `Cookie` header and its form
 * body — and that body holds the encrypted password, or the plaintext SMS code.
 * Only the pieces named here are safe to write out.
 */
export function describeErrorSafely(error: unknown): string {
  if (!isRecord(error)) return typeof error === 'string' ? error : 'unknown error';

  const parts: string[] = [];
  if (typeof error.code === 'string') parts.push(error.code);
  const status = isRecord(error.response) ? error.response.status : undefined;
  if (typeof status === 'number') parts.push(`HTTP ${status}`);
  if (typeof error.message === 'string' && error.message) parts.push(error.message);

  return parts.length > 0 ? parts.join(' — ') : 'unknown error';
}
