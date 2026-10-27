/**
 * The desktop app (and its `yhdl` command) uses the Index API as a signed-in
 * Yanhekt user: an app request must carry the user's login token as a Bearer.
 * Only the shape is checked (Yanhekt login tokens are 32 hex characters, as
 * the relay checks them); the token is never sent anywhere from here.
 * Browsers and the web Worker's service binding are not app requests.
 */
const APP_USER_AGENT = 'AutoSlides/';
const LOGIN_TOKEN = /^Bearer [0-9a-f]{32}$/i;

/** True when an app request comes without a well-formed Bearer token. */
export function appTokenMissing(req: Request): boolean {
  const ua = req.headers.get('User-Agent') ?? '';
  if (!ua.startsWith(APP_USER_AGENT)) return false;
  return !LOGIN_TOKEN.test((req.headers.get('Authorization') ?? '').trim());
}
