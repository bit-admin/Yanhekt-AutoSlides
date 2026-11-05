// The one way the main process sends an HTTP request.
//
// Every request goes through an axios instance made here, and every such
// instance picks the request's route before it is sent: straight to the host,
// or through the proxy the settings name for it (`proxyRouting.ts`). Nothing
// else in main may import axios (ESLint enforces it), call the global `fetch`,
// or open a client request with `http`/`https`, so no request can skip the
// route by accident.
//
// Three shapes on one core:
//
//  - `httpClient`: the shared instance, for ordinary requests.
//  - `createHttpClient(defaults)`: an instance with its own defaults (the
//    campus sign-in's, a download's agents). Interceptors a caller adds to it
//    run before the route is picked, so a URL they rewrite is what is routed.
//  - `httpFetch(url, init)`: the fetch API, for code written against it and for
//    SDKs that take a `fetch` (Notion).
//
// The campus intranet sits on top of this, in `intranetTransport.ts`.
import axios, {
  type AxiosInstance,
  type CreateAxiosDefaults,
  type InternalAxiosRequestConfig,
} from 'axios';
import { proxyAgentsFor } from './proxyRouting';

/** True for an error thrown by a request made here (no answer, or a status the caller refused). */
export const isHttpError = axios.isAxiosError;
/** True for a request the caller cancelled. */
export const isHttpCancel = axios.isCancel;

/**
 * True when the request was rewritten onto an address and carries its real
 * hostname in `Host` (the intranet transport does this). Such a request must
 * connect directly: a proxy cannot reach the campus network, and a tunnel
 * would present the address, not the hostname, as the TLS server name.
 */
function isRewritten(config: InternalAxiosRequestConfig, url: URL): boolean {
  const host = config.headers?.get?.('Host');
  if (typeof host !== 'string' || host === '') return false;
  // Compare names only: some callers send `Host` with the port.
  const name = host.toLowerCase().replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  return name !== url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
}

async function routeRequest(instance: AxiosInstance, config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> {
  // axios would otherwise read HTTPS_PROXY itself; the route is decided here.
  config.proxy = false;
  let url: URL;
  try {
    url = new URL(instance.getUri(config));
  } catch {
    return config;
  }
  if (isRewritten(config, url)) return config;
  const agents = await proxyAgentsFor(url.href);
  if (agents) {
    // The caller's own agents (keep-alive pools, a bound campus NIC) are for
    // direct connections; a proxied request uses the proxy's.
    config.httpAgent = agents.httpAgent;
    config.httpsAgent = agents.httpsAgent;
  }
  return config;
}

export function createHttpClient(defaults: CreateAxiosDefaults = {}): AxiosInstance {
  const instance = axios.create({ ...defaults, proxy: false });
  instance.interceptors.request.use((config) => routeRequest(instance, config));
  return instance;
}

/** The shared instance. */
export const httpClient: AxiosInstance = createHttpClient();

function headersToRecord(headers: RequestInit['headers']): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  new Headers(headers).forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

/** Statuses whose Response must not have a body. */
const NULL_BODY = new Set([101, 103, 204, 205, 304]);

/**
 * `fetch`, sent through the route. Resolves for any status, rejects when no
 * answer came, like the real one. The body is read in full before it resolves,
 * so use `httpClient` with `responseType: 'stream'` for large downloads.
 */
export async function httpFetch(input: string | URL | Request, init: RequestInit = {}): Promise<Response> {
  if (input instanceof Request) {
    throw new TypeError('httpFetch takes a URL; pass the method, headers and body in init');
  }
  let headers = headersToRecord(init.headers);
  let data: Buffer | undefined;
  if (init.body != null) {
    // Let the platform encode the body exactly as fetch would: a FormData's
    // multipart boundary, a string's default text/plain, a Blob's type.
    const encoded = new Request('http://localhost/', { method: 'POST', body: init.body, headers: init.headers });
    data = Buffer.from(await encoded.arrayBuffer());
    headers = headersToRecord(encoded.headers);
  }
  const response = await httpClient.request<ArrayBuffer>({
    url: String(input),
    method: init.method ?? 'GET',
    headers,
    data,
    // The body is already bytes; axios must not re-encode it.
    transformRequest: [(body: unknown) => body],
    signal: init.signal ?? undefined,
    responseType: 'arraybuffer',
    validateStatus: () => true,
    maxRedirects: init.redirect === 'manual' || init.redirect === 'error' ? 0 : 20,
  });
  const answer = new Headers();
  for (const [key, value] of Object.entries(response.headers)) {
    if (value == null) continue;
    // axios has already decompressed the body.
    if (key === 'content-encoding' || key === 'content-length') continue;
    if (Array.isArray(value)) value.forEach((v) => answer.append(key, String(v)));
    else answer.set(key, String(value));
  }
  const body = NULL_BODY.has(response.status) ? null : Buffer.from(response.data);
  return new Response(body, { status: response.status, statusText: response.statusText, headers: answer });
}
