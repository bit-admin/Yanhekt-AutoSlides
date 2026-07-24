/**
 * The campus CAS sign-in flow, end to end.
 *
 * Happy path (unchanged in behaviour from the original single-shot login):
 *   GET  /cas/login?service=<yanhekt callback>   → page key + execution
 *   POST /cas/login                              → 302 with a service ticket
 *   GET  <ticket url>                            → 302 to the callback
 *   parse `?token=`                              → yanhekt bearer token
 *
 * When CAS wants a second factor it answers that POST with a 2FA page instead
 * of a 302. From there:
 *   POST /cas/api/protected/sms/getPhoneNumberByUserId  (sealed envelope)
 *   POST /cas/api/protected/sms/publicNoToken/sendSmsCode
 *   ── hand control back to the UI for the code ──
 *   POST /cas/api/protected/sms/checkToken
 *   POST <2FA form action>  type=smsLogin        → 302 with a ticket
 *   …then the same ticket → token tail as above.
 *
 * The pause in the middle is why this module is split into `startPasswordSignIn`
 * and `finishSecondFactor`: the first returns a live `SecondFactorHandle` that
 * the caller parks (see pendingVerifications.ts) until the user types the code.
 *
 * Nothing here logs codes, passwords, phone values, or cookies.
 */
import { CasTransport, type DurableCookie } from './casTransport';
import {
  parseCredentialPage,
  parsePageError,
  parseSecondFactorPage,
  hasSecondFactorMarker,
  type SecondFactorPage,
} from './casPage';
import { encryptFormValue, openSealedReply, sealJsonEnvelope } from './casPayloads';
import {
  classifyPageError,
  describeErrorSafely,
  isCodeStillValidNotice,
  isRecord,
  readApiCode,
  readApiData,
  readApiMessage,
  type SignInReason,
} from './casDiagnostics';
import { createLogger } from '@main/infra/logger';

const log = createLogger('CampusSso');

const CAS_ORIGIN = 'https://sso.bit.edu.cn';
const CAS_LOGIN_URL = `${CAS_ORIGIN}/cas/login`;
const PHONE_LOOKUP_URL = `${CAS_ORIGIN}/cas/api/protected/sms/getPhoneNumberByUserId`;
const SEND_CODE_URL = `${CAS_ORIGIN}/cas/api/protected/sms/publicNoToken/sendSmsCode`;
const CHECK_CODE_URL = `${CAS_ORIGIN}/cas/api/protected/sms/checkToken`;
const CAPTCHA_PROBE_URL = `${CAS_ORIGIN}/cas/api/protected/user/findCaptchaCount`;

/** Yanhekt's CAS service endpoint — the ticket is exchanged for a bearer token here. */
const SERVICE_URL = 'https://cbiz.yanhekt.cn/v1/cas/callback';

/**
 * The business code CAS files second-factor messages under. Server-side
 * classification; wrong values simply do not send.
 */
const SECOND_FACTOR_BUSINESS_NO = '0008';

/**
 * Desktop sessions always ask CAS to remember the device, so a user who has
 * completed one SMS challenge is less likely to be asked again. Only useful in
 * combination with the durable-cookie persistence in `configService`.
 */
const TRUST_THIS_DEVICE = true;

/** CAS seats a session with a hop or two before rendering the credential form. */
const MAX_PAGE_REDIRECTS = 3;

export class CasSignInError extends Error {
  constructor(
    message: string,
    readonly reason: SignInReason,
  ) {
    super(message);
    this.name = 'CasSignInError';
  }
}

/** A second factor in progress: everything needed to finish it later. */
export interface SecondFactorHandle {
  transport: CasTransport;
  page: SecondFactorPage;
  username: string;
  /** CAS's opaque phone handle. Not a phone number; never shown or logged. */
  phoneHandle: string;
  /** Masked number as CAS renders it, for display only. */
  phoneHint: string;
}

export type PasswordSignInOutcome =
  | { kind: 'token'; token: string; durableCookies: DurableCookie[] }
  | { kind: 'second_factor'; handle: SecondFactorHandle };

/**
 * Run the password half. Either finishes the whole sign-in, or stops at a
 * second-factor prompt with the SMS already sent.
 */
export async function startPasswordSignIn(
  username: string,
  password: string,
  seedCookies: readonly DurableCookie[] = [],
): Promise<PasswordSignInOutcome> {
  const transport = new CasTransport(`${CAS_ORIGIN}/`);
  // Any remembered-device cookies go in before the first hop, so CAS can
  // recognise the device while it is still deciding whether to demand SMS.
  transport.seedDurableCookies(seedCookies);

  const { url: pageUrl, html: pageHtml } = await loadCredentialPage(transport);

  const page = parseCredentialPage(pageHtml, pageUrl);
  if (!page) {
    throw new CasSignInError(
      'Failed to parse login page. If this persists, please sign in with browser.',
      'unsupported_page',
    );
  }
  transport.setReferer(pageUrl);

  // We cannot solve an image captcha in-app; detect it and say so plainly
  // rather than submitting a blank one and reporting a bogus password error.
  await assertNoCaptchaRequired(transport, username);

  const form = new URLSearchParams({
    username,
    password: encryptFormValue(page.pageKey, password),
    type: 'UsernamePassword',
    _eventId: 'submit',
    execution: page.execution,
    croypto: page.pageKey,
    geolocation: '',
    captcha_code: '',
  });

  const loginResponse = await transport.request(page.formAction, { method: 'POST', form });

  if (loginResponse.status === 401) {
    throw new CasSignInError('Incorrect username or password.', 'bad_credentials');
  }

  if (loginResponse.status === 302) {
    const token = await exchangeTicketForToken(transport, loginResponse.headers['location']);
    return { kind: 'token', token, durableCookies: transport.exportDurableCookies() };
  }

  const html = asText(loginResponse.data);
  const secondFactor = parseSecondFactorPage(html, page.formAction);

  if (secondFactor) {
    log.debug('Password accepted; CAS requires an SMS second factor');
    const handle = await beginSecondFactor(transport, username, secondFactor);
    return { kind: 'second_factor', handle };
  }

  // A 2FA-looking page we could not parse: better to point at the browser
  // fallback than to report it as a wrong password.
  if (hasSecondFactorMarker(html)) {
    throw new CasSignInError(
      'Verification required. Please sign in with browser.',
      'unsupported_page',
    );
  }

  const { message, code } = parsePageError(html);
  const failure = classifyPageError(message, code, {
    reason: 'unknown',
    message: 'Login failed. If this persists, please sign in with browser.',
  });
  throw new CasSignInError(failure.message, failure.reason);
}

/**
 * Finish a parked second factor with the code the user typed. On success the
 * durable cookies come back so the caller can persist the trusted device.
 */
export async function finishSecondFactor(
  handle: SecondFactorHandle,
  code: string,
): Promise<{ token: string; durableCookies: DurableCookie[] }> {
  const { transport, page, username, phoneHandle } = handle;

  const check = await postJson(transport, CHECK_CODE_URL, {
    phone: phoneHandle,
    token: code,
    delete: false,
    trustDevice: TRUST_THIS_DEVICE,
  });

  if (readApiCode(check) !== 200) {
    const message = readApiMessage(check);
    throw new CasSignInError(
      message || 'That verification code is incorrect or has expired.',
      'code_rejected',
    );
  }

  // CAS reuses the login form for the second step: same endpoint, but the code
  // travels in the `password` field under a different `type`.
  const form = new URLSearchParams({
    username,
    password: code,
    type: 'smsLogin',
    _eventId: 'submit',
    execution: page.execution,
    geolocation: '',
    captcha_code: '',
    trustDevice: String(TRUST_THIS_DEVICE),
  });

  const response = await transport.request(page.formAction, { method: 'POST', form });

  if (response.status !== 302) {
    const html = asText(response.data);
    const { message, code: errorCode } = parsePageError(html);
    const failure = classifyPageError(message, errorCode, {
      reason: 'code_rejected',
      message: 'That verification code was rejected. Please start over.',
    });
    throw new CasSignInError(failure.message, failure.reason);
  }

  const token = await exchangeTicketForToken(transport, response.headers['location']);
  return { token, durableCookies: transport.exportDurableCookies() };
}

/**
 * Fetch the credential page, following the redirects CAS uses to seat a session
 * before it will render the form. Redirects are manual everywhere in this flow,
 * so they are walked explicitly here — and the URL we end on matters, because
 * the form's `action` resolves relative to it.
 */
async function loadCredentialPage(
  transport: CasTransport,
): Promise<{ url: string; html: string }> {
  let url = `${CAS_LOGIN_URL}?service=${encodeURIComponent(SERVICE_URL)}`;

  for (let hop = 0; hop <= MAX_PAGE_REDIRECTS; hop++) {
    const response = await transport.request(url);
    if (response.status < 300 || response.status >= 400) {
      return { url, html: asText(response.data) };
    }
    const location = response.headers['location'];
    if (typeof location !== 'string' || !location) {
      return { url, html: asText(response.data) };
    }
    url = new URL(location, url).toString();
  }

  throw new CasSignInError(
    'The sign-in page kept redirecting. Please sign in with browser.',
    'unsupported_page',
  );
}

/** Resolve the bound phone, then ask CAS to text a code to it. */
async function beginSecondFactor(
  transport: CasTransport,
  username: string,
  page: SecondFactorPage,
): Promise<SecondFactorHandle> {
  // The protected SMS APIs are called from the CAS app root, not from the form
  // URL — CAS cross-checks the referer, so match what the page itself sends.
  transport.setReferer(`${CAS_ORIGIN}/cas/`);

  const phone = await lookupBoundPhone(transport, page.userObjectId);
  const phoneHandle = phone.handle || page.displayPhone;
  if (!phoneHandle) {
    throw new CasSignInError(
      'The verification page did not identify a phone number to text. Please sign in with browser.',
      'unsupported_page',
    );
  }

  const send = await postJson(transport, SEND_CODE_URL, {
    phone: phoneHandle,
    businessNo: SECOND_FACTOR_BUSINESS_NO,
  });

  const sendMessage = readApiMessage(send);
  // A resend inside the validity window is reported as a failure but means the
  // previous code is still usable, so let the user enter it.
  if (readApiCode(send) !== 200 && !isCodeStillValidNotice(sendMessage)) {
    throw new CasSignInError(
      sendMessage || 'Failed to send the verification code. Please try again.',
      'sms_send_failed',
    );
  }

  return { transport, page, username, phoneHandle, phoneHint: phone.masked };
}

/**
 * Ask for the phone bound to this account. Request body and response are both
 * encrypted under a one-shot AES key that travels RSA-wrapped in a header.
 */
async function lookupBoundPhone(
  transport: CasTransport,
  userObjectId: string,
): Promise<{ handle: string; masked: string }> {
  const envelope = sealJsonEnvelope({ userId: userObjectId });

  const response = await transport.request(PHONE_LOOKUP_URL, {
    method: 'POST',
    raw: envelope.body,
    headers: {
      'Content-Type': 'application/json',
      hasCrypto: 'true',
      privateKey: envelope.keyHeader,
    },
  });

  const body = asText(response.data);
  if (!body) {
    throw new CasSignInError(
      'The verification service returned an empty response. Please sign in with browser.',
      'unsupported_page',
    );
  }

  const opened = openSealedReply(body, envelope.sessionKey);
  const data = readApiData(opened) ?? (isRecord(opened) ? opened : null);

  return {
    handle: readString(data, 'tel'),
    masked: readString(data, 'maskTel'),
  };
}

/**
 * Probe whether CAS wants an image captcha for this account. We never solve
 * one — the point is to fail with an accurate reason instead of submitting an
 * empty `captcha_code` and getting back a generic rejection.
 */
async function assertNoCaptchaRequired(transport: CasTransport, username: string): Promise<void> {
  let payload: unknown;
  try {
    const response = await transport.request(
      `${CAPTCHA_PROBE_URL}/${encodeURIComponent(username)}`,
      { cacheBust: true },
    );
    payload = tryParseJson(asText(response.data));
  } catch (error) {
    // The probe is advisory. If it fails, carry on and let the real POST decide.
    log.debug('Captcha probe failed, continuing:', describeErrorSafely(error));
    return;
  }

  if (readApiData(payload)?.captchaInvisible) {
    throw new CasSignInError(
      'This account needs an image captcha. Please sign in with browser.',
      'captcha_required',
    );
  }
}

/**
 * Follow the ticket redirect into the yanhekt callback and read the bearer
 * token off the final `Location`.
 */
async function exchangeTicketForToken(
  transport: CasTransport,
  ticketLocation: unknown,
): Promise<string> {
  if (typeof ticketLocation !== 'string' || !ticketLocation) {
    throw new CasSignInError(
      'Sign-in succeeded but the redirect was missing. Please sign in with browser.',
      'unknown',
    );
  }

  const ticketUrl = new URL(ticketLocation, CAS_LOGIN_URL).toString();
  const response = await transport.request(ticketUrl);

  if (response.status !== 302) {
    throw new CasSignInError(
      'Ticket verification failed. Please sign in with browser.',
      'unknown',
    );
  }

  const location = response.headers['location'];
  if (typeof location !== 'string' || !location) {
    throw new CasSignInError(
      'Ticket verification succeeded but the redirect was missing. Please sign in with browser.',
      'unknown',
    );
  }

  const token = new URL(location, ticketUrl).searchParams.get('token');
  if (!token) {
    throw new CasSignInError(
      'Failed to extract token. Please sign in with browser.',
      'unknown',
    );
  }

  return token;
}

async function postJson(
  transport: CasTransport,
  url: string,
  json: unknown,
): Promise<unknown> {
  const response = await transport.request(url, { method: 'POST', json });
  return tryParseJson(asText(response.data));
}

function asText(data: unknown): string {
  return typeof data === 'string' ? data : '';
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function readString(record: Record<string, unknown> | null, key: string): string {
  const value = record?.[key];
  return typeof value === 'string' ? value : '';
}
