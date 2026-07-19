// GitHub Copilot auth client, backed by the copilot-proxy Worker at
// copilot.ruc.edu.kg. The proxy runs GitHub's device flow server-side and
// exposes it as three CORS-enabled JSON endpoints; the resulting gho_/ghu_
// user token is the long-lived credential the OpenAI-compatible endpoints
// accept as the Bearer key (the proxy handles the internal Copilot token
// exchange). Web analogue of autoslides/src/main/ai/copilotService.ts.

export const COPILOT_PROXY_BASE_URL = 'https://copilot.ruc.edu.kg';

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface CopilotUser {
  login: string;
  avatar_url: string;
  name?: string;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${COPILOT_PROXY_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json()) as T;
  if (!response.ok) {
    const message = (data as { error?: { message?: string } })?.error?.message;
    throw new Error(message || `HTTP ${response.status}`);
  }
  return data;
}

export function requestDeviceCode(): Promise<DeviceCodeResponse> {
  return postJson<DeviceCodeResponse>('/api/auth/device');
}

interface PollResponse {
  access_token?: string;
  user?: CopilotUser;
  error?: string;
}

/**
 * Poll until the user authorizes the device code. Client-driven cadence:
 * honors `interval`, adds 5s on `slow_down`, throws 'expired_token' /
 * 'access_denied' (matching desktop's error strings so the composable's
 * message mapping ports unchanged). Rejects with AbortError when aborted.
 */
export async function pollForAccessToken(
  deviceCode: DeviceCodeResponse,
  signal?: AbortSignal,
): Promise<{ token: string; user?: CopilotUser }> {
  let intervalMs = Math.max(deviceCode.interval, 5) * 1000;
  const deadline = Date.now() + deviceCode.expires_in * 1000;

  for (;;) {
    await sleep(intervalMs, signal);
    if (Date.now() > deadline) throw new Error('expired_token');

    const result = await postJson<PollResponse>('/api/auth/poll', {
      device_code: deviceCode.device_code,
    });
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    if (result.access_token) {
      return { token: result.access_token, user: result.user };
    }
    switch (result.error) {
      case 'authorization_pending':
        continue;
      case 'slow_down':
        intervalMs += 5000;
        continue;
      case 'expired_token':
      case 'access_denied':
        throw new Error(result.error);
      default:
        throw new Error(result.error || 'Unknown device flow error');
    }
  }
}

/** Validate a gho_/ghu_ token and fetch its GitHub identity. */
export async function getUserInfo(token: string): Promise<CopilotUser> {
  const response = await fetch(`${COPILOT_PROXY_BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as CopilotUser;
}
