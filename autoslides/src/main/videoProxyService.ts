import * as http from 'http';
import * as url from 'url';
import axios from 'axios';
import * as crypto from 'crypto';
import * as https from 'https';
import { ApiClient } from './apiClient';
import { IntranetMappingService } from './intranetMappingService';

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

export class VideoProxyService {
  private readonly MAGIC = "1138b69dfef641d9d7ba49137d2d4875";
  private readonly BASE_HEADERS = {
    "Origin": "https://www.yanhekt.cn",
    "Referer": "https://www.yanhekt.cn/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.3"
  };

  private proxyServer: http.Server | null = null;
  private proxyPort = 0;
  private loginToken: string | null = null;
  private tokenCache: TokenCache = {
    videoToken: null,
    timestamp: null,
    signature: null,
    lastRefresh: 0,
    refreshInterval: 10000 // 10 seconds
  };
  private signatureInterval: NodeJS.Timeout | null = null;

  private apiClient: ApiClient;
  private intranetMapping: IntranetMappingService;

  constructor(apiClient: ApiClient, intranetMapping: IntranetMappingService) {
    this.apiClient = apiClient;
    this.intranetMapping = intranetMapping;
  }

  /**
   * Get video playback URLs with anti-hotlink protection for recorded videos
   */
  async getVideoPlaybackUrls(session: any, token: string): Promise<VideoPlaybackUrls> {
    try {
      // Start proxy server if not already running
      const proxyPort = await this.startVideoProxy();

      // Store the login token for dynamic token refresh
      this.loginToken = token;

      // Start signature update loop for recorded videos
      this.startUpdateSignatureLoop();

      const result: VideoPlaybackUrls = {
        session_id: session.session_id,
        video_id: session.video_id,
        title: session.title,
        duration: session.duration,
        streams: {}
      };

      // Process main video (课堂摄像头) if available
      if (session.main_url) {
        const fixedMainUrl = this.fixUrlEscaping(session.main_url);
        const proxyUrl = `http://localhost:${proxyPort}/?originalUrl=${encodeURIComponent(fixedMainUrl)}&loginToken=${encodeURIComponent(token)}`;

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
        const proxyUrl = `http://localhost:${proxyPort}/?originalUrl=${encodeURIComponent(fixedVgaUrl)}&loginToken=${encodeURIComponent(token)}`;

        result.streams.vga = {
          type: "screen",
          name: "屏幕录制",
          url: proxyUrl,
          original_url: fixedVgaUrl
        };
      }

      return result;
    } catch (error) {
      console.error('Failed to get video playback URLs:', error);
      throw error;
    }
  }

  /**
   * Fix URL escaping issues
   */
  private fixUrlEscaping(url: string): string {
    return url.replace(/\\\//g, '/');
  }

  /**
   * Get live stream playback URLs with proxy support
   */
  async getLiveStreamUrls(stream: any, token: string): Promise<VideoPlaybackUrls> {
    try {
      // Store the login token for dynamic token refresh
      this.loginToken = token;

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
      console.error('Failed to get live stream URLs:', error);
      throw error;
    }
  }

  /**
   * Start local proxy server for video streaming
   */
  private async startVideoProxy(): Promise<number> {
    if (this.proxyServer) {
      return this.proxyPort;
    }

    return new Promise((resolve, reject) => {
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
          if (pathname === '/') {
            // Initial m3u8 request with query parameters (recorded video)
            await this.handleM3u8Request(req, res, parsedUrl);
          } else if (pathname === '/live') {
            // Live stream m3u8 request
            await this.handleLiveM3u8Request(req, res, parsedUrl);
          } else {
            // Direct TS file request (from HLS.js)
            await this.handleTsRequest(req, res, parsedUrl);
          }

        } catch (error: any) {
          console.error('Proxy error details:', {
            message: error.message,
            code: error.code,
            response: error.response ? {
              status: error.response.status,
              statusText: error.response.statusText,
              data: error.response.data
            } : null
          });
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Proxy error: ' + error.message);
        }
      });

      this.proxyServer.listen(0, 'localhost', () => {
        this.proxyPort = (this.proxyServer?.address() as any)?.port || 0;
        resolve(this.proxyPort);
      });

      this.proxyServer.on('error', (error) => {
        console.error('Proxy server error:', error);
        reject(error);
      });
    });
  }

  /**
   * Handle live stream m3u8 requests
   */
  private async handleLiveM3u8Request(_req: http.IncomingMessage, res: http.ServerResponse, parsedUrl: url.UrlWithParsedQuery): Promise<void> {
    const { originalUrl, loginToken } = parsedUrl.query;

    if (!originalUrl || !loginToken) {
      console.error('Missing required parameters for live m3u8:', { originalUrl: !!originalUrl, loginToken: !!loginToken });
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing required parameters');
      return;
    }

    // Store login token for future use
    this.loginToken = loginToken as string;

    // Set proper headers for live stream request
    const liveHeaders: any = {
      ...this.BASE_HEADERS,
      "Host": this.extractHostFromUrl(originalUrl as string)
    };

    // Rewrite URL for intranet mode if needed
    const requestUrl = this.intranetMapping.rewriteUrl(originalUrl as string);

    // Add Host header if URL was rewritten
    if (requestUrl !== originalUrl) {
      const originalHost = new URL(originalUrl as string).hostname;
      liveHeaders['Host'] = originalHost;
    }

    // Create axios instance with proper configuration
    const axiosConfig: any = {
      headers: liveHeaders,
      timeout: 30000,
      validateStatus: function (status: number) {
        return status < 500; // Accept all status codes below 500
      }
    };

    // Add HTTPS agent for intranet mode if needed
    if (this.intranetMapping.isEnabled()) {
      axiosConfig.httpsAgent = new https.Agent({
        rejectUnauthorized: false
      });
    }

    // Proxy the request
    const response = await axios.get(requestUrl, axiosConfig);

    if (response.status !== 200) {
      res.writeHead(response.status, { 'Content-Type': 'text/plain' });
      res.end(`Live M3U8 request failed with status ${response.status}`);
      return;
    }

    // Get m3u8 content and process it
    let content = response.data;

    // Process m3u8 content to rewrite TS URLs to point to our proxy
    content = this.processLiveM3u8Content(content, originalUrl as string);

    // Return processed m3u8 content
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
      console.error('Missing required parameters for m3u8:', { originalUrl: !!originalUrl, loginToken: !!loginToken });
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing required parameters');
      return;
    }

    // Store login token for future use
    this.loginToken = loginToken as string;

    // Get fresh token and signature
    const tokenData = await this.refreshTokenAndSignature();

    // First encrypt the URL, then add signature
    const encryptedUrl = this.encryptURL(originalUrl as string);
    const signedUrl = this.addSignatureForUrl(encryptedUrl, tokenData.videoToken!, tokenData.timestamp!, tokenData.signature!);

    // Set proper headers for video request
    const videoHeaders: any = {
      ...this.BASE_HEADERS,
      "Host": "cvideo.yanhekt.cn"
    };

    // Rewrite URL for intranet mode if needed
    const requestUrl = this.intranetMapping.rewriteUrl(signedUrl);

    // Add Host header if URL was rewritten
    if (requestUrl !== signedUrl) {
      const originalHost = new URL(signedUrl).hostname;
      videoHeaders['Host'] = originalHost;
    }

    // Create axios instance with proper configuration
    const axiosConfig: any = {
      headers: videoHeaders,
      timeout: 30000,
      validateStatus: function (status: number) {
        return status < 500; // Accept all status codes below 500
      }
    };

    // Add HTTPS agent for intranet mode if needed
    if (this.intranetMapping.isEnabled()) {
      axiosConfig.httpsAgent = new https.Agent({
        rejectUnauthorized: false
      });
    }

    // Proxy the request
    const response = await axios.get(requestUrl, axiosConfig);

    if (response.status !== 200) {
      res.writeHead(response.status, { 'Content-Type': 'text/plain' });
      res.end(`M3U8 request failed with status ${response.status}`);
      return;
    }

    // Get m3u8 content and process it
    let content = response.data;

    // Process m3u8 content to rewrite TS URLs to point to our proxy
    content = this.processM3u8Content(content, originalUrl as string);

    // Return processed m3u8 content
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.writeHead(200);
    res.end(content);
  }

  /**
   * Handle direct TS file requests (from HLS.js)
   */
  private async handleTsRequest(_req: http.IncomingMessage, res: http.ServerResponse, parsedUrl: url.UrlWithParsedQuery): Promise<void> {
    const pathname = parsedUrl.pathname || '';
    const { baseUrl } = parsedUrl.query;

    if (!baseUrl) {
      console.error('Missing baseUrl for TS request');
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing baseUrl parameter for TS file');
      return;
    }

    // Check if this is a live stream TS request
    const isLiveStream = pathname.startsWith('/live/');

    // Construct the full TS URL
    let tsFileName: string;
    if (isLiveStream) {
      tsFileName = pathname.substring(6); // Remove '/live/' prefix
    } else {
      tsFileName = pathname.substring(1); // Remove leading slash
    }

    const tsUrl = this.resolveUrl(baseUrl as string, tsFileName);

    let requestUrl: string;
    let videoHeaders: any;

    if (isLiveStream) {
      // Live stream - no encryption/signing needed, just use original URL with intranet mapping
      requestUrl = this.intranetMapping.rewriteUrl(tsUrl);
      videoHeaders = {
        ...this.BASE_HEADERS,
        "Host": this.extractHostFromUrl(tsUrl)
      };

      // Add Host header if URL was rewritten
      if (requestUrl !== tsUrl) {
        const originalHost = new URL(tsUrl).hostname;
        videoHeaders['Host'] = originalHost;
      }

    } else {
      // Recorded video - use encryption and signing
      const tokenData = await this.refreshTokenAndSignature();

      // Encrypt and sign the TS URL with fresh token
      const encryptedUrl = this.encryptURL(tsUrl);
      const signedUrl = this.addSignatureForUrl(encryptedUrl, tokenData.videoToken!, tokenData.timestamp!, tokenData.signature!);

      // Set proper headers for video request
      videoHeaders = {
        ...this.BASE_HEADERS,
        "Host": "cvideo.yanhekt.cn"
      };

      // Rewrite URL for intranet mode if needed
      requestUrl = this.intranetMapping.rewriteUrl(signedUrl);

      // Add Host header if URL was rewritten
      if (requestUrl !== signedUrl) {
        const originalHost = new URL(signedUrl).hostname;
        videoHeaders['Host'] = originalHost;
      }

    }

    // Create axios instance with proper configuration
    const axiosConfig: any = {
      headers: videoHeaders,
      responseType: 'stream',
      timeout: 30000,
      validateStatus: function (status: number) {
        return status < 500; // Accept all status codes below 500
      }
    };

    // Add HTTPS agent for intranet mode if needed
    if (this.intranetMapping.isEnabled()) {
      axiosConfig.httpsAgent = new https.Agent({
        rejectUnauthorized: false
      });
    }

    // Proxy the request
    const response = await axios.get(requestUrl, axiosConfig);

    // Copy response headers (except CORS-related ones)
    Object.keys(response.headers).forEach(key => {
      if (!key.toLowerCase().startsWith('access-control-')) {
        res.setHeader(key, response.headers[key]);
      }
    });

    res.writeHead(response.status);
    response.data.pipe(res);
  }

  /**
   * Start signature update loop (similar to m3u8DownloadService)
   */
  private startUpdateSignatureLoop(): void {
    // Clear existing interval if any
    if (this.signatureInterval) {
      clearInterval(this.signatureInterval);
    }

    this.signatureInterval = setInterval(async () => {
      try {
        await this.refreshTokenAndSignature();
      } catch (error) {
        console.error('Error updating signature in loop:', error);
      }
    }, 10000); // Update every 10 seconds
  }

  /**
   * Stop signature update loop
   */
  private stopUpdateSignatureLoop(): void {
    if (this.signatureInterval) {
      clearInterval(this.signatureInterval);
      this.signatureInterval = null;
    }
  }

  /**
   * Get fresh token (similar to m3u8DownloadService)
   */
  private async getToken(): Promise<string> {
    if (!this.tokenCache.videoToken) {
      try {
        // Use the existing API client to get video token
        this.tokenCache.videoToken = await this.apiClient.getVideoToken(this.loginToken!);
      } catch (error) {
        console.error("Error getting token:", error);
        throw new Error("获取 Token 失败");
      }
    }
    return this.tokenCache.videoToken!;
  }

  /**
   * Refresh video token and signature (simplified version for consistent behavior)
   */
  private async refreshTokenAndSignature(): Promise<TokenCache> {
    try {
      // Always get fresh token and signature (like m3u8DownloadService)
      const videoToken = await this.getToken();
      const { timestamp, signature } = this.getSignature();

      // Update cache
      this.tokenCache = {
        ...this.tokenCache,
        videoToken,
        timestamp,
        signature,
        lastRefresh: Date.now()
      };

      return this.tokenCache;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      throw error;
    }
  }

  /**
   * Process live stream m3u8 content to rewrite TS URLs
   */
  private processLiveM3u8Content(content: string, baseUrl: string): string {
    const lines = content.split('\n');
    const result: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!line.startsWith('#') && line.trim() !== '') {
        // This is a TS file line - rewrite it to point to our proxy
        const tsFileName = line.trim();
        const proxyTsUrl = `http://localhost:${this.proxyPort}/live/${tsFileName}?baseUrl=${encodeURIComponent(baseUrl)}`;
        result.push(proxyTsUrl);
      } else {
        // Keep other lines as-is
        result.push(line);
      }
    }

    return result.join('\n');
  }

  /**
   * Process m3u8 content to rewrite TS URLs
   */
  private processM3u8Content(content: string, baseUrl: string): string {
    const lines = content.split('\n');
    const result: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!line.startsWith('#') && line.trim() !== '') {
        // This is a TS file line - rewrite it to point to our proxy
        const tsFileName = line.trim();
        const proxyTsUrl = `http://localhost:${this.proxyPort}/${tsFileName}?baseUrl=${encodeURIComponent(baseUrl)}`;
        result.push(proxyTsUrl);
      } else {
        // Keep other lines as-is
        result.push(line);
      }
    }

    return result.join('\n');
  }

  /**
   * Extract hostname from URL (helper function)
   */
  private extractHostFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      console.error('Error extracting host from URL:', url, error);
      return 'localhost'; // fallback
    }
  }

  /**
   * Resolve relative URL (helper function)
   */
  private resolveUrl(base: string, relative: string): string {
    if (relative.startsWith('http')) {
      return relative;
    }

    const baseUrl = new URL(base);

    if (relative.startsWith('/')) {
      return `${baseUrl.protocol}//${baseUrl.host}${relative}`;
    }

    const basePath = baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf('/') + 1);
    return `${baseUrl.protocol}//${baseUrl.host}${basePath}${relative}`;
  }

  /**
   * Add signature to URL for video playback
   */
  private addSignatureForUrl(url: string, videoToken: string, timestamp: string, signature: string): string {
    return `${url}?Xvideo_Token=${videoToken}&Xclient_Timestamp=${timestamp}&Xclient_Signature=${signature}&Xclient_Version=v1&Platform=yhkt_user`;
  }

  /**
   * Get signature for video requests
   */
  private getSignature(): { timestamp: string; signature: string } {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = crypto.createHash('md5').update(this.MAGIC + "_v1_" + timestamp).digest('hex');
    return { timestamp, signature };
  }

  /**
   * Encrypt URL for video requests
   */
  private encryptURL(url: string): string {
    const urlList = url.split("/");
    // Insert MD5 hash before the last segment
    const hash = crypto.createHash('md5').update(this.MAGIC + "_100").digest('hex');
    urlList.splice(-1, 0, hash);
    return urlList.join("/");
  }

  /**
   * Stop the proxy server
   */
  stopVideoProxy(): void {
    // Stop signature update loop
    this.stopUpdateSignatureLoop();

    if (this.proxyServer) {
      this.proxyServer.close();
      this.proxyServer = null;
      this.proxyPort = 0;
    }
  }
}