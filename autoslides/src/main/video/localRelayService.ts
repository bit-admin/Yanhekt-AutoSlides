import * as http from 'http';
import * as https from 'https';
import * as os from 'os';
import * as url from 'url';
import axios, { type AxiosResponse } from 'axios';
import { ApiClient } from '@main/platform/apiClient';
import { ConfigService } from '@main/platform/configService';
import { IntranetMappingService } from '@main/platform/intranetMappingService';
import { ProxyAuth } from './videoProxy/proxyAuth';
import { signRecordedUrl, buildAxiosConfig, type ProxyAgents } from './videoProxy/proxyRequest';
import { createLogger } from '@main/infra/logger';

const log = createLogger('LocalRelay');

const LOGIN_TOKEN_RE = /^[0-9a-f]{32}$/i;

/** Cap on cached per-token auth entries when the whitelist is disabled. */
const MAX_AUTH_ENTRIES = 32;

// The relay signs and fetches whatever `u` points at, so restrict it to
// Yanhekt hosts — otherwise any allowed token can use this machine as an open
// fetch proxy into the LAN/intranet. Intranet rewriting happens after this
// check, on the public URL, so the allowlist is on the public host.
export function isAllowedUpstream(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
  const host = parsed.hostname.toLowerCase();
  return host === 'yanhekt.cn' || host.endsWith('.yanhekt.cn');
}

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Range,Content-Type',
  'Access-Control-Expose-Headers': 'Content-Length,Content-Range,Accept-Ranges'
};

const MEDIA_HEADERS: Record<string, string> = {
  Origin: 'https://www.yanhekt.cn',
  Referer: 'https://www.yanhekt.cn/',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.3'
};

export interface LocalRelayStatus {
  enabled: boolean;
  running: boolean;
  port: number;
  bindAddresses: string[];
  error: string | null;
}

/**
 * Rewrite a raw m3u8 so every media / key line goes through this relay's
 * Worker-compatible /playlist and /segment routes (absolute URLs using the
 * client-facing origin). Ported from relay/src/index.ts rewriteM3u8.
 */
export function rewriteRelayM3u8(
  content: string,
  baseUrl: string,
  origin: string,
  loginToken: string,
  noCache: boolean
): string {
  const tEnc = encodeURIComponent(loginToken);
  const suffix = noCache ? '&nocache=1' : '';
  const proxify = (abs: string): string => {
    const route = abs.split('?')[0].toLowerCase().endsWith('.m3u8') ? 'playlist' : 'segment';
    return `${origin}/${route}?u=${encodeURIComponent(abs)}&t=${tEnc}${suffix}`;
  };

  return content
    .split('\n')
    .map((line) => {
      if (line.startsWith('#')) {
        if (line.startsWith('#EXT-X-KEY') && line.includes('URI="')) {
          return line.replace(/URI="([^"]+)"/, (_m, uri: string) => {
            const abs = new URL(uri, baseUrl).toString();
            return `URI="${proxify(abs)}"`;
          });
        }
        return line;
      }
      if (line.trim() === '') return line;
      const abs = new URL(line.trim(), baseUrl).toString();
      return proxify(abs);
    })
    .join('\n');
}

/**
 * Long-lived LAN relay that mirrors the public Cloudflare relay Worker's
 * GET /playlist + GET /segment API so external clients (web, other devices)
 * can stream recorded Yanhekt HLS through this machine. Optional intranet
 * rewrite/bind via IntranetMappingService. Not used by in-app playback
 * (that stays on VideoProxyService / localhost).
 */
export class LocalRelayService {
  private server: http.Server | null = null;
  private listeningPort = 0;
  private lastError: string | null = null;
  private startPromise: Promise<void> | null = null;

  private httpAgent: http.Agent = new http.Agent({ keepAlive: true });
  private httpsAgent: https.Agent = new https.Agent({ keepAlive: true });
  private httpsAgentNoVerify: https.Agent = new https.Agent({
    keepAlive: true,
    rejectUnauthorized: false
  });
  private boundInterfaceIp = '';

  /** Per-login-token video-token cache (same isolation model as VideoProxyService). */
  private authByToken = new Map<string, ProxyAuth>();

  constructor(
    private apiClient: ApiClient,
    private intranetMapping: IntranetMappingService,
    private configService: ConfigService
  ) {
    this.intranetMapping.on('interfaceIpChanged', () => {
      this.rebuildAgents('');
    });
  }

  getStatus(): LocalRelayStatus {
    const port = this.configService.getLocalRelayPort();
    return {
      enabled: this.configService.getLocalRelayEnabled(),
      running: !!(this.server && this.listeningPort),
      port: this.listeningPort || port,
      bindAddresses: this.listBindAddresses(),
      error: this.lastError
    };
  }

  /**
   * Apply current config: stop when disabled; start/restart when enabled and
   * the listen port changed; whitelist-only updates need no restart.
   */
  async applyConfig(): Promise<LocalRelayStatus> {
    const enabled = this.configService.getLocalRelayEnabled();
    const port = this.configService.getLocalRelayPort();

    if (!enabled) {
      await this.stop();
      this.lastError = null;
      return this.getStatus();
    }

    if (this.server && this.listeningPort === port) {
      // Already running on the desired port — whitelist changes are read live.
      this.lastError = null;
      return this.getStatus();
    }

    await this.stop();
    await this.start();
    return this.getStatus();
  }

  async start(): Promise<void> {
    if (!this.configService.getLocalRelayEnabled()) {
      return;
    }
    if (this.server && this.listeningPort) {
      return;
    }
    if (this.startPromise) {
      return this.startPromise;
    }

    const port = this.configService.getLocalRelayPort();
    this.startPromise = new Promise<void>((resolve, reject) => {
      const server = http.createServer((req, res) => {
        void this.handleRequest(req, res);
      });

      let listened = false;
      server.on('error', (err: NodeJS.ErrnoException) => {
        const message =
          err.code === 'EADDRINUSE'
            ? `Port ${port} is already in use`
            : err.message || String(err);
        log.error('Local relay server error:', message);
        this.lastError = message;
        if (!listened) {
          this.server = null;
          this.listeningPort = 0;
          reject(err);
        } else {
          // Post-listen failure: tear down cleanly so a later applyConfig
          // can restart instead of racing a half-dead server.
          void this.stop();
        }
      });

      server.listen(port, '0.0.0.0', () => {
        listened = true;
        this.server = server;
        this.listeningPort = port;
        this.lastError = null;
        log.info(`Local relay listening on 0.0.0.0:${port}`);
        resolve();
      });
    });

    try {
      await this.startPromise;
    } catch {
      // lastError already set; leave running=false
    } finally {
      this.startPromise = null;
    }
  }

  async stop(): Promise<void> {
    const server = this.server;
    this.server = null;
    this.listeningPort = 0;

    for (const auth of this.authByToken.values()) {
      auth.stopUpdateSignatureLoop();
    }
    this.authByToken.clear();

    if (!server) return;

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      // Force-close hung connections so stop doesn't hang on open HLS streams.
      server.closeAllConnections?.();
    });
    log.info('Local relay stopped');
  }

  // ---- Request handling ----------------------------------------------------

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    this.applyCors(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method !== 'GET') {
      this.text(res, 405, 'Method not allowed');
      return;
    }

    try {
      const parsed = url.parse(req.url || '', true);
      const pathname = parsed.pathname || '';

      if (pathname !== '/playlist' && pathname !== '/segment') {
        this.text(res, 404, 'Not found');
        return;
      }

      const u = typeof parsed.query.u === 'string' ? parsed.query.u : '';
      const t = typeof parsed.query.t === 'string' ? parsed.query.t : '';
      if (!u || !t) {
        this.text(res, 400, 'Missing required params: u (media url) and t (login token)');
        return;
      }
      if (!LOGIN_TOKEN_RE.test(t)) {
        this.text(res, 403, 'Invalid login token');
        return;
      }
      if (!this.isTokenAllowed(t)) {
        this.text(res, 403, 'Token not allowed');
        return;
      }
      if (!isAllowedUpstream(u)) {
        this.text(res, 403, 'Upstream host not allowed');
        return;
      }

      const noCache = parsed.query.nocache === '1';
      const origin = this.clientOrigin(req);

      if (pathname === '/playlist') {
        await this.handlePlaylist(res, u, t, origin, noCache);
      } else {
        const range = typeof req.headers.range === 'string' ? req.headers.range : null;
        await this.handleSegment(res, u, t, range);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error('Local relay request failed:', message);
      if (!res.headersSent) {
        this.text(res, 502, `Proxy error: ${message}`);
      }
    }
  }

  private async handlePlaylist(
    res: http.ServerResponse,
    rawUrl: string,
    loginToken: string,
    origin: string,
    noCache: boolean
  ): Promise<void> {
    const auth = this.getAuth(loginToken);
    let response: AxiosResponse;
    try {
      response = await this.fetchSigned(rawUrl, auth, { timeout: 30000 });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.text(res, 502, `Proxy error: ${message}`);
      return;
    }

    if (response.status !== 200) {
      const status = response.status === 403 ? 403 : 502;
      this.text(res, status, `Upstream playlist request failed with status ${response.status}`);
      return;
    }

    const body =
      typeof response.data === 'string' ? response.data : String(response.data ?? '');
    const rewritten = rewriteRelayM3u8(body, rawUrl, origin, loginToken, noCache);
    res.writeHead(200, {
      ...CORS,
      'Content-Type': 'application/vnd.apple.mpegurl'
    });
    res.end(rewritten);
  }

  private async handleSegment(
    res: http.ServerResponse,
    rawUrl: string,
    loginToken: string,
    range: string | null
  ): Promise<void> {
    const auth = this.getAuth(loginToken);
    let response: AxiosResponse;
    try {
      response = await this.fetchSigned(rawUrl, auth, {
        timeout: 30000,
        responseType: 'stream',
        range
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.text(res, 502, `Proxy error: ${message}`);
      return;
    }

    // Pass through media status (200/206) and selected headers; surface errors as text.
    if (response.status >= 400) {
      this.destroyStreamBody(response);
      this.text(
        res,
        response.status === 403 ? 403 : 502,
        `Upstream segment request failed with status ${response.status}`
      );
      return;
    }

    const headers: Record<string, string> = { ...CORS };
    if (response.headers['content-type']) {
      headers['Content-Type'] = String(response.headers['content-type']);
    }
    if (response.headers['content-length']) {
      headers['Content-Length'] = String(response.headers['content-length']);
    }
    if (response.headers['content-range']) {
      headers['Content-Range'] = String(response.headers['content-range']);
    }
    headers['Accept-Ranges'] = response.headers['accept-ranges']
      ? String(response.headers['accept-ranges'])
      : 'bytes';

    res.writeHead(response.status, headers);
    const stream = response.data as NodeJS.ReadableStream & { destroy?: (err?: Error) => void };
    stream.pipe(res);
    stream.on('error', (err) => {
      log.error('Segment stream error:', err);
      if (!res.writableEnded) res.destroy(err as Error);
    });
    // pipe() only unpipes (doesn't destroy the source) when the client goes
    // away, which would leave the upstream socket paused and held open.
    res.on('close', () => {
      if (!res.writableEnded) {
        try {
          stream.destroy?.();
        } catch {
          // ignore
        }
      }
    });
  }

  /**
   * Sign + fetch with 403 re-sign retries (mirrors VideoProxyService.getRecordedWithResign
   * and the Worker fetchSignedMedia loop).
   */
  private async fetchSigned(
    rawUrl: string,
    auth: ProxyAuth,
    opts: { timeout: number; responseType?: 'stream'; range?: string | null }
  ): Promise<AxiosResponse> {
    const maxRetries = 3;
    let attempt = 0;

    while (true) {
      const { requestUrl, headers } = await signRecordedUrl(
        auth,
        this.intranetMapping,
        rawUrl,
        MEDIA_HEADERS
      );
      if (opts.range) {
        headers['Range'] = opts.range;
      }

      const agents = this.resolveAgents();
      const axiosConfig = buildAxiosConfig(this.intranetMapping, agents, headers, {
        timeout: opts.timeout,
        responseType: opts.responseType
      });

      const response = await axios.get(requestUrl, axiosConfig);

      if (response.status !== 403) {
        return response;
      }

      this.destroyStreamBody(response);
      if (attempt < maxRetries) {
        attempt++;
        auth.invalidateToken();
        await this.delay(250 * attempt);
        continue;
      }

      auth.invalidateToken();
      return response;
    }
  }

  // ---- Auth / whitelist ----------------------------------------------------

  private isTokenAllowed(loginToken: string): boolean {
    if (!this.configService.getLocalRelayWhitelistEnabled()) {
      return true;
    }
    const normalized = loginToken.toLowerCase();
    const extras = this.configService.getLocalRelayTokenWhitelist();
    if (extras.includes(normalized)) {
      return true;
    }
    if (this.configService.getLocalRelayIncludeCurrentToken()) {
      const current = this.configService.getAuthToken();
      if (current && current.toLowerCase() === normalized) {
        return true;
      }
    }
    return false;
  }

  private getAuth(loginToken: string): ProxyAuth {
    let auth = this.authByToken.get(loginToken);
    if (auth) {
      // Refresh LRU position (Map preserves insertion order).
      this.authByToken.delete(loginToken);
      this.authByToken.set(loginToken, auth);
      return auth;
    }
    auth = new ProxyAuth(this.apiClient, this.configService);
    auth.setLoginToken(loginToken);
    this.authByToken.set(loginToken, auth);
    while (this.authByToken.size > MAX_AUTH_ENTRIES) {
      const oldest = this.authByToken.keys().next().value;
      if (oldest === undefined) break;
      this.authByToken.get(oldest)?.stopUpdateSignatureLoop();
      this.authByToken.delete(oldest);
    }
    return auth;
  }

  // ---- Agents / intranet bind ----------------------------------------------

  private resolveAgents(): ProxyAgents {
    let desiredIp = '';
    if (this.intranetMapping.isEnabled()) {
      const selected = this.intranetMapping.getInterfaceIp();
      if (selected && this.isInterfaceIpAvailable(selected)) {
        desiredIp = selected;
      }
    }
    if (desiredIp !== this.boundInterfaceIp) {
      this.rebuildAgents(desiredIp);
    }
    return {
      httpAgent: this.httpAgent,
      httpsAgent: this.httpsAgent,
      httpsAgentNoVerify: this.httpsAgentNoVerify
    };
  }

  private rebuildAgents(localAddress: string): void {
    try {
      this.httpAgent.destroy();
      this.httpsAgent.destroy();
      this.httpsAgentNoVerify.destroy();
    } catch {
      // ignore
    }
    const baseHttp: http.AgentOptions = { keepAlive: true };
    const baseHttps: https.AgentOptions = { keepAlive: true };
    const baseHttpsNoVerify: https.AgentOptions = { keepAlive: true, rejectUnauthorized: false };
    if (localAddress) {
      baseHttp.localAddress = localAddress;
      baseHttps.localAddress = localAddress;
      baseHttpsNoVerify.localAddress = localAddress;
    }
    this.httpAgent = new http.Agent(baseHttp);
    this.httpsAgent = new https.Agent(baseHttps);
    this.httpsAgentNoVerify = new https.Agent(baseHttpsNoVerify);
    this.boundInterfaceIp = localAddress;
  }

  private isInterfaceIpAvailable(ip: string): boolean {
    const ifaces = os.networkInterfaces();
    for (const addrs of Object.values(ifaces)) {
      if (!addrs) continue;
      for (const addr of addrs) {
        if (!addr.internal && addr.address === ip) return true;
      }
    }
    return false;
  }

  private listBindAddresses(): string[] {
    const ifaces = os.networkInterfaces();
    const out: string[] = [];
    for (const addrs of Object.values(ifaces)) {
      if (!addrs) continue;
      for (const addr of addrs) {
        if (!addr.internal && addr.family === 'IPv4') {
          out.push(addr.address);
        }
      }
    }
    return out;
  }

  // ---- Response helpers ----------------------------------------------------

  private clientOrigin(req: http.IncomingMessage): string {
    const host = req.headers.host || `127.0.0.1:${this.listeningPort || this.configService.getLocalRelayPort()}`;
    return `http://${host}`;
  }

  private applyCors(res: http.ServerResponse): void {
    for (const [k, v] of Object.entries(CORS)) {
      res.setHeader(k, v);
    }
  }

  private text(res: http.ServerResponse, status: number, body: string): void {
    res.writeHead(status, { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(body);
  }

  private destroyStreamBody(response: AxiosResponse): void {
    const data = response.data as { destroy?: () => void } | undefined;
    if (data && typeof data.destroy === 'function') {
      try {
        data.destroy();
      } catch {
        // ignore
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
