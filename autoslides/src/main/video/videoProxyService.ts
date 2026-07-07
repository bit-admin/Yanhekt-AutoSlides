import * as http from 'http';
import * as url from 'url';
import axios, { AxiosResponse } from 'axios';
import * as https from 'https';
import * as os from 'os';
import { ApiClient } from '@main/platform/apiClient';
import { ConfigService } from '@main/platform/configService';
import { IntranetMappingService } from '@main/platform/intranetMappingService';
import {
  fixUrlEscaping,
  extractHostFromUrl,
  resolveUrl,
  rewriteM3u8TsUrls
} from './videoProxy/urlHelpers';
import { ProxyAuth } from './videoProxy/proxyAuth';
import { signRecordedUrl, buildAxiosConfig } from './videoProxy/proxyRequest';
import { createLogger } from '@main/infra/logger';
const log = createLogger('VideoProxy');

/** Narrow an unknown catch value to the axios-ish fields this proxy logs. */
function asHttpError(error: unknown): { message: string; code?: string; response?: AxiosResponse } {
  if (axios.isAxiosError(error)) {
    return { message: error.message, code: error.code, response: error.response };
  }
  return { message: error instanceof Error ? error.message : String(error) };
}

export interface VideoStream {
  type: 'camera' | 'screen';
  name: string;
  url: string;
  original_url: string;
}

export interface VideoPlaybackUrls {
  session_id?: string;
  stream_id?: string;
  video_id?: string;
  title: string;
  duration?: string;
  streams: { [key: string]: VideoStream };
}

export interface TokenCache {
  videoToken: string | null;
  timestamp: string | null;
  signature: string | null;
  lastRefresh: number;
  refreshInterval: number;
}

// Input types for service methods
export interface LiveStreamInput {
  id?: string;
  live_id?: string;
  title: string;
  target?: string;
  target_vga?: string;
}

export interface RecordedSessionInput {
  session_id?: string;
  video_id?: string;
  title: string;
  duration?: string | number;
  main_url?: string;
  vga_url?: string;
}

export class VideoProxyService {
  private readonly BASE_HEADERS = {
    "Origin": "https://www.yanhekt.cn",
    "Referer": "https://www.yanhekt.cn/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.3"
  };

  private proxyServer: http.Server | null = null;
  private proxyPort = 0;
  // In-flight start promise. Dedupes concurrent startVideoProxy() calls so that
  // parallel tasks/playback tabs don't race: the server is created synchronously
  // (making proxyServer truthy) while listen() resolves the port asynchronously,
  // so a second caller arriving in that window would otherwise read proxyPort=0.
  private proxyStartPromise: Promise<number> | null = null;
  private httpAgent: http.Agent = new http.Agent({ keepAlive: true });
  private httpsAgent: https.Agent = new https.Agent({ keepAlive: true });
  private httpsAgentNoVerify: https.Agent = new https.Agent({ keepAlive: true, rejectUnauthorized: false });
  // Track the local IP the agents are currently bound to ('' means unbound / system default).
  private boundInterfaceIp = '';

  // Reference counting for independent mode support
  private activeClients: Set<string> = new Set();
  private clientIdCounter = 0;

  private intranetMapping: IntranetMappingService;
  private apiClient: ApiClient;
  private configService: ConfigService;
  // One ProxyAuth (login token + video-token cache + signature loop) PER account
  // login token, keyed by the token. Recorded/live stream URLs embed their own
  // loginToken (in the m3u8 URL, and now in the rewritten TS URLs), so each stream
  // signs with the token of the account that opened it. This is what lets an
  // account switch — or a second concurrent stream on a different account — proceed
  // without the streams clobbering each other's video token (the old single shared
  // ProxyAuth caused cross-account 403s). Cleared only when the proxy goes idle.
  private authByToken = new Map<string, ProxyAuth>();

  constructor(apiClient: ApiClient, intranetMapping: IntranetMappingService, configService: ConfigService) {
    this.intranetMapping = intranetMapping;
    this.apiClient = apiClient;
    this.configService = configService;

    // Proactively invalidate bound agents when the user changes the selected
    // intranet interface IP in Advanced Settings.
    this.intranetMapping.on('interfaceIpChanged', () => {
      this.rebuildAgents('');
    });
  }

  /**
   * Get (or lazily create) the ProxyAuth for a given account login token. Each
   * instance owns that account's video-token cache + signature refresh loop, so
   * concurrent streams on different accounts never share signing state.
   */
  private getAuth(loginToken: string): ProxyAuth {
    let auth = this.authByToken.get(loginToken);
    if (!auth) {
      auth = new ProxyAuth(this.apiClient, this.configService);
      auth.setLoginToken(loginToken);
      this.authByToken.set(loginToken, auth);
    }
    return auth;
  }

  /** Stop every per-token signature loop (per-request signing still refreshes on
   * demand, so this only pauses the warm-keeper — safe for any still-live stream). */
  private stopAllSignatureLoops(): void {
    for (const auth of this.authByToken.values()) {
      auth.stopUpdateSignatureLoop();
    }
  }

  /**
   * Return HTTP(S) agents to use for the current request. When intranet mode is
   * enabled and a bind IP has been selected, the agents bind outbound sockets to
   * that local address via Node's `localAddress`. When the IP is no longer
   * present on any interface (NIC unplugged, VPN disconnected), fall back to
   * unbound agents to avoid EADDRNOTAVAIL.
   */
  private resolveAgents(): { httpAgent: http.Agent; httpsAgent: https.Agent; httpsAgentNoVerify: https.Agent } {
    let desiredIp = '';
    if (this.intranetMapping.isEnabled()) {
      const selected = this.intranetMapping.getInterfaceIp();
      if (selected && this.isInterfaceIpAvailable(selected)) {
        desiredIp = selected;
      } else if (selected) {
        log.warn(`[videoProxy] Selected intranet interface IP ${selected} is not currently available; falling back to system default.`);
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
      // Ignore destroy errors on stale agents.
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

  /**
   * Register a new client and return client ID for reference counting
   */
  registerClient(): string {
    const clientId = `client_${++this.clientIdCounter}_${Date.now()}`;
    this.activeClients.add(clientId);
    log.debug(`Video proxy client registered: ${clientId} (total: ${this.activeClients.size})`);
    return clientId;
  }

  /**
   * Unregister a client and stop proxy if no clients remain
   */
  unregisterClient(clientId: string): void {
    if (this.activeClients.has(clientId)) {
      this.activeClients.delete(clientId);
      log.debug(`Video proxy client unregistered: ${clientId} (remaining: ${this.activeClients.size})`);

      // Only stop proxy if no clients remain
      if (this.activeClients.size === 0) {
        log.debug('No active clients remaining, stopping video proxy');
        this.forceStopVideoProxy();
      }
    }
  }

  /**
   * Get video playback URLs with anti-hotlink protection for recorded videos
   */
  async getVideoPlaybackUrls(session: RecordedSessionInput, token: string): Promise<VideoPlaybackUrls> {
    try {
      // Start proxy server if not already running
      const proxyPort = await this.startVideoProxy();

      // Get (or create) this account's ProxyAuth and start its signature loop
      // (recorded videos keep the token warm; other accounts' loops are untouched).
      this.getAuth(token).startUpdateSignatureLoop();

      const result: VideoPlaybackUrls = {
        session_id: session.session_id,
        video_id: session.video_id,
        title: session.title,
        duration: session.duration !== undefined ? String(session.duration) : undefined,
        streams: {}
      };

      // Process main video (课堂摄像头) if available
      if (session.main_url) {
        const fixedMainUrl = this.fixUrlEscaping(session.main_url);
        const proxyUrl = `http://localhost:${proxyPort}/recorded?originalUrl=${encodeURIComponent(fixedMainUrl)}&loginToken=${encodeURIComponent(token)}`;

        result.streams.main = {
          type: "camera",
          name: "课堂摄像头",
          url: proxyUrl,
          original_url: fixedMainUrl
        };
      }

      // Process VGA video (屏幕录制) if available
      if (session.vga_url) {
        const fixedVgaUrl = this.fixUrlEscaping(session.vga_url);
        const proxyUrl = `http://localhost:${proxyPort}/recorded?originalUrl=${encodeURIComponent(fixedVgaUrl)}&loginToken=${encodeURIComponent(token)}`;

        result.streams.vga = {
          type: "screen",
          name: "屏幕录制",
          url: proxyUrl,
          original_url: fixedVgaUrl
        };
      }

      return result;
    } catch (error) {
      log.error('Failed to get video playback URLs:', error);
      throw error;
    }
  }

  private fixUrlEscaping(url: string): string {
    return fixUrlEscaping(url);
  }

  /**
   * Get live stream playback URLs with proxy support
   */
  async getLiveStreamUrls(stream: LiveStreamInput, token: string): Promise<VideoPlaybackUrls> {
    try {
      // Ensure this account's ProxyAuth exists (live needs no signature loop).
      this.getAuth(token);

      const result: VideoPlaybackUrls = {
        stream_id: stream.id || stream.live_id,
        title: stream.title,
        streams: {}
      };

      // Check if intranet mode is enabled
      const useProxy = this.intranetMapping.isEnabled();

      if (useProxy) {
        // Intranet mode: use proxy with IP mapping
        const proxyPort = await this.startVideoProxy();

        // Process main camera stream (target) if available
        if (stream.target) {
          const fixedTarget = this.fixUrlEscaping(stream.target);
          const proxyUrl = `http://localhost:${proxyPort}/live?originalUrl=${encodeURIComponent(fixedTarget)}&loginToken=${encodeURIComponent(token)}`;

          result.streams.camera = {
            type: "camera",
            name: "课堂摄像头",
            url: proxyUrl,
            original_url: fixedTarget
          };
        }

        // Process screen recording stream (target_vga) if available
        if (stream.target_vga) {
          const fixedTargetVga = this.fixUrlEscaping(stream.target_vga);
          const proxyUrl = `http://localhost:${proxyPort}/live?originalUrl=${encodeURIComponent(fixedTargetVga)}&loginToken=${encodeURIComponent(token)}`;

          result.streams.screen = {
            type: "screen",
            name: "屏幕录制",
            url: proxyUrl,
            original_url: fixedTargetVga
          };
        }
      } else {
        // External mode: direct HLS playback

        // Process main camera stream (target) if available
        if (stream.target) {
          const fixedTarget = this.fixUrlEscaping(stream.target);

          result.streams.camera = {
            type: "camera",
            name: "课堂摄像头",
            url: fixedTarget,
            original_url: fixedTarget
          };
        }

        // Process screen recording stream (target_vga) if available
        if (stream.target_vga) {
          const fixedTargetVga = this.fixUrlEscaping(stream.target_vga);

          result.streams.screen = {
            type: "screen",
            name: "屏幕录制",
            url: fixedTargetVga,
            original_url: fixedTargetVga
          };
        }
      }

      return result;
    } catch (error) {
      log.error('Failed to get live stream URLs:', error);
      throw error;
    }
  }

  /**
   * Start local proxy server for video streaming
   */
  private async startVideoProxy(): Promise<number> {
    // Already listening with a real port — reuse it.
    if (this.proxyServer && this.proxyPort) {
      return this.proxyPort;
    }

    // A start is already in flight (server created, listen() not yet resolved).
    // Await the same promise instead of returning a half-initialized port of 0.
    if (this.proxyStartPromise) {
      return this.proxyStartPromise;
    }

    this.proxyStartPromise = new Promise<number>((resolve, reject) => {
      this.proxyServer = http.createServer(async (req, res) => {
        // Set CORS headers for all requests
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        // Handle CORS preflight requests
        if (req.method === 'OPTIONS') {
          res.writeHead(200);
          res.end();
          return;
        }

        try {
          const parsedUrl = url.parse(req.url || '', true);
          const pathname = parsedUrl.pathname || '';


          // Handle different types of requests
          if (pathname === '/recorded') {
            // Initial m3u8 request with query parameters (recorded video)
            await this.handleM3u8Request(req, res, parsedUrl);
          } else if (pathname === '/live') {
            // Live stream m3u8 request
            await this.handleLiveM3u8Request(req, res, parsedUrl);
          } else {
            // Direct TS file request (from HLS.js)
            await this.handleTsRequest(req, res, parsedUrl);
          }

        } catch (error: unknown) {
          const httpError = asHttpError(error);
          log.error('Proxy error details:', {
            message: httpError.message,
            code: httpError.code,
            response: httpError.response ? {
              status: httpError.response.status,
              statusText: httpError.response.statusText,
              data: httpError.response.data
            } : null
          });
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Proxy error: ' + httpError.message);
        }
      });

      this.proxyServer.listen(0, 'localhost', () => {
        this.proxyPort = (this.proxyServer?.address() as any)?.port || 0;
        resolve(this.proxyPort);
      });

      this.proxyServer.on('error', (error) => {
        log.error('Proxy server error:', error);
        reject(error);
      });
    });

    try {
      return await this.proxyStartPromise;
    } catch (error) {
      // Let a future call retry from scratch on a failed start.
      this.proxyServer = null;
      this.proxyPort = 0;
      throw error;
    } finally {
      this.proxyStartPromise = null;
    }
  }

  /**
   * Mark the IP behind `requestUrl` as failed for `originalUrl`'s domain so the
   * intranet round-robin advances to the next IP. Parse errors are ignored.
   */
  private markIpFailedForUrl(requestUrl: string, originalUrl: string): void {
    try {
      const urlObj = new URL(requestUrl);
      const domain = new URL(originalUrl).hostname;
      this.intranetMapping.markIPFailed(urlObj.hostname, domain);
    } catch (_e) {
      // Ignore URL parsing errors
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Discard an undrained upstream body. With keep-alive agents an unconsumed
   * stream (e.g. a 403 we are about to retry or surface) would otherwise pin the
   * socket. No-op for buffered (string) bodies.
   */
  private destroyStreamBody(response: AxiosResponse, responseType?: 'stream'): void {
    if (responseType !== 'stream') return;
    try {
      response.data?.destroy?.();
    } catch {
      // Ignore — best-effort cleanup.
    }
  }

  /**
   * GET a recorded-video URL (m3u8 or TS) with anti-hotlink signing and 403
   * re-sign retry. Each attempt fetches a fresh token + signature.
   *
   * axios is configured with `validateStatus < 500`, so a 403 arrives as a
   * RESOLVED response — we branch on `response.status`, not on a thrown error
   * (the original code only retried 403s that happened to throw, so TS 403s were
   * never retried and persistent-403 token invalidation almost never fired). On
   * 403 we re-sign and retry with linear backoff; once retries are exhausted we
   * invalidate the cached token so the next playback starts fresh and return the
   * final 403 for the caller to surface. Network errors / 5xx (which axios
   * throws) propagate to the caller.
   */
  private async getRecordedWithResign(
    rawUrl: string,
    opts: { timeout: number; responseType?: 'stream' },
    auth: ProxyAuth
  ): Promise<AxiosResponse> {
    const maxRetries = 3;
    let attempt = 0;

    while (true) {
      const { requestUrl, headers } = await signRecordedUrl(
        auth, this.intranetMapping, rawUrl, this.BASE_HEADERS
      );
      const agents = this.resolveAgents();
      const axiosConfig = buildAxiosConfig(this.intranetMapping, agents, headers, opts);

      const response = await axios.get(requestUrl, axiosConfig);

      if (response.status !== 403) {
        return response; // 200 (serve) or other status (caller surfaces it)
      }

      // 403: the signature/token was rejected. Re-sign and retry, or give up.
      this.destroyStreamBody(response, opts.responseType);
      if (attempt < maxRetries) {
        attempt++;
        log.debug(`Recorded request got 403, re-signing and retrying (${attempt}/${maxRetries}) for: ${rawUrl}`);
        await this.delay(1000 * attempt);
        continue;
      }

      log.debug('Clearing token cache due to persistent recorded 403 errors');
      auth.invalidateToken();
      return response; // exhausted — caller surfaces the 403
    }
  }

  /**
   * GET a live-stream URL (m3u8 or TS) with intranet IP failover. Live streams
   * need no signing. Each attempt round-robins to the next available IP via
   * `rewriteUrl`; on failure we mark the IP we ACTUALLY USED (captured before the
   * request) as failed — the original code re-rewrote the URL first, advancing
   * the round-robin and marking the wrong IP. Returns the final response (caller
   * surfaces non-200) or throws after exhausting retries on network errors.
   */
  private async getLiveWithFailover(
    rawUrl: string,
    headers: Record<string, string>,
    opts: { timeout: number; responseType?: 'stream' }
  ): Promise<AxiosResponse> {
    const maxRetries = 3;
    let attempt = 0;

    while (true) {
      const requestUrl = this.intranetMapping.rewriteUrl(rawUrl);
      const agents = this.resolveAgents();
      const axiosConfig = buildAxiosConfig(this.intranetMapping, agents, headers, opts);

      try {
        const response = await axios.get(requestUrl, axiosConfig);
        if (response.status === 200) {
          return response;
        }
        // Non-200: fail over to the next IP (intranet only), else surface it.
        if (this.intranetMapping.isEnabled() && attempt < maxRetries) {
          this.markIpFailedForUrl(requestUrl, rawUrl);
          this.destroyStreamBody(response, opts.responseType);
          attempt++;
          log.debug(`Live request got status ${response.status}, trying next IP (${attempt}/${maxRetries})`);
          continue;
        }
        return response;
      } catch (error: unknown) {
        if (this.intranetMapping.isEnabled()) {
          this.markIpFailedForUrl(requestUrl, rawUrl);
        }
        if (attempt < maxRetries) {
          attempt++;
          log.debug(`Live request failed, trying next IP (${attempt}/${maxRetries}):`, asHttpError(error).message);
          await this.delay(500);
          continue;
        }
        throw error;
      }
    }
  }

  /**
   * Pipe a successful upstream TS response to the client, or surface a non-200
   * status as a plain error (never pipe an error body as if it were segment data).
   */
  private pipeUpstream(res: http.ServerResponse, response: AxiosResponse): void {
    if (response.status !== 200) {
      this.destroyStreamBody(response, 'stream');
      res.writeHead(response.status, { 'Content-Type': 'text/plain' });
      res.end(`TS request failed with status ${response.status}`);
      return;
    }

    Object.keys(response.headers).forEach(key => {
      if (!key.toLowerCase().startsWith('access-control-')) {
        res.setHeader(key, response.headers[key] as string);
      }
    });

    res.writeHead(response.status);
    response.data.pipe(res);
  }

  /**
   * Handle live stream m3u8 requests
   */
  private async handleLiveM3u8Request(_req: http.IncomingMessage, res: http.ServerResponse, parsedUrl: url.UrlWithParsedQuery): Promise<void> {
    const { originalUrl, loginToken } = parsedUrl.query;

    if (!originalUrl || !loginToken) {
      log.error('Missing required parameters for live m3u8:', { originalUrl: !!originalUrl, loginToken: !!loginToken });
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing required parameters');
      return;
    }

    // Resolve this account's ProxyAuth (live needs no signing, but ensures the
    // instance exists for lifecycle symmetry).
    this.getAuth(loginToken as string);

    // Set proper headers for live stream request. Under intranet mode the URL is
    // rewritten to an IP, so Host must carry the original hostname.
    const liveHeaders: Record<string, string> = {
      ...this.BASE_HEADERS,
      "Host": this.extractHostFromUrl(originalUrl as string)
    };
    if (this.intranetMapping.isEnabled()) {
      liveHeaders['Host'] = new URL(originalUrl as string).hostname;
    }

    let response: AxiosResponse;
    try {
      response = await this.getLiveWithFailover(originalUrl as string, liveHeaders, {
        timeout: this.intranetMapping.isEnabled() ? 8000 : 30000 // 8s for intranet, 30s for external
      });
    } catch (error: unknown) {
      const httpError = asHttpError(error);
      log.error('Live M3U8 request failed after retries:', {
        message: httpError.message,
        code: httpError.code,
        originalUrl
      });
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end(`Live M3U8 request failed: ${httpError.message}`);
      return;
    }

    if (response.status !== 200) {
      res.writeHead(response.status, { 'Content-Type': 'text/plain' });
      res.end(`Live M3U8 request failed with status ${response.status}`);
      return;
    }

    // Process m3u8 content to rewrite TS URLs to point to our proxy (carrying the
    // account's loginToken so each TS request signs with the right account).
    const content = this.processLiveM3u8Content(response.data, originalUrl as string, loginToken as string);
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.writeHead(200);
    res.end(content);
  }

  /**
   * Handle m3u8 requests with query parameters (recorded videos)
   */
  private async handleM3u8Request(_req: http.IncomingMessage, res: http.ServerResponse, parsedUrl: url.UrlWithParsedQuery): Promise<void> {
    const { originalUrl, loginToken } = parsedUrl.query;

    if (!originalUrl || !loginToken) {
      log.error('Missing required parameters for m3u8:', { originalUrl: !!originalUrl, loginToken: !!loginToken });
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing required parameters');
      return;
    }

    // Resolve this account's ProxyAuth so recorded signing uses its own token.
    const auth = this.getAuth(loginToken as string);

    let response: AxiosResponse;
    try {
      response = await this.getRecordedWithResign(originalUrl as string, { timeout: 30000 }, auth);
    } catch (error: unknown) {
      const httpError = asHttpError(error);
      log.error('M3U8 request failed:', {
        status: httpError.response?.status,
        message: httpError.message,
        url: originalUrl
      });
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`M3U8 request failed: ${httpError.message}`);
      return;
    }

    if (response.status !== 200) {
      res.writeHead(response.status, { 'Content-Type': 'text/plain' });
      res.end(`M3U8 request failed with status ${response.status}`);
      return;
    }

    // Process m3u8 content to rewrite TS URLs to point to our proxy (carrying the
    // account's loginToken so each TS request signs with the right account).
    const content = this.processM3u8Content(response.data, originalUrl as string, loginToken as string);
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.writeHead(200);
    res.end(content);
  }

  /**
   * Handle direct TS file requests (from HLS.js)
   */
  private async handleTsRequest(_req: http.IncomingMessage, res: http.ServerResponse, parsedUrl: url.UrlWithParsedQuery): Promise<void> {
    const pathname = parsedUrl.pathname || '';
    const { baseUrl, loginToken } = parsedUrl.query;

    if (!baseUrl) {
      log.error('Missing baseUrl for TS request');
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing baseUrl parameter for TS file');
      return;
    }

    // Check if this is a live stream TS request or recorded stream TS request
    const isLiveStream = pathname.startsWith('/live/');
    const isRecordedStream = pathname.startsWith('/recorded/');

    // Construct the full TS URL
    let tsFileName: string;
    if (isLiveStream) {
      tsFileName = pathname.substring(6); // Remove '/live/' prefix
    } else if (isRecordedStream) {
      tsFileName = pathname.substring(10); // Remove '/recorded/' prefix
    } else {
      // Fallback for backward compatibility (should not happen with new URLs)
      tsFileName = pathname.substring(1); // Remove leading slash
    }

    const tsUrl = this.resolveUrl(baseUrl as string, tsFileName);

    if (isLiveStream) {
      // Live stream — no signing; round-robin IP failover only.
      const headers: Record<string, string> = {
        ...this.BASE_HEADERS,
        "Host": this.extractHostFromUrl(tsUrl)
      };
      if (this.intranetMapping.isEnabled()) {
        try {
          headers['Host'] = new URL(tsUrl).hostname;
        } catch {
          // Keep the extractHostFromUrl value if parsing fails.
        }
      }

      let response: AxiosResponse;
      try {
        response = await this.getLiveWithFailover(tsUrl, headers, { timeout: 30000, responseType: 'stream' });
      } catch (error: unknown) {
        const httpError = asHttpError(error);
        log.error('Live TS request failed after retries:', {
          message: httpError.message,
          code: httpError.code,
          url: tsUrl
        });
        throw error; // Surfaced as a 500 by the server handler.
      }
      this.pipeUpstream(res, response);
      return;
    }

    // Recorded video (and the legacy fallback) — encrypt + sign with 403 re-sign,
    // using the ProxyAuth for the account that opened this stream (loginToken from
    // the TS URL). Missing token (legacy URL) falls back to a fresh instance.
    const auth = this.getAuth((loginToken as string) ?? '');
    let response: AxiosResponse;
    try {
      response = await this.getRecordedWithResign(tsUrl, { timeout: 30000, responseType: 'stream' }, auth);
    } catch (error: unknown) {
      const httpError = asHttpError(error);
      log.error('Recorded TS request failed:', {
        status: httpError.response?.status,
        message: httpError.message,
        url: tsUrl
      });
      throw error; // Surfaced as a 500 by the server handler.
    }
    this.pipeUpstream(res, response);
  }

  private processLiveM3u8Content(content: string, baseUrl: string, loginToken: string): string {
    return rewriteM3u8TsUrls(content, this.proxyPort, baseUrl, 'live', loginToken);
  }

  private processM3u8Content(content: string, baseUrl: string, loginToken: string): string {
    return rewriteM3u8TsUrls(content, this.proxyPort, baseUrl, 'recorded', loginToken);
  }

  private extractHostFromUrl(url: string): string {
    return extractHostFromUrl(url);
  }

  private resolveUrl(base: string, relative: string): string {
    return resolveUrl(base, relative);
  }

  /**
   * Stop the proxy server (deprecated - use unregisterClient instead)
   * This method is kept for backward compatibility but now logs a warning
   */
  stopVideoProxy(): void {
    log.warn('stopVideoProxy() called - this method is deprecated for independent mode support');
    log.warn('Use unregisterClient() instead to properly manage proxy lifecycle');

    // For backward compatibility, we'll force stop if called directly
    // But this breaks independence, so it should be avoided
    this.forceStopVideoProxy();
  }

  /**
   * Stop only the signature update loop (called when playback ends)
   * This stops token refresh without stopping the proxy server
   */
  stopSignatureLoop(): void {
    log.debug('Stopping signature update loops (playback ended)');
    // Pause every account's warm-keeper. Any still-live stream keeps working via
    // per-request on-demand signing; instances are retained (not cleared) so a
    // concurrent stream doesn't lose its cached video token.
    this.stopAllSignatureLoops();
  }

  /**
   * Stop the signature loop only when no playback client is active. One-shot
   * consumers (e.g. thumbnail generation) start the loop via getVideoPlaybackUrls
   * but must not leave it refreshing forever, nor kill it out from under an
   * in-progress playback. Per-request signing still refreshes the token on
   * demand, so an idle stop is safe.
   */
  stopSignatureLoopIfIdle(): void {
    if (this.activeClients.size === 0) {
      // Fully idle: stop every loop and drop the per-token instances so the map
      // doesn't accumulate stale tokens across sessions.
      this.stopAllSignatureLoops();
      this.authByToken.clear();
    }
  }

  /**
   * Force stop the proxy server (internal method)
   */
  private forceStopVideoProxy(): void {
    // Stop every per-token signature loop and drop the instances.
    this.stopAllSignatureLoops();
    this.authByToken.clear();

    if (this.proxyServer) {
      this.proxyServer.close();
      this.proxyServer = null;
      this.proxyPort = 0;
      this.proxyStartPromise = null;
      log.debug('Video proxy server stopped');
    }

    // Destroy keep-alive agents to close idle sockets
    this.httpAgent.destroy();
    this.httpsAgent.destroy();
    this.httpsAgentNoVerify.destroy();

    // Clear all active clients
    this.activeClients.clear();
  }
}