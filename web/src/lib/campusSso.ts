/**
 * Campus CAS sign-in against sso.bit.edu.cn, Workers edition.
 *
 * Ported from the desktop app's autoslides/src/main/platform/campusSso/, and
 * duplicated rather than shared for the same reason src/lib/yanhekt.ts is: the
 * two run on different runtimes (axios/Node vs fetch/workerd) and the protocol
 * details are what must stay identical, not the code.
 *
 * Password login either finishes outright or stops at an SMS second factor. In
 * a Worker there is no process to park the half-finished flow in, so
 * `startPasswordSignIn` returns everything needed to resume it and the caller
 * (routes/login.ts) seals that into a token the browser hands back — see
 * lib/resumeSeal.ts. `finishSecondFactor` then rebuilds a transport from it.
 *
 * Workers-fetch specifics vs the desktop original: redirects are manual
 * (`redirect: "manual"`), and multiple Set-Cookie headers need
 * `headers.getSetCookie()` — a plain `get("set-cookie")` folds them into one.
 *
 * Nothing here logs codes, passwords, phone values, or cookies.
 */
import { constants, publicEncrypt } from "node:crypto";
import CryptoJS from "crypto-js";

const CAS_ORIGIN = "https://sso.bit.edu.cn";
const CAS_LOGIN_URL = `${CAS_ORIGIN}/cas/login`;
const PHONE_LOOKUP_URL = `${CAS_ORIGIN}/cas/api/protected/sms/getPhoneNumberByUserId`;
const SEND_CODE_URL = `${CAS_ORIGIN}/cas/api/protected/sms/publicNoToken/sendSmsCode`;
const CHECK_CODE_URL = `${CAS_ORIGIN}/cas/api/protected/sms/checkToken`;
const CAPTCHA_PROBE_URL = `${CAS_ORIGIN}/cas/api/protected/user/findCaptchaCount`;

/** Yanhekt's CAS service endpoint — the ticket becomes a bearer token here. */
const SERVICE_URL = "https://cbiz.yanhekt.cn/v1/cas/callback";

/** Server-side classification for second-factor messages. */
const SECOND_FACTOR_BUSINESS_NO = "0008";

/** Ask CAS to remember the device, so a repeat sign-in may skip the SMS. */
const TRUST_THIS_DEVICE = true;

const MAX_PAGE_REDIRECTS = 3;

/**
 * CAS's public key for the phone-lookup envelope. A property of the server, so
 * it is reproduced verbatim; there is no way to discover it at runtime.
 */
const ENVELOPE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAjVr1zKwohU3xA0afprWLSQvIymaSH/V27MedFc+CecXSnORIFMAp4uEIb4taDq/2X4eMeTI66Mu/rB5GKSFDbExF2Gu4NaO/CNDpf1gHMScUrIFCh4CDqzBnx17kclvezLkIK0T8FVa4cRsINvzjbnA6jUSMaf6Fm1n9wTAtW6QYBjssGOEtCj+c38PTBdFMmJbXp3brt1tEBesz6lb3Fjp76FGvDZ08xtYG8fxYPuiMwKU04eS+mcX/BunwgpU3zwekHYB+PWRIvq0lBry9Wms25sJE5T/RAv5fEuMLbBkfcZK3+7ivSZthTmPpr2Ap/ji70ZZ6u2jvR5VJq+LJHQIDAQAB
-----END PUBLIC KEY-----`;

/**
 * One browser identity for the whole attempt. CAS can bind a flow to the client
 * that started it, so every hop presents the same headers — and the resume bag
 * carries this forward so hop 2 matches hop 1 even on a different Worker
 * isolate.
 */
const CLIENT_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  "sec-ch-ua": '"Chromium";v="139", "Not(A:Brand";v="24", "Google Chrome";v="139"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"macOS"',
};

const GUARD_KEY_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const ECB_PKCS7 = { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 } as const;

export type SignInReason =
  | "bad_credentials"
  | "account_locked"
  | "account_inactive"
  | "account_dormant"
  | "code_rejected"
  | "captcha_required"
  | "risk_rejected"
  | "challenge_expired"
  | "sms_send_failed"
  | "unsupported_page"
  | "network"
  | "unknown";

export class CasSignInError extends Error {
  constructor(
    message: string,
    readonly reason: SignInReason,
  ) {
    super(message);
    this.name = "CasSignInError";
  }
}

/** A cookie worth remembering across sign-ins (CAS gave it an explicit lifetime). */
export interface DurableCookie {
  name: string;
  value: string;
  host: string;
  path: string;
  expiresAt: number;
}

/** Everything needed to resume a second factor on a later request. */
export interface SecondFactorContext {
  cookies: DurableCookie[];
  /** The 2FA page's webflow execution. */
  execution: string;
  /** Absolute URL to POST the smsLogin form to. */
  formAction: string;
  username: string;
  /** CAS's opaque phone handle. Not a phone number. */
  phoneHandle: string;
}

export type PasswordSignInOutcome =
  | { kind: "token"; token: string; durableCookies: DurableCookie[] }
  | {
      kind: "second_factor";
      context: SecondFactorContext;
      /** Masked number as CAS renders it, for display only. */
      phoneHint: string;
    };

// ---------------------------------------------------------------------------
// Cookie jar
// ---------------------------------------------------------------------------

interface JarEntry extends DurableCookie {
  /** Session cookies have no lifetime and are never persisted. */
  session: boolean;
}

class CookieJar {
  private readonly entries = new Map<string, JarEntry>();

  headerFor(url: string): string {
    const { hostname, pathname } = new URL(url);
    const now = Date.now();
    const parts: string[] = [];

    for (const [key, entry] of this.entries) {
      if (!entry.session && entry.expiresAt <= now) {
        this.entries.delete(key);
        continue;
      }
      if (hostname !== entry.host && !hostname.endsWith(`.${entry.host}`)) continue;
      if (!pathMatches(pathname, entry.path)) continue;
      parts.push(`${entry.name}=${entry.value}`);
    }

    return parts.join("; ");
  }

  absorb(response: Response, requestUrl: string): void {
    const requestHost = new URL(requestUrl).hostname;
    for (const line of response.headers.getSetCookie()) {
      const parsed = parseSetCookie(line, requestHost);
      // Key on host too: sso and the yanhekt callback must not share a slot.
      if (parsed) this.entries.set(`${parsed.host}|${parsed.name}`, parsed);
    }
  }

  /** Pre-load cookies from a previous attempt (or a resume bag). */
  seed(cookies: readonly DurableCookie[] | undefined, asSession = false): void {
    const now = Date.now();
    for (const cookie of cookies ?? []) {
      if (!cookie?.name || !cookie.host) continue;
      if (!asSession && cookie.expiresAt <= now) continue;
      this.entries.set(`${cookie.host}|${cookie.name}`, {
        name: cookie.name,
        value: cookie.value,
        host: cookie.host,
        path: cookie.path || "/",
        expiresAt: cookie.expiresAt,
        session: asSession,
      });
    }
  }

  /** Only cookies CAS gave a future lifetime — the trust-this-device material. */
  exportDurable(): DurableCookie[] {
    const now = Date.now();
    const out: DurableCookie[] = [];
    for (const entry of this.entries.values()) {
      if (entry.session || entry.expiresAt <= now) continue;
      out.push({
        name: entry.name,
        value: entry.value,
        host: entry.host,
        path: entry.path,
        expiresAt: entry.expiresAt,
      });
    }
    return out;
  }

  /**
   * Everything currently held, session cookies included. Used to carry a
   * mid-login flow across the request boundary; only ever leaves the Worker
   * sealed.
   */
  exportAll(): DurableCookie[] {
    const out: DurableCookie[] = [];
    for (const entry of this.entries.values()) {
      out.push({
        name: entry.name,
        value: entry.value,
        host: entry.host,
        path: entry.path,
        expiresAt: entry.session ? 0 : entry.expiresAt,
      });
    }
    return out;
  }
}

function pathMatches(requestPath: string, cookiePath: string): boolean {
  if (cookiePath === "/" || requestPath === cookiePath) return true;
  return requestPath.startsWith(cookiePath.endsWith("/") ? cookiePath : `${cookiePath}/`);
}

function parseSetCookie(line: string, requestHost: string): JarEntry | null {
  const [pair, ...attributes] = line.split(";");
  const eq = pair.indexOf("=");
  if (eq <= 0) return null;

  const name = pair.slice(0, eq).trim();
  if (!name) return null;

  let host = requestHost;
  let path = "/";
  let expiresAt: number | null = null;
  let maxAge: number | null = null;

  for (const attribute of attributes) {
    const separator = attribute.indexOf("=");
    const key = (separator === -1 ? attribute : attribute.slice(0, separator)).trim().toLowerCase();
    const value = separator === -1 ? "" : attribute.slice(separator + 1).trim();

    if (key === "domain" && value) {
      host = value.replace(/^\./, "").toLowerCase();
    } else if (key === "path" && value) {
      path = value;
    } else if (key === "expires" && value) {
      const parsed = Date.parse(value);
      if (!Number.isNaN(parsed)) expiresAt = parsed;
    } else if (key === "max-age" && value) {
      const seconds = Number(value);
      if (Number.isFinite(seconds)) maxAge = seconds;
    }
  }

  // Max-Age wins over Expires per RFC 6265; a non-positive one is a delete.
  if (maxAge !== null) expiresAt = maxAge <= 0 ? Date.now() - 1 : Date.now() + maxAge * 1000;

  return {
    name,
    value: pair.slice(eq + 1).trim(),
    host,
    path,
    expiresAt: expiresAt ?? 0,
    session: expiresAt === null,
  };
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

interface RequestOptions {
  method?: "GET" | "POST";
  form?: URLSearchParams;
  json?: unknown;
  /** Pre-serialized body (the sealed envelope), sent verbatim. */
  raw?: string;
  headers?: Record<string, string>;
  /** Only safe where we own the whole query — never on a ticket redirect. */
  cacheBust?: boolean;
}

class CasTransport {
  readonly jar = new CookieJar();
  private referer = `${CAS_ORIGIN}/`;

  setReferer(url: string): void {
    this.referer = url;
  }

  async request(url: string, options: RequestOptions = {}): Promise<Response> {
    const method = options.method ?? "GET";
    const target = method === "GET" && options.cacheBust ? appendCacheBuster(url) : url;

    const headers: Record<string, string> = {
      ...CLIENT_HEADERS,
      Referer: this.referer,
      ...options.headers,
    };

    const cookie = this.jar.headerFor(target);
    if (cookie) headers.Cookie = cookie;
    if (method !== "GET") headers.Origin = new URL(target).origin;

    // The SMS APIs sit behind a per-request guard-header check.
    if (target.includes("/protected/")) {
      Object.assign(headers, buildGuardHeaders());
      headers["Sid-Language"] ??= "zh_CN";
    }

    let body: string | undefined;
    if (options.form) {
      body = options.form.toString();
      headers["Content-Type"] ??= "application/x-www-form-urlencoded";
    } else if (options.json !== undefined) {
      body = JSON.stringify(options.json);
      headers["Content-Type"] ??= "application/json";
    } else if (options.raw !== undefined) {
      body = options.raw;
      headers["Content-Type"] ??= "application/json";
    }

    const response = await fetch(target, { method, headers, body, redirect: "manual" });
    this.jar.absorb(response, target);
    return response;
  }
}

function appendCacheBuster(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}${Date.now()}`;
}

// ---------------------------------------------------------------------------
// Payload crypto
// ---------------------------------------------------------------------------

function encryptFormValue(pageKey: string, plaintext: string): string {
  if (!pageKey) throw new Error("The login page did not publish an encryption key.");
  return CryptoJS.AES.encrypt(plaintext, CryptoJS.enc.Base64.parse(pageKey), ECB_PKCS7).toString();
}

/**
 * Guard headers for `/protected/` requests: an MD5 over the Base64 of a
 * throwaway key with its own first half spliced in front and its second half
 * appended. Computed client-side by the CAS page, so reproduced exactly.
 */
function buildGuardHeaders(): Record<string, string> {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  let key = "";
  for (const byte of raw) key += GUARD_KEY_ALPHABET[byte % GUARD_KEY_ALPHABET.length];

  const encoded = bytesToBase64(new TextEncoder().encode(key));
  const midpoint = Math.floor(encoded.length / 2);
  const mixed = encoded.slice(0, midpoint) + encoded + encoded.slice(midpoint);

  return {
    "Csrf-Key": key,
    "Csrf-Value": CryptoJS.MD5(CryptoJS.enc.Latin1.parse(mixed)).toString(CryptoJS.enc.Hex),
  };
}

interface SealedEnvelope {
  body: string;
  keyHeader: string;
  sessionKey: CryptoJS.lib.WordArray;
}

/**
 * The hybrid envelope the phone-lookup endpoint speaks: a per-request AES key
 * encrypts the body, and travels RSA-wrapped in a header. Must be PKCS#1 v1.5 —
 * Web Crypto only offers RSA-OAEP, which is why this reaches for node:crypto
 * (available under the nodejs_compat flag this Worker already sets).
 */
function sealJsonEnvelope(value: unknown): SealedEnvelope {
  const keyBytes = crypto.getRandomValues(new Uint8Array(16));
  const keyBase64 = bytesToBase64(keyBytes);
  const sessionKey = CryptoJS.enc.Base64.parse(keyBase64);

  return {
    body: CryptoJS.AES.encrypt(JSON.stringify(value), sessionKey, ECB_PKCS7).toString(),
    // The header carries the Base64 *text* of the key, not its raw bytes.
    keyHeader: publicEncrypt(
      { key: ENVELOPE_PUBLIC_KEY, padding: constants.RSA_PKCS1_PADDING },
      Buffer.from(keyBase64, "ascii"),
    ).toString("base64"),
    sessionKey,
  };
}

/**
 * Peel a sealed reply. The server nests inconsistently — a bare ciphertext, a
 * ciphertext inside a JSON string, or plain JSON — so unwrap opportunistically
 * and stop as soon as no further progress is possible.
 */
function openSealedReply(payload: string, sessionKey: CryptoJS.lib.WordArray): unknown {
  let current: unknown = payload;

  for (let round = 0; round < 4; round++) {
    if (typeof current !== "string") return current;

    const parsed = tryParseJson(current);
    if (typeof parsed === "string" && parsed !== current) {
      current = parsed;
      continue;
    }
    if (parsed !== undefined && typeof parsed !== "string") return parsed;

    let decrypted = "";
    try {
      decrypted = CryptoJS.AES.decrypt(
        typeof parsed === "string" ? parsed : current,
        sessionKey,
        ECB_PKCS7,
      ).toString(CryptoJS.enc.Utf8);
    } catch {
      return current;
    }
    if (!decrypted) return current;

    const asJson = tryParseJson(decrypted);
    current = asJson === undefined ? decrypted : asJson;
  }

  return current;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

// ---------------------------------------------------------------------------
// Page parsing
// ---------------------------------------------------------------------------

/** Text content of the first element carrying `id="<elementId>"`. */
function readElementText(html: string, elementId: string): string {
  const start = html.indexOf(`id="${elementId}"`);
  if (start === -1) return "";
  const contentStart = html.indexOf(">", start);
  if (contentStart === -1) return "";
  const contentEnd = html.indexOf("<", contentStart);
  if (contentEnd === -1) return "";
  return html.substring(contentStart + 1, contentEnd).trim();
}

/**
 * Where to POST the form back. Angular renders `action="login"`, which resolves
 * relative to the current page and deliberately drops `?service=` — by that
 * point the webflow `execution` owns the flow.
 */
function resolveFormAction(html: string, responseUrl: string): string {
  const match = /<form\b[^>]*\baction\s*=\s*["']([^"']*)["']/i.exec(html);
  try {
    return new URL(match?.[1]?.trim() || "login", responseUrl).toString();
  } catch {
    return responseUrl;
  }
}

/** Markers that identify the second-factor gateway page. */
export function hasSecondFactorMarker(html: string): boolean {
  return (
    html.includes('id="sso-second">true</p>') ||
    html.includes('id="current-login-type">smsLogin</p>') ||
    html.includes('id="second-auth-tip">') ||
    html.includes("secondSmsLoginForm") ||
    html.includes("second-auth-tip") ||
    html.includes("cas-gateway")
  );
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

const CODED_FAILURES: Record<string, { reason: SignInReason; message: string }> = {
  "1030027": { reason: "bad_credentials", message: "Incorrect username or password." },
  "1030031": { reason: "bad_credentials", message: "Incorrect username or password." },
  "1030028": {
    reason: "account_locked",
    message: "This account is locked. Please unlock it on the campus identity portal.",
  },
  "1320007": {
    reason: "code_rejected",
    message: "That verification code is incorrect or has expired.",
  },
  "1320010": {
    reason: "captcha_required",
    message: "An image captcha is required. Please sign in with token instead.",
  },
  "1330001": {
    reason: "risk_rejected",
    message: "Sign-in was blocked by campus risk control. Please sign in with token instead.",
  },
  "1410040": { reason: "account_inactive", message: "This account is not in a valid state." },
  "1410041": { reason: "account_inactive", message: "This account is not in a valid state." },
  "3910001": {
    reason: "account_dormant",
    message: "This account is dormant. Please activate it on the campus identity portal.",
  },
};

function classifyPageError(
  html: string,
  fallback: { reason: SignInReason; message: string },
): { reason: SignInReason; message: string } {
  let message = readElementText(html, "login-error-msg").trim();
  let code = readElementText(html, "login-error-code").trim();

  // Some responses put the code in the message slot and leave the code empty.
  if (!code && /^\d+$/.test(message)) {
    code = message;
    message = "";
  }

  const known = CODED_FAILURES[code];
  if (known) return { reason: known.reason, message: message || known.message };
  if (message) return { reason: fallback.reason, message };
  return fallback;
}

/**
 * CAS answers a resend inside the validity window with an error-shaped body
 * that actually means "the code we already sent is still good".
 */
function isCodeStillValidNotice(message: string): boolean {
  return message.includes("验证码") && message.includes("有效期内") && message.includes("重复发送");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readApiCode(payload: unknown): number | null {
  if (!isRecord(payload)) return null;
  if (typeof payload.code === "number") return payload.code;
  if (typeof payload.code === "string" && /^\d+$/.test(payload.code)) return Number(payload.code);
  return null;
}

function readApiData(payload: unknown): Record<string, unknown> | null {
  if (!isRecord(payload)) return null;
  return isRecord(payload.data) ? payload.data : null;
}

function readApiMessage(payload: unknown): string {
  const keys = ["message", "msg", "errorMessage"] as const;
  const pick = (record: Record<string, unknown>): string => {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string" && value) return value;
    }
    return "";
  };

  if (!isRecord(payload)) return "";
  return pick(payload) || (isRecord(payload.data) ? pick(payload.data) : "");
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function readString(record: Record<string, unknown> | null, key: string): string {
  const value = record?.[key];
  return typeof value === "string" ? value : "";
}

// ---------------------------------------------------------------------------
// Flow
// ---------------------------------------------------------------------------

/**
 * Run the password half. Either finishes the sign-in, or stops at a
 * second-factor prompt with the SMS already sent and a resumable context.
 */
export async function startPasswordSignIn(
  username: string,
  password: string,
  trustedCookies: readonly DurableCookie[] = [],
): Promise<PasswordSignInOutcome> {
  const transport = new CasTransport();
  // Remembered-device cookies go in before the first hop, while CAS is still
  // deciding whether to demand a second factor.
  transport.jar.seed(trustedCookies);

  const page = await loadCredentialPage(transport);
  const pageKey = readElementText(page.html, "login-croypto");
  const execution = readElementText(page.html, "login-page-flowkey");
  if (!pageKey || !execution) {
    throw new CasSignInError(
      "Failed to parse login page. If this persists, please sign in with token.",
      "unsupported_page",
    );
  }
  transport.setReferer(page.url);

  // We cannot solve an image captcha here; detect it and say so rather than
  // submitting a blank one and reporting a bogus password error.
  await assertNoCaptchaRequired(transport, username);

  const form = new URLSearchParams({
    username,
    password: encryptFormValue(pageKey, password),
    type: "UsernamePassword",
    _eventId: "submit",
    execution,
    croypto: pageKey,
    geolocation: "",
    captcha_code: "",
  });

  const formAction = resolveFormAction(page.html, page.url);
  const response = await transport.request(formAction, { method: "POST", form });

  if (response.status === 401) {
    throw new CasSignInError("Incorrect username or password.", "bad_credentials");
  }

  if (response.status === 302) {
    const token = await exchangeTicketForToken(transport, response.headers.get("Location"));
    return { kind: "token", token, durableCookies: transport.jar.exportDurable() };
  }

  const html = await response.text();
  const secondFactorExecution = readElementText(html, "login-page-flowkey");
  const userObjectId = readElementText(html, "user-object-id");

  // All three signals, so an ordinary re-rendered login page (which also has a
  // flowkey) is never mistaken for a 2FA prompt.
  if (secondFactorExecution && userObjectId && hasSecondFactorMarker(html)) {
    return startSecondFactor(transport, {
      username,
      execution: secondFactorExecution,
      formAction: resolveFormAction(html, formAction),
      userObjectId,
      displayPhone: readElementText(html, "phone-number"),
    });
  }

  // A 2FA-looking page we could not parse: point at the fallback rather than
  // reporting it as a wrong password.
  if (hasSecondFactorMarker(html)) {
    throw new CasSignInError(
      "Verification required. Please sign in with token instead.",
      "unsupported_page",
    );
  }

  const failure = classifyPageError(html, {
    reason: "unknown",
    message: "Login failed. If this persists, please sign in with token.",
  });
  throw new CasSignInError(failure.message, failure.reason);
}

/** Finish a second factor from a resumed context. */
export async function finishSecondFactor(
  context: SecondFactorContext,
  code: string,
): Promise<{ token: string; durableCookies: DurableCookie[] }> {
  const transport = new CasTransport();
  // Session cookies are the point of the resume bag, so restore them as such
  // (their original lifetimes were never sent by CAS).
  transport.jar.seed(context.cookies, true);
  transport.setReferer(`${CAS_ORIGIN}/cas/`);

  const check = await postJson(transport, CHECK_CODE_URL, {
    phone: context.phoneHandle,
    token: code,
    delete: false,
    trustDevice: TRUST_THIS_DEVICE,
  });

  if (readApiCode(check) !== 200) {
    throw new CasSignInError(
      readApiMessage(check) || "That verification code is incorrect or has expired.",
      "code_rejected",
    );
  }

  // CAS reuses the login form: the code travels in `password` under a new type.
  const form = new URLSearchParams({
    username: context.username,
    password: code,
    type: "smsLogin",
    _eventId: "submit",
    execution: context.execution,
    geolocation: "",
    captcha_code: "",
    trustDevice: String(TRUST_THIS_DEVICE),
  });

  const response = await transport.request(context.formAction, { method: "POST", form });

  if (response.status !== 302) {
    const failure = classifyPageError(await response.text(), {
      reason: "code_rejected",
      message: "That verification code was rejected. Please start over.",
    });
    throw new CasSignInError(failure.message, failure.reason);
  }

  const token = await exchangeTicketForToken(transport, response.headers.get("Location"));
  return { token, durableCookies: transport.jar.exportDurable() };
}

/** Resolve the bound phone, ask CAS to text a code, and package the resume state. */
async function startSecondFactor(
  transport: CasTransport,
  page: {
    username: string;
    execution: string;
    formAction: string;
    userObjectId: string;
    displayPhone: string;
  },
): Promise<PasswordSignInOutcome> {
  // The protected SMS APIs are called from the CAS app root, not the form URL —
  // CAS cross-checks the referer, so match what the page itself sends.
  transport.setReferer(`${CAS_ORIGIN}/cas/`);

  const phone = await lookupBoundPhone(transport, page.userObjectId);
  const phoneHandle = phone.handle || page.displayPhone;
  if (!phoneHandle) {
    throw new CasSignInError(
      "The verification page did not identify a phone number to text. Please sign in with token instead.",
      "unsupported_page",
    );
  }

  const send = await postJson(transport, SEND_CODE_URL, {
    phone: phoneHandle,
    businessNo: SECOND_FACTOR_BUSINESS_NO,
  });

  const sendMessage = readApiMessage(send);
  if (readApiCode(send) !== 200 && !isCodeStillValidNotice(sendMessage)) {
    throw new CasSignInError(
      sendMessage || "Failed to send the verification code. Please try again.",
      "sms_send_failed",
    );
  }

  return {
    kind: "second_factor",
    phoneHint: phone.masked,
    context: {
      cookies: transport.jar.exportAll(),
      execution: page.execution,
      formAction: page.formAction,
      username: page.username,
      phoneHandle,
    },
  };
}

async function lookupBoundPhone(
  transport: CasTransport,
  userObjectId: string,
): Promise<{ handle: string; masked: string }> {
  const envelope = sealJsonEnvelope({ userId: userObjectId });

  const response = await transport.request(PHONE_LOOKUP_URL, {
    method: "POST",
    raw: envelope.body,
    headers: {
      "Content-Type": "application/json",
      hasCrypto: "true",
      privateKey: envelope.keyHeader,
    },
  });

  const body = await response.text();
  if (!body) {
    throw new CasSignInError(
      "The verification service returned an empty response. Please sign in with token instead.",
      "unsupported_page",
    );
  }

  const opened = openSealedReply(body, envelope.sessionKey);
  const data = readApiData(opened) ?? (isRecord(opened) ? opened : null);
  return { handle: readString(data, "tel"), masked: readString(data, "maskTel") };
}

/**
 * Probe whether CAS wants an image captcha. We never solve one — the point is
 * to fail with an accurate reason instead of a generic rejection.
 */
async function assertNoCaptchaRequired(transport: CasTransport, username: string): Promise<void> {
  let payload: unknown;
  try {
    const response = await transport.request(
      `${CAPTCHA_PROBE_URL}/${encodeURIComponent(username)}`,
      { cacheBust: true },
    );
    payload = tryParseJson(await response.text());
  } catch {
    // Advisory only: if the probe fails, let the real POST decide.
    return;
  }

  if (readApiData(payload)?.captchaInvisible) {
    throw new CasSignInError(
      "This account needs an image captcha. Please sign in with token instead.",
      "captcha_required",
    );
  }
}

/**
 * Fetch the credential page, following the redirects CAS uses to seat a session
 * before it renders the form. The URL we end on matters: the form's `action`
 * resolves relative to it.
 */
async function loadCredentialPage(
  transport: CasTransport,
): Promise<{ url: string; html: string }> {
  let url = `${CAS_LOGIN_URL}?service=${encodeURIComponent(SERVICE_URL)}`;

  for (let hop = 0; hop <= MAX_PAGE_REDIRECTS; hop++) {
    const response = await transport.request(url);
    if (response.status < 300 || response.status >= 400) {
      return { url, html: await response.text() };
    }
    const location = response.headers.get("Location");
    if (!location) return { url, html: await response.text() };
    url = new URL(location, url).toString();
  }

  throw new CasSignInError(
    "The sign-in page kept redirecting. Please sign in with token instead.",
    "unsupported_page",
  );
}

/** Follow the ticket into the yanhekt callback and read the bearer token off it. */
async function exchangeTicketForToken(
  transport: CasTransport,
  ticketLocation: string | null,
): Promise<string> {
  if (!ticketLocation) {
    throw new CasSignInError(
      "Sign-in succeeded but the redirect was missing. Please sign in with token.",
      "unknown",
    );
  }

  const ticketUrl = new URL(ticketLocation, CAS_LOGIN_URL).toString();
  const response = await transport.request(ticketUrl);
  if (response.status !== 302) {
    throw new CasSignInError("Ticket verification failed. Please sign in with token.", "unknown");
  }

  const location = response.headers.get("Location");
  if (!location) {
    throw new CasSignInError(
      "Ticket verification succeeded but the redirect was missing. Please sign in with token.",
      "unknown",
    );
  }

  const token = new URL(location, ticketUrl).searchParams.get("token");
  if (!token) {
    throw new CasSignInError("Failed to extract token. Please sign in with token.", "unknown");
  }
  return token;
}

async function postJson(transport: CasTransport, url: string, json: unknown): Promise<unknown> {
  const response = await transport.request(url, { method: "POST", json });
  return tryParseJson(await response.text());
}
