/**
 * Developer → SSO: what of a raw CAS exchange may be shown. Runs in main, so
 * unless the developer asks for raw values, the password, the SMS code,
 * cookies, tickets and tokens never reach the renderer — only their length.
 */
import type { CasExchange } from '@main/platform/campusSso/casProbe';
import type { DevSsoExchange } from '@common/devSso';

/** Response bodies (mostly the CAS HTML pages) are cut here. */
export const MAX_BODY_CHARS = 24_000;

/** Body fields that carry a secret: the password or SMS code, and CAS's phone handle. */
const SECRET_FIELDS = new Set(['password', 'token', 'phone', 'tel', '_token', 'ticket']);

/** Query parameters that carry a secret. */
const SECRET_PARAMS = new Set(['ticket', 'token', '_token']);

export function hidden(value: string): string {
  return `•••• (${value.length})`;
}

/** Keep the shape, hide the value: `ticket=•••• (35)`. */
export function redactUrl(url: string): string {
  return url.replace(/([?&])([^=&#]+)=([^&#]*)/g, (whole, sep: string, key: string, value: string) =>
    SECRET_PARAMS.has(key.toLowerCase()) && value ? `${sep}${key}=${hidden(value)}` : whole,
  );
}

/** A `Cookie:` header, names only. */
export function redactCookieHeader(value: string): string {
  return value
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const eq = part.indexOf('=');
      return eq < 0 ? part : `${part.slice(0, eq)}=${hidden(part.slice(eq + 1))}`;
    })
    .join('; ');
}

/** One `Set-Cookie:` line: the value hidden, the attributes kept. */
export function redactSetCookie(line: string): string {
  const semi = line.indexOf(';');
  const pair = semi < 0 ? line : line.slice(0, semi);
  const rest = semi < 0 ? '' : line.slice(semi);
  const eq = pair.indexOf('=');
  if (eq < 0) return line;
  return `${pair.slice(0, eq)}=${hidden(pair.slice(eq + 1))}${rest}`;
}

/** Hide secrets that can turn up inside any text: ticket/token query values and JWTs. */
export function redactText(text: string): string {
  return text
    .replace(/([?&](?:ticket|token|_token)=)([^&"'\s<>]+)/gi, (_m, prefix: string, value: string) => `${prefix}${hidden(value)}`)
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, (jwt) => `JWT ${hidden(jwt)}`);
}

function redactJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactJsonValue);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      out[key] = SECRET_FIELDS.has(key.toLowerCase()) && (typeof inner === 'string' || typeof inner === 'number')
        ? hidden(String(inner))
        : redactJsonValue(inner);
    }
    return out;
  }
  return typeof value === 'string' ? redactText(value) : value;
}

/** A JSON text with secret fields hidden, pretty-printed; null when it is not JSON. */
export function redactJson(text: string): string | null {
  try {
    return JSON.stringify(redactJsonValue(JSON.parse(text)), null, 2);
  } catch {
    return null;
  }
}

function redactForm(text: string): string {
  const params = new URLSearchParams(text);
  const lines: string[] = [];
  for (const [key, value] of params) {
    lines.push(`${key}=${SECRET_FIELDS.has(key.toLowerCase()) && value ? hidden(value) : value}`);
  }
  return lines.join('\n');
}

function flattenHeaders(headers: Record<string, unknown> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(headers ?? {})) {
    if (raw == null) continue;
    out[key] = Array.isArray(raw) ? raw.map(String).join(key.toLowerCase() === 'set-cookie' ? '\n' : ', ') : String(raw);
  }
  return out;
}

function rawRequestBody(exchange: CasExchange): string {
  const body = exchange.requestBody ?? '';
  if (exchange.requestBodyKind === 'form') return [...new URLSearchParams(body)].map(([k, v]) => `${k}=${v}`).join('\n');
  if (exchange.requestBodyKind === 'json') {
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      return body;
    }
  }
  return body;
}

function cut(text: string): { text: string; truncatedFrom: number | null } {
  return text.length <= MAX_BODY_CHARS ? { text, truncatedFrom: null } : { text: text.slice(0, MAX_BODY_CHARS), truncatedFrom: text.length };
}

function redactRequestHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (lower === 'cookie') out[key] = redactCookieHeader(value);
    else if (lower === 'referer') out[key] = redactUrl(value);
    else out[key] = value;
  }
  return out;
}

function redactResponseHeaders(headers: Record<string, unknown> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(headers ?? {})) {
    if (raw == null) continue;
    const values = Array.isArray(raw) ? raw.map(String) : [String(raw)];
    const lower = key.toLowerCase();
    if (lower === 'set-cookie') out[key] = values.map(redactSetCookie).join('\n');
    else if (lower === 'location') out[key] = values.map(redactUrl).join(', ');
    else out[key] = redactText(values.join(', '));
  }
  return out;
}

function redactRequestBody(exchange: CasExchange): string {
  const body = exchange.requestBody ?? '';
  if (!body) return '';
  if (exchange.requestBodyKind === 'form') return redactForm(body);
  if (exchange.requestBodyKind === 'json') return redactJson(body) ?? hidden(body);
  // The sealed phone-lookup envelope: ciphertext, shown as such.
  return `(encrypted, ${body.length} chars) ${body.slice(0, 48)}…`;
}

function redactResponseBody(body: string): { text: string; truncatedFrom: number | null } {
  return cut(redactJson(body) ?? redactText(body));
}

function rawResponseBody(body: string): { text: string; truncatedFrom: number | null } {
  try {
    return cut(JSON.stringify(JSON.parse(body), null, 2));
  } catch {
    return cut(body);
  }
}

/** The exchange for display: redacted, or with `reveal` exactly as sent and received (bodies still cut). */
export function formatExchange(exchange: CasExchange, id: number, reveal = false): DevSsoExchange {
  const body = exchange.responseBody;
  const response = body === undefined ? null : reveal ? rawResponseBody(body) : redactResponseBody(body);
  return {
    id,
    method: exchange.method,
    url: reveal ? exchange.url : redactUrl(exchange.url),
    requestHeaders: reveal ? { ...exchange.requestHeaders } : redactRequestHeaders(exchange.requestHeaders),
    requestBody: reveal ? rawRequestBody(exchange) : redactRequestBody(exchange),
    requestBodyKind: exchange.requestBodyKind ?? null,
    status: exchange.status ?? null,
    statusText: exchange.statusText ?? '',
    responseHeaders: reveal ? flattenHeaders(exchange.responseHeaders) : redactResponseHeaders(exchange.responseHeaders),
    responseBody: response?.text ?? '',
    responseBodyTruncatedFrom: response?.truncatedFrom ?? null,
    error: exchange.error ?? null,
    startedAt: exchange.startedAt,
    durationMs: exchange.durationMs,
  };
}
