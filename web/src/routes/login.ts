/**
 * Password login: POST /login {username, password} -> {success, token?, error?}.
 *
 * Ported from the AutoSlides desktop app's CAS flow
 * (autoslides/src/main/platform/authService.ts): scrape the SSO login page
 * for the AES key + flow execution token, submit the encrypted credentials,
 * then follow the redirect chain by hand until the yanhekt callback URL
 * yields a `?token=`.
 *
 * Workers-fetch specifics vs the axios original: redirects are followed
 * manually (`redirect: "manual"`), multiple Set-Cookie headers must be read
 * via `headers.getSetCookie()` (a plain `get("set-cookie")` folds them into
 * one), and 4xx responses never throw so they are mapped explicitly.
 */
import { Hono } from "hono";
import CryptoJS from "crypto-js";
import type { Env } from "../env";

const API_LOGIN_PAGE = "https://sso.bit.edu.cn/cas/login";
const SERVICE_URL = "https://cbiz.yanhekt.cn/v1/cas/callback";

interface LoginResult {
  success: boolean;
  token?: string;
  error?: string;
}

function encryptPassword(cryptoKey: string, password: string): string {
  if (!cryptoKey) {
    throw new Error("Encryption key (cryptoKey) is missing, cannot encrypt password.");
  }
  const key = CryptoJS.enc.Base64.parse(cryptoKey);
  const encrypted = CryptoJS.AES.encrypt(password, key, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  });
  return encrypted.toString();
}

function getHtmlParam(html: string, findKey: string): string {
  const start = html.indexOf(findKey);
  if (start === -1) return "";
  const contentStart = html.indexOf(">", start);
  if (contentStart === -1) return "";
  const contentEnd = html.indexOf("<", contentStart);
  if (contentEnd === -1) return "";
  return html.substring(contentStart + 1, contentEnd).trim();
}

/** Extract the `name=value` parts of every Set-Cookie header on a response. */
function cookiesOf(response: Response): string[] {
  return response.headers.getSetCookie().map((c) => c.split(";")[0]);
}

function mergeCookies(existing: string, incoming: string[]): string {
  if (incoming.length === 0) return existing;
  const joined = incoming.join("; ");
  return existing ? `${existing}; ${joined}` : joined;
}

function getTokenFromUrl(urlString: string): string | null {
  try {
    return new URL(urlString).searchParams.get("token");
  } catch {
    return null;
  }
}

async function loginAndGetToken(username: string, password: string): Promise<LoginResult> {
  let sessionCookies = "";

  try {
    // Step 1: fetch the login page, collecting cookies across any redirects
    // (the axios original auto-followed these).
    let pageUrl = `${API_LOGIN_PAGE}?service=${encodeURIComponent(SERVICE_URL)}`;
    let pageResponse = await fetch(pageUrl, { redirect: "manual" });
    sessionCookies = mergeCookies(sessionCookies, cookiesOf(pageResponse));
    for (let hop = 0; hop < 3 && pageResponse.status >= 300 && pageResponse.status < 400; hop++) {
      const location = pageResponse.headers.get("Location");
      if (!location) break;
      pageUrl = new URL(location, pageUrl).toString();
      pageResponse = await fetch(pageUrl, {
        redirect: "manual",
        headers: sessionCookies ? { Cookie: sessionCookies } : undefined,
      });
      sessionCookies = mergeCookies(sessionCookies, cookiesOf(pageResponse));
    }

    if (!sessionCookies) {
      throw new Error("Failed to get initial cookies. If this persists, please sign in with token.");
    }

    const html = await pageResponse.text();
    const cryptoKey = getHtmlParam(html, `id="login-croypto"`);
    const executionKey = getHtmlParam(html, `id="login-page-flowkey"`);
    if (!cryptoKey || !executionKey) {
      throw new Error("Failed to parse login page. If this persists, please sign in with token.");
    }

    // Step 2: submit the encrypted credentials.
    const params = new URLSearchParams();
    params.append("username", username);
    params.append("password", encryptPassword(cryptoKey, password));
    params.append("type", "UsernamePassword");
    params.append("_eventId", "submit");
    params.append("execution", executionKey);
    params.append("croypto", cryptoKey);
    params.append("geolocation", "");
    params.append("captcha_code", "");

    const loginUrl = `${API_LOGIN_PAGE}?service=${encodeURIComponent(SERVICE_URL)}`;
    const loginResponse = await fetch(loginUrl, {
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: sessionCookies,
      },
      body: params,
    });

    if (loginResponse.status === 401) {
      return { success: false, error: "Incorrect username or password." };
    }

    if (loginResponse.status !== 302) {
      const responseHtml = await loginResponse.text();
      if (
        responseHtml.includes('id="sso-second">true</p>') ||
        responseHtml.includes('id="current-login-type">smsLogin</p>') ||
        responseHtml.includes('id="second-auth-tip">')
      ) {
        throw new Error("Verification required. Please sign in with token instead.");
      }
      throw new Error("Login failed. If this persists, please sign in with token.");
    }

    // Step 3: follow the redirect chain manually to reach the yanhekt callback.
    sessionCookies = mergeCookies(sessionCookies, cookiesOf(loginResponse));

    const firstRedirectLocation = loginResponse.headers.get("Location");
    if (!firstRedirectLocation) {
      throw new Error("Login succeeded but redirect failed. Please sign in with token.");
    }

    const firstRedirectUrl = new URL(firstRedirectLocation, loginUrl).toString();
    const secondResponse = await fetch(firstRedirectUrl, {
      redirect: "manual",
      headers: { Cookie: sessionCookies },
    });

    if (secondResponse.status !== 302) {
      throw new Error("Ticket verification failed. Please sign in with token.");
    }

    const finalRedirectLocation = secondResponse.headers.get("Location");
    if (!finalRedirectLocation) {
      throw new Error("Ticket verification succeeded but redirect failed. Please sign in with token.");
    }

    // Step 4: the final redirect URL carries the yanhekt bearer token.
    const token = getTokenFromUrl(new URL(finalRedirectLocation, firstRedirectUrl).toString());
    if (!token) {
      throw new Error("Failed to extract token. Please sign in with token.");
    }

    return { success: true, token };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

export const loginRouter = new Hono<{ Bindings: Env }>();

loginRouter.post("/login", async (c) => {
  let body: { username?: unknown; password?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: "Invalid JSON body" }, 400);
  }

  const { username, password } = body;
  if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
    return c.json({ success: false, error: "username and password are required" }, 400);
  }

  const result = await loginAndGetToken(username, password);
  return c.json(result, result.success ? 200 : 401);
});
