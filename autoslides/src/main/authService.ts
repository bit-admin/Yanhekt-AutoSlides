import axios from 'axios';
import CryptoJS from 'crypto-js';

export interface LoginResult {
  success: boolean;
  token?: string;
  error?: string;
}

export class MainAuthService {
  private encryptPassword(cryptoKey: string, password: string): string {
    if (!cryptoKey) {
      throw new Error("Encryption key (cryptoKey) is missing, cannot encrypt password.");
    }
    const key = CryptoJS.enc.Base64.parse(cryptoKey);
    const encrypted = CryptoJS.AES.encrypt(password, key, {
      mode: CryptoJS.mode.ECB,
      padding: CryptoJS.pad.Pkcs7
    });
    return encrypted.toString();
  }

  private getHtmlParam(html: string, findKey: string): string {
    const start = html.indexOf(findKey);
    if (start === -1) return "";
    const contentStart = html.indexOf('>', start);
    if (contentStart === -1) return "";
    const contentEnd = html.indexOf('<', contentStart);
    if (contentEnd === -1) return "";
    return html.substring(contentStart + 1, contentEnd).trim();
  }

  async loginAndGetToken(username: string, password: string): Promise<LoginResult> {
    const serviceUrl = 'https://cbiz.yanhekt.cn/v1/cas/callback';
    let sessionCookies = '';

    try {
      console.log('Starting complete manual redirect token acquisition process...');

      const API_LOGIN_PAGE = "https://sso.bit.edu.cn/cas/login";
      console.log('Step 1: Getting login page and initial cookies...');

      const axiosInstance = axios.create();
      const initResponse = await axiosInstance.get(`${API_LOGIN_PAGE}?service=${encodeURIComponent(serviceUrl)}`);

      const initialCookiesHeader = initResponse.headers['set-cookie'];
      if (!initialCookiesHeader) throw new Error("Failed to get initial cookies (JSESSIONID).");
      sessionCookies = initialCookiesHeader.map((c: string) => c.split(';')[0]).join('; ');

      const html = initResponse.data;
      const cryptoKey = this.getHtmlParam(html, `id="login-croypto"`);
      const executionKey = this.getHtmlParam(html, `id="login-page-flowkey"`);

      if (!cryptoKey || !executionKey) throw new Error("Failed to parse encryption or execution keys from login page.");
      console.log('Step 1 completed: Got encryption key and execution token');

      console.log('Step 2: Encrypting password and submitting login...');

      const encryptedPassword = this.encryptPassword(cryptoKey, password);
      const API_LOGIN_ACTION = "https://sso.bit.edu.cn/cas/login";

      const params = new URLSearchParams();
      params.append('username', username);
      params.append('password', encryptedPassword);
      params.append('type', 'UsernamePassword');
      params.append('_eventId', 'submit');
      params.append('execution', executionKey);
      params.append('croypto', cryptoKey);
      params.append('geolocation', '');
      params.append('captcha_code', '');

      const loginResponse = await axiosInstance.post(`${API_LOGIN_ACTION}?service=${encodeURIComponent(serviceUrl)}`, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': sessionCookies,
        },
        maxRedirects: 0,
        validateStatus: (status: number) => status >= 200 && status < 400,
      });

      if (loginResponse.status !== 302) {
        const errorData = loginResponse.data?.message || "Login failed, unable to parse error response.";
        throw new Error(`SSO login failed: ${errorData}`);
      }

      console.log('Step 2 completed: SSO login successful, starting redirect handling');

      console.log('Step 3: Handling redirect process...');

      const ssoSuccessCookiesHeader = loginResponse.headers['set-cookie'];
      if (ssoSuccessCookiesHeader) {
        const newCookies = ssoSuccessCookiesHeader.map((c: string) => c.split(';')[0]).join('; ');
        sessionCookies += '; ' + newCookies;
      }

      const firstRedirectLocation = loginResponse.headers['location'];
      if (!firstRedirectLocation) throw new Error("SSO login successful, but no first redirect address found.");

      console.log('Step 3: Accessing first redirect URL...', firstRedirectLocation);

      const secondResponse = await axiosInstance.get(firstRedirectLocation, {
        headers: {
          'Cookie': sessionCookies
        },
        maxRedirects: 0,
        validateStatus: (status: number) => status >= 200 && status < 400,
      });

      if (secondResponse.status !== 302) {
        throw new Error("Ticket verification redirect failed, server did not return final token address.");
      }

      const finalRedirectLocation = secondResponse.headers['location'];
      if (!finalRedirectLocation) throw new Error("Ticket verification successful, but no final redirect address with token found.");

      console.log('Step 4: Extracting token from final redirect URL...', finalRedirectLocation);

      const getTokenFromUrl = (urlString: string): string | null => {
        try {
          const url = new URL(urlString);
          return url.searchParams.get('token');
        } catch (_e) {
          return null;
        }
      };

      const token = getTokenFromUrl(finalRedirectLocation);

      if (!token) {
        throw new Error("Failed to extract token from redirect URL");
      }

      console.log('Successfully obtained token through manual redirect process!');

      return {
        success: true,
        token: token
      };

    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}