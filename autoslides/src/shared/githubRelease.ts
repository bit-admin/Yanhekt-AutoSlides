import * as https from 'https';

export interface GithubReleaseRequestOptions {
  hostname: string;
  path: string;
  method: string;
  headers: Record<string, string>;
}

export interface GithubReleaseResult {
  success: boolean;
  data?: string;
  error?: string;
}

export function fetchGithubReleaseRaw(
  options: GithubReleaseRequestOptions,
  timeoutMs = 10000
): Promise<GithubReleaseResult> {
  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          resolve({ success: false, error: `HTTP ${res.statusCode}` });
          return;
        }
        resolve({ success: true, data });
      });
    });
    req.on('error', (error) => resolve({ success: false, error: error.message }));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve({ success: false, error: 'Request timeout' });
    });
    req.end();
  });
}

export interface FetchReleaseConfig {
  primary: GithubReleaseRequestOptions;
  fallback: GithubReleaseRequestOptions;
  timeoutMs?: number;
}

export async function fetchGithubRelease(config: FetchReleaseConfig): Promise<GithubReleaseResult> {
  const result = await fetchGithubReleaseRaw(config.primary, config.timeoutMs);
  if (result.success && result.data) return result;
  const fallback = await fetchGithubReleaseRaw(config.fallback, config.timeoutMs);
  if (fallback.success && fallback.data) return fallback;
  return { success: false, error: fallback.error || result.error || 'Unknown error' };
}

export function buildGithubReleaseOptions(
  repo: string,
  userAgent: string,
  useProxy = false
): GithubReleaseRequestOptions {
  if (useProxy) {
    return {
      hostname: 'gh-proxy.org',
      path: `/https://api.github.com/repos/${repo}/releases/latest`,
      method: 'GET',
      headers: {
        'User-Agent': userAgent,
        'Accept': 'application/vnd.github.html+json'
      }
    };
  }
  return {
    hostname: 'api.github.com',
    path: `/repos/${repo}/releases/latest`,
    method: 'GET',
    headers: {
      'User-Agent': userAgent,
      'Accept': 'application/vnd.github.html+json'
    }
  };
}
