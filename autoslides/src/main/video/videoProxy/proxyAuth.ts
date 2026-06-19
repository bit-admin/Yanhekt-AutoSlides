import { ApiClient } from '@main/platform/apiClient';
import {
  encryptVideoUrl,
  getVideoSignature,
  addSignatureToUrl
} from '@common/crypto';
import type { TokenCache } from '../videoProxyService';
import { createLogger } from '@main/infra/logger';
const log = createLogger('ProxyAuth');

/**
 * Owns the video-token / signature lifecycle for the proxy: the cached video
 * token, the periodic refresh loop, and the URL signing/encryption helpers.
 * Extracted verbatim from VideoProxyService — behavior is unchanged; the proxy
 * service now delegates here instead of holding the token state itself.
 */
export class ProxyAuth {
  loginToken: string | null = null;

  readonly tokenCache: TokenCache = {
    videoToken: null,
    timestamp: null,
    signature: null,
    lastRefresh: 0,
    refreshInterval: 10000 // 10 seconds
  };

  private signatureInterval: NodeJS.Timeout | null = null;

  /**
   * In-flight token fetch shared by concurrent callers. Without this, two
   * proxy requests that both miss the cache would each call getVideoToken,
   * issuing redundant API requests for the same token.
   */
  private tokenFetchInFlight: Promise<string> | null = null;

  constructor(private apiClient: ApiClient) {}

  setLoginToken(token: string): void {
    this.loginToken = token;
  }

  /** Drop the cached video token so the next request fetches a fresh one. */
  invalidateToken(): void {
    this.tokenCache.videoToken = null;
  }

  getSignature(): { timestamp: string; signature: string } {
    return getVideoSignature();
  }

  encryptURL(url: string): string {
    return encryptVideoUrl(url);
  }

  addSignatureForUrl(url: string, videoToken: string, timestamp: string, signature: string): string {
    return addSignatureToUrl(url, videoToken, timestamp, signature);
  }

  /**
   * Get fresh token (similar to m3u8DownloadService) - ALWAYS refresh
   */
  private async getToken(): Promise<string> {
    // Coalesce concurrent fetches so simultaneous cache-miss requests share a
    // single getVideoToken call instead of each hitting the API.
    if (this.tokenFetchInFlight) {
      return this.tokenFetchInFlight;
    }

    this.tokenFetchInFlight = (async () => {
      try {
        // ALWAYS get fresh token (like m3u8DownloadService does)
        log.debug('Getting fresh video token...');
        const token = await this.apiClient.getVideoToken(this.loginToken!);
        this.tokenCache.videoToken = token;
        return token;
      } catch (error) {
        log.error("Error getting fresh token:", error);
        throw new Error("Failed to get video token");
      } finally {
        this.tokenFetchInFlight = null;
      }
    })();

    return this.tokenFetchInFlight;
  }

  /**
   * Refresh video token and signature (with caching to avoid excessive API calls)
   */
  async refreshTokenAndSignature(): Promise<TokenCache> {
    try {
      const now = Date.now();
      const timeSinceLastRefresh = now - this.tokenCache.lastRefresh;

      // Return cached token if still valid (within refresh interval)
      if (this.tokenCache.videoToken && timeSinceLastRefresh < this.tokenCache.refreshInterval) {
        // Still update signature for each request (signature is local, no API call)
        const { timestamp, signature } = this.getSignature();
        this.tokenCache.timestamp = timestamp;
        this.tokenCache.signature = signature;
        return this.tokenCache;
      }

      // Token expired or not cached, get fresh token
      const videoToken = await this.getToken();
      const { timestamp, signature } = this.getSignature();

      // Update cache
      Object.assign(this.tokenCache, {
        videoToken,
        timestamp,
        signature,
        lastRefresh: Date.now()
      });

      return this.tokenCache;
    } catch (error) {
      log.error('Failed to refresh token:', error);
      throw error;
    }
  }

  /**
   * Start signature update loop (similar to m3u8DownloadService)
   */
  startUpdateSignatureLoop(): void {
    // Clear existing interval if any
    if (this.signatureInterval) {
      clearInterval(this.signatureInterval);
    }

    this.signatureInterval = setInterval(async () => {
      try {
        await this.refreshTokenAndSignature();
      } catch (error) {
        log.error('Error updating signature in loop:', error);
      }
    }, 10000); // Update every 10 seconds
  }

  /**
   * Stop signature update loop
   */
  stopUpdateSignatureLoop(): void {
    if (this.signatureInterval) {
      clearInterval(this.signatureInterval);
      this.signatureInterval = null;
    }
  }
}
