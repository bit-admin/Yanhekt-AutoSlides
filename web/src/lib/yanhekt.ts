/**
 * yanhekt.cn API helper: token verification.
 *
 * The request signature is sent to yanhekt, so the header construction must
 * stay byte-identical to the legacy implementation it was ported from.
 */
import CryptoJS from "crypto-js";

const MAGIC = "1138b69dfef641d9d7ba49137d2d4875";

const BASE_HEADERS: Record<string, string> = {
  Origin: "https://www.yanhekt.cn",
  Referer: "https://www.yanhekt.cn/",
  "xdomain-client": "web_user",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 Edg/107.0.1418.26",
  "Xdomain-Client": "web_user",
  "Xclient-Version": "v1",
};

const md5 = (s: string): string => CryptoJS.MD5(s).toString();

export interface YanhektUserData {
  badge: string;
  nickname: string;
  gender: number;
  phone: string;
}

/** Create request headers carrying the timestamped signature + bearer token. */
export function createHeaders(token: string): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const headers = { ...BASE_HEADERS };
  // Matches the legacy implementation exactly (literal "undefined").
  headers["Xclient-Signature"] = md5(MAGIC + "_v1_undefined");
  headers["Xclient-Timestamp"] = timestamp;
  headers["Authorization"] = `Bearer ${token}`;
  return headers;
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
    console.error("验证 Token 失败:", error);
    return { valid: false, userData: null };
  }
}
