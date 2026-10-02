/**
 * The Yanhe 2.0 (aita.yanhekt.cn) end of a campus CAS sign-in.
 *
 * aita does not take a CAS ticket on a fixed callback the way cbiz does. Its
 * `casapi` runs a PHP session around the CAS round trip:
 *
 *   hop 1  GET casapi … auType=          → seats PHPSESSID
 *   hop 2  GET casapi … auType=cas       → 302 to CAS; `service=` is the exact
 *                                          string CAS will compare byte for byte
 *   hop 4  GET/POST sso.bit.edu.cn/cas/login?service=… → ticket redirect
 *   hop 5  GET <service>&ticket=ST-…     → ticket checked into PHPSESSID
 *   hop 6  GET <service>                 → sets `_token` (the JWT). Done.
 *
 * Hop 3 (login.bit.edu.cn → sso.bit.edu.cn) is a plain redirect and skipped.
 * The final 302 back to the SPA is never followed.
 *
 * Because hop 4 only needs the CAS SSO session cookie, a transport that has
 * just finished the cbiz sign-in can run this whole leg without a second
 * password or SMS code — see `mintYanhe2WithSession`.
 */
import type { AxiosResponse } from 'axios';
import { YANHE2_CASAPI_CAS_URL, YANHE2_CASAPI_ENTRY_URL, YANHE2_LANDING_URL, YANHE2_ORIGIN } from '@common/yanhe2';
import type { CasTransport } from './casTransport';
import { extractYanhe2JwtFromSetCookie } from '../yanhe2/yanhe2Token';

const CAS_LOGIN_URL = 'https://sso.bit.edu.cn/cas/login';

/** Hop 5, hop 6, and slack for one unexpected bounce. */
const MAX_TICKET_HOPS = 4;

export class Yanhe2LegError extends Error {
  constructor(
    message: string,
    /** `no_session`: CAS showed its login page, so there was no SSO session to reuse. */
    readonly code: 'no_service' | 'no_session' | 'no_token',
  ) {
    super(message);
    this.name = 'Yanhe2LegError';
  }
}

/** Hops 1–2. Returns the `service` string CAS must see, read from casapi's own redirect. */
export async function discoverYanhe2Service(transport: CasTransport): Promise<string> {
  // Arrive "from" aita, as the browser does; the cbiz leg left a CAS referer.
  transport.setReferer(`${YANHE2_ORIGIN}/`);
  await transport.request(YANHE2_CASAPI_ENTRY_URL);
  const response = await transport.request(YANHE2_CASAPI_CAS_URL);
  const location = headerString(response, 'location');
  const service = location ? new URL(location, YANHE2_CASAPI_CAS_URL).searchParams.get('service') : null;
  if (!service) {
    throw new Yanhe2LegError('Yanhe 2.0 did not redirect to the campus sign-in.', 'no_service');
  }
  return service;
}

/** The CAS login URL for a discovered service. */
export function casLoginUrlFor(service: string): string {
  return `${CAS_LOGIN_URL}?service=${encodeURIComponent(service)}`;
}

/** Hops 5–6: follow the ticket redirect until casapi sets `_token`. */
export async function followYanhe2Ticket(transport: CasTransport, ticketUrl: string): Promise<string> {
  let url = ticketUrl;
  for (let hop = 0; hop < MAX_TICKET_HOPS; hop++) {
    const response = await transport.request(url);
    const jwt = extractYanhe2JwtFromSetCookie(setCookieLines(response));
    if (jwt) return jwt;
    const location = headerString(response, 'location');
    if (response.status < 300 || response.status >= 400 || !location) break;
    const next = new URL(location, url).toString();
    // Past casapi and back at the SPA without a token: nothing more to find.
    if (next.startsWith(YANHE2_LANDING_URL)) break;
    url = next;
  }
  throw new Yanhe2LegError('Yanhe 2.0 accepted the ticket but did not issue a session.', 'no_token');
}

/**
 * Run the whole leg on a transport whose jar already holds a CAS SSO session
 * (i.e. right after the cbiz ticket exchange). Never prompts: if CAS answers
 * with its login page instead of a ticket, there was no session to reuse.
 */
export async function mintYanhe2WithSession(transport: CasTransport): Promise<string> {
  const service = await discoverYanhe2Service(transport);
  const loginUrl = casLoginUrlFor(service);
  const response = await transport.request(loginUrl);
  const location = headerString(response, 'location');
  if (response.status < 300 || response.status >= 400 || !location || !/[?&]ticket=/.test(location)) {
    throw new Yanhe2LegError('The campus sign-in session could not be reused for Yanhe 2.0.', 'no_session');
  }
  return followYanhe2Ticket(transport, new URL(location, loginUrl).toString());
}

function headerString(response: AxiosResponse, name: string): string {
  const value: unknown = response.headers[name];
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : '';
  return typeof value === 'string' ? value : '';
}

function setCookieLines(response: AxiosResponse): string[] {
  const raw: unknown = response.headers['set-cookie'];
  if (Array.isArray(raw)) return raw.map(String);
  return typeof raw === 'string' && raw ? [raw] : [];
}
