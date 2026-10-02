/**
 * Pure helpers for the Yanhe 2.0 (aita) session token.
 *
 * The token is a JWT. The server hands it out inside the `_token` cookie, which
 * is a Yii signed cookie: `hex(HMAC) + URL-encoded PHP-serialized value`, with
 * the JWT as the last string in that value. Only the JWT is ever needed — the
 * API takes it as `Authorization: Bearer`.
 *
 * Nothing here verifies the signature. The server does that on every request;
 * these helpers only decide what to send it and what to remember.
 */

const JWT_RE = /eyJ[\w-]+\.[\w-]+\.[\w-]+/;
const TOKEN_COOKIE_RE = /(?:^|[;,\s])_token=([^;,\s]*)/i;

/** The claims we read. `realname` and `password` are present but deliberately not surfaced. */
export interface Yanhe2Claims {
  /** Student id (学号). The key sessions are stored under. */
  account: string;
  /** Epoch seconds; login + 86 400. */
  exp: number;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Pull the JWT out of whatever the user or a response gave us: a bare JWT, a
 * `Bearer …` value, one `Set-Cookie` line, or a whole `Cookie:` header copied
 * from DevTools. A `_token` cookie wins over any other JWT-shaped value in the
 * same text.
 */
export function extractYanhe2Jwt(text: string): string | null {
  if (!text) return null;
  const cookie = TOKEN_COOKIE_RE.exec(text);
  if (cookie?.[1]) {
    const inCookie = JWT_RE.exec(safeDecode(cookie[1]));
    if (inCookie) return inCookie[0];
  }
  const anywhere = JWT_RE.exec(safeDecode(text));
  return anywhere ? anywhere[0] : null;
}

/** The JWT from a response's `Set-Cookie` lines, if one of them is `_token`. */
export function extractYanhe2JwtFromSetCookie(lines: readonly string[]): string | null {
  for (const line of lines) {
    if (!/^\s*_token=/i.test(line)) continue;
    const jwt = extractYanhe2Jwt(line);
    if (jwt) return jwt;
  }
  return null;
}

/** Decode the payload. Null when it is not a JWT we can use. */
export function decodeYanhe2Claims(jwt: string): Yanhe2Claims | null {
  const payload = jwt.split('.')[1];
  if (!payload) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const { account, exp } = parsed as Record<string, unknown>;
  const accountText = typeof account === 'string' || typeof account === 'number' ? String(account).trim() : '';
  if (!accountText || typeof exp !== 'number' || !Number.isFinite(exp)) return null;
  return { account: accountText, exp };
}
