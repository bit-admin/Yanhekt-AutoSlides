/**
 * Reading the CAS login pages.
 *
 * The pages are Angular-rendered and expose their state as text inside
 * elements with known ids rather than as form inputs, so everything here is
 * id-driven. Two page shapes matter:
 *
 * - the credential page (`#login-croypto` + `#login-page-flowkey`), and
 * - the second-factor page, which reuses `#login-page-flowkey` for a *new*
 *   webflow execution and adds `#user-object-id`.
 */

/** Text content of the first element carrying `id="<elementId>"`. */
export function readElementText(html: string, elementId: string): string {
  const marker = `id="${elementId}"`;
  const start = html.indexOf(marker);
  if (start === -1) return '';
  const contentStart = html.indexOf('>', start);
  if (contentStart === -1) return '';
  const contentEnd = html.indexOf('<', contentStart);
  if (contentEnd === -1) return '';
  return html.substring(contentStart + 1, contentEnd).trim();
}

export interface CredentialPage {
  execution: string;
  pageKey: string;
  /** Absolute URL to POST the credential form to. */
  formAction: string;
  /** Risk engine id, e.g. `USTC`. Read for diagnostics; we send no risk fields. */
  riskSystem: string;
}

export interface SecondFactorPage {
  /** A *new* execution, distinct from the credential page's. */
  execution: string;
  formAction: string;
  userObjectId: string;
  /** Phone as printed on the page, when present. Display only. */
  displayPhone: string;
}

export interface PageError {
  message: string;
  code: string;
}

export function parseCredentialPage(html: string, responseUrl: string): CredentialPage | null {
  const execution = readElementText(html, 'login-page-flowkey');
  const pageKey = readElementText(html, 'login-croypto');
  if (!execution || !pageKey) return null;

  return {
    execution,
    pageKey,
    formAction: resolveFormAction(html, responseUrl),
    riskSystem: readElementText(html, 'riskSystemSwitch'),
  };
}

/**
 * A second-factor page needs all three signals: a fresh execution, the user
 * handle the phone lookup keys off, and one of the gateway markers. Requiring
 * all three keeps us from mistaking an ordinary re-rendered login page (which
 * also has a flowkey) for a 2FA prompt.
 */
export function parseSecondFactorPage(html: string, responseUrl: string): SecondFactorPage | null {
  const execution = readElementText(html, 'login-page-flowkey');
  const userObjectId = readElementText(html, 'user-object-id');
  if (!execution || !userObjectId) return null;
  if (!hasSecondFactorMarker(html)) return null;

  return {
    execution,
    formAction: resolveFormAction(html, responseUrl),
    userObjectId,
    displayPhone: readElementText(html, 'phone-number'),
  };
}

/**
 * Markers that identify the second-factor gateway. The first three are what
 * this app already keyed on before it could complete the flow; the rest are the
 * structural ids the page itself uses, which survive copy changes better.
 */
export function hasSecondFactorMarker(html: string): boolean {
  return (
    html.includes('id="sso-second">true</p>') ||
    html.includes('id="current-login-type">smsLogin</p>') ||
    html.includes('id="second-auth-tip">') ||
    html.includes('secondSmsLoginForm') ||
    html.includes('second-auth-tip') ||
    html.includes('cas-gateway')
  );
}

export function parsePageError(html: string): PageError {
  return {
    message: readElementText(html, 'login-error-msg'),
    code: readElementText(html, 'login-error-code'),
  };
}

/**
 * Where to POST the form back.
 *
 * Angular renders `action="login"`, which resolves *relative to the current
 * page* — and that deliberately drops the `?service=` query, because by this
 * point the webflow `execution` owns the flow. Resolving by hand (rather than
 * reusing the URL we requested) is what keeps the second-factor POST landing on
 * the right flow.
 */
function resolveFormAction(html: string, responseUrl: string): string {
  const match = /<form\b[^>]*\baction\s*=\s*["']([^"']*)["']/i.exec(html);
  const action = match?.[1]?.trim() || 'login';
  try {
    return new URL(action, responseUrl).toString();
  } catch {
    return responseUrl;
  }
}
