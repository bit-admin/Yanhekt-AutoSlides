import axios from 'axios';

const GITHUB_CLIENT_ID = 'Iv1.b507a08c87ecfe98';

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface OAuthTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
  interval?: number;
}

interface CopilotTokenResponse {
  token: string;
  expires_at: number; // Unix timestamp
  // other fields omitted
}

interface GitHubUser {
  login: string;
  avatar_url: string;
  name?: string;
}

export class CopilotService {
  private cachedToken: CopilotTokenResponse | null = null;

  /**
   * Request a device code for OAuth device flow
   */
  async requestDeviceCode(): Promise<DeviceCodeResponse> {
    const response = await axios.post<DeviceCodeResponse>(
      'https://github.com/login/device/code',
      {
        client_id: GITHUB_CLIENT_ID,
        scope: 'read:user'
      },
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );
    return response.data;
  }

  /**
   * Poll GitHub for OAuth access token after user enters device code
   */
  async pollForAccessToken(deviceCode: string, interval: number): Promise<string> {
    let pollInterval = Math.max(interval, 5) * 1000; // Convert to ms, minimum 5s

    const maxAttempts = 60; // ~5 min max with 5s interval
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      try {
        const response = await axios.post<OAuthTokenResponse>(
          'https://github.com/login/oauth/access_token',
          {
            client_id: GITHUB_CLIENT_ID,
            device_code: deviceCode,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
          },
          {
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            timeout: 15000
          }
        );

        const data = response.data;

        if (data.access_token) {
          return data.access_token;
        }

        if (data.error === 'authorization_pending') {
          continue;
        }

        if (data.error === 'slow_down') {
          // Increase interval by 5 seconds as per spec
          pollInterval += 5000;
          continue;
        }

        if (data.error === 'expired_token') {
          throw new Error('expired_token');
        }

        if (data.error === 'access_denied') {
          throw new Error('access_denied');
        }

        throw new Error(data.error || 'unknown_error');
      } catch (error) {
        if (error instanceof Error && ['expired_token', 'access_denied', 'unknown_error'].includes(error.message)) {
          throw error;
        }
        // Network errors — continue polling
        console.error('[Copilot] Poll error:', error);
      }
    }

    throw new Error('expired_token');
  }

  /**
   * Exchange a gho_ token for a Copilot API token via the internal endpoint.
   * Caches the result and returns cached token if still valid (>5 min to expiry).
   */
  async exchangeToken(ghoToken: string): Promise<CopilotTokenResponse> {
    // Return cached token if still valid (more than 5 min to expiry)
    if (this.cachedToken) {
      const now = Math.floor(Date.now() / 1000);
      if (this.cachedToken.expires_at - now > 300) {
        return this.cachedToken;
      }
    }

    const response = await axios.get<CopilotTokenResponse>(
      'https://api.github.com/copilot_internal/v2/token',
      {
        headers: {
          'Authorization': `token ${ghoToken}`,
          'Accept': 'application/json',
          'Editor-Version': 'Neovim/0.6.1',
          'Editor-Plugin-Version': 'copilot.vim/1.16.0',
          'User-Agent': 'GithubCopilot/1.155.0'
        },
        timeout: 15000
      }
    );

    this.cachedToken = response.data;
    console.log('[Copilot] Token exchanged, expires_at:', response.data.expires_at);
    return response.data;
  }

  /**
   * Convenience: get just the API token string (with caching)
   */
  async getApiToken(ghoToken: string): Promise<string> {
    const tokenResponse = await this.exchangeToken(ghoToken);
    return tokenResponse.token;
  }

  /**
   * Build the full header set required for Copilot API requests
   */
  buildCopilotHeaders(apiToken: string, hasImages: boolean): Record<string, string> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
      'Copilot-Integration-Id': 'vscode-chat',
      'User-Agent': 'GitHubCopilotChat/0.26.7',
      'Editor-Version': 'vscode/1.104.1',
      'Editor-Plugin-Version': 'copilot-chat/0.26.7'
    };

    if (hasImages) {
      headers['Copilot-Vision-Request'] = 'true';
    }

    return headers;
  }

  /**
   * Get GitHub user info for display
   */
  async getUserInfo(ghoToken: string): Promise<GitHubUser> {
    const response = await axios.get<GitHubUser>(
      'https://api.github.com/user',
      {
        headers: {
          'Authorization': `token ${ghoToken}`,
          'Accept': 'application/json',
          'User-Agent': 'AutoSlides'
        },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Validate a gho_ token by attempting to get user info
   */
  async validateGhoToken(ghoToken: string): Promise<boolean> {
    try {
      await this.getUserInfo(ghoToken);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear cached Copilot API token
   */
  clearCache(): void {
    this.cachedToken = null;
  }
}
