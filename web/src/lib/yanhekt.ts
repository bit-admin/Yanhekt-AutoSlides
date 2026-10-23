/**
 * yanhekt.cn API helpers: request-header construction + token verification.
 *
 * The signature itself lives in yanhektSignature.ts (kept byte-compatible with
 * the desktop app); the header set here follows
 * autoslides/src/main/platform/apiClient.ts.
 */
import { getClientSignature } from "./yanhektSignature";

const BASE_HEADERS: Record<string, string> = {
  Origin: "https://www.yanhekt.cn",
  Referer: "https://www.yanhekt.cn/",
  "xdomain-client": "web_user",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.3",
  "Xdomain-Client": "web_user",
  "Xclient-Version": "v1",
};

export interface YanhektUserData {
  badge: string;
  nickname: string;
  gender: number;
  phone: string;
}

/**
 * Headers for an upstream cbiz.yanhekt.cn request. Pass `null` to omit the
 * Authorization header (some endpoints, e.g. /v1/tag/list, are unauthenticated).
 */
export function upstreamHeaders(token: string | null): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const headers = { ...BASE_HEADERS };
  headers["Xclient-Signature"] = getClientSignature();
  headers["Xclient-Timestamp"] = timestamp;
  if (token !== null) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

/** Create request headers carrying the timestamped signature + bearer token. */
export function createHeaders(token: string): Record<string, string> {
  return upstreamHeaders(token);
}

/** Verify a token against /v1/user; returns validity + extracted user info. */
export async function verifyToken(
  token: string,
): Promise<{ valid: boolean; userData: YanhektUserData | null }> {
  try {
    const headers = createHeaders(token);
    const response = await fetch("https://cbiz.yanhekt.cn/v1/user", { headers });
    const data = (await response.json()) as { code: number | string; data?: any };

    const isValid = data.code === 0 || data.code === "0";
    if (isValid && data.data) {
      return {
        valid: true,
        userData: {
          badge: data.data.badge || "",
          nickname: data.data.nickname || "",
          gender: data.data.gender || 3,
          phone: data.data.phone || "",
        },
      };
    }
    return { valid: false, userData: null };
  } catch (error) {
    console.error("`Token verification failed`:", error);
    return { valid: false, userData: null };
  }
}
