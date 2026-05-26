import { BrowserWindow, nativeTheme, session } from 'electron';
import path from 'node:path';

export interface YuketangClassCapture {
  presentationId: string;
  authorization: string;
  sourceUrl: string;
  updatedAt: string;
}

declare const TOOLS_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const TOOLS_WINDOW_VITE_NAME: string;
declare const ADDONS_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const ADDONS_WINDOW_VITE_NAME: string;

export function getWindowBackgroundColor(): string {
  return nativeTheme.shouldUseDarkColors ? '#1e1e1e' : '#ffffff';
}

export class WindowManager {
  private toolsWindow: BrowserWindow | null = null;
  private addonsWindow: BrowserWindow | null = null;
  readonly yuketangClassCapture: YuketangClassCapture = {
    presentationId: '',
    authorization: '',
    sourceUrl: '',
    updatedAt: ''
  };

  private onToolsWindowClosed?: () => void;

  setOnToolsWindowClosed(fn: () => void): void {
    this.onToolsWindowClosed = fn;
  }

  getToolsWindow(): BrowserWindow | null {
    return this.toolsWindow;
  }

  getAddonsWindow(): BrowserWindow | null {
    return this.addonsWindow;
  }

  createToolsWindow(tab?: string): void {
    const targetTab = tab || 'trash';

    if (this.toolsWindow && !this.toolsWindow.isDestroyed()) {
      this.toolsWindow.webContents.send('tools:switchTab', targetTab);
      this.toolsWindow.focus();
      return;
    }

    this.toolsWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 900,
      minHeight: 600,
      title: 'Tools',
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
      frame: false,
      backgroundColor: getWindowBackgroundColor(),
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    if (TOOLS_WINDOW_VITE_DEV_SERVER_URL) {
      this.toolsWindow.loadURL(`${TOOLS_WINDOW_VITE_DEV_SERVER_URL}/tools.html?tab=${targetTab}`);
    } else {
      this.toolsWindow.loadFile(
        path.join(__dirname, `../renderer/${TOOLS_WINDOW_VITE_NAME}/tools.html`),
        { query: { tab: targetTab } }
      );
    }

    this.toolsWindow.on('closed', () => {
      this.onToolsWindowClosed?.();
      this.toolsWindow = null;
    });
  }

  createAddonsWindow(tab?: string): void {
    const targetTab = tab || 'yuketang';

    if (this.addonsWindow && !this.addonsWindow.isDestroyed()) {
      this.addonsWindow.webContents.send('addons:switchTab', targetTab);
      this.addonsWindow.focus();
      return;
    }

    this.addonsWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 900,
      minHeight: 600,
      title: 'Add-ons',
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
      frame: false,
      backgroundColor: getWindowBackgroundColor(),
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        webviewTag: true
      }
    });

    this.addonsWindow.webContents.on('did-attach-webview', (_event, webContents) => {
      console.log('[Addons] Webview attached, setting up window open handler');
      webContents.setWindowOpenHandler(({ url }) => {
        console.log('[Addons] Intercepted window.open:', url);
        webContents.loadURL(url);
        return { action: 'deny' };
      });
    });

    if (ADDONS_WINDOW_VITE_DEV_SERVER_URL) {
      this.addonsWindow.loadURL(`${ADDONS_WINDOW_VITE_DEV_SERVER_URL}/addons.html?tab=${targetTab}`);
    } else {
      this.addonsWindow.loadFile(
        path.join(__dirname, `../renderer/${ADDONS_WINDOW_VITE_NAME}/addons.html`),
        { query: { tab: targetTab } }
      );
    }

    this.addonsWindow.on('closed', () => {
      this.addonsWindow = null;
    });
  }

  setupYuketangClassCapture(): void {
    const captureSession = session.fromPartition('persist:yuketang');
    captureSession.webRequest.onBeforeSendHeaders(
      { urls: ['*://*.yuketang.cn/api/v3/lesson/presentation/fetch*'] },
      (details, callback) => {
        try {
          const url = new URL(details.url);
          const presentationId = url.searchParams.get('presentation_id') || '';
          const authorization = getYuketangHeaderValue(
            details.requestHeaders as Record<string, string | string[]>,
            'authorization'
          );

          if (presentationId) {
            this.yuketangClassCapture.presentationId = presentationId;
          }
          if (authorization) {
            this.yuketangClassCapture.authorization = authorization;
          }

          if (presentationId || authorization) {
            this.yuketangClassCapture.sourceUrl = details.url;
            this.yuketangClassCapture.updatedAt = new Date().toISOString();
            this.addonsWindow?.webContents.send('yuketang:classCaptureUpdated', {
              presentationId: this.yuketangClassCapture.presentationId,
              hasAuthorization: Boolean(this.yuketangClassCapture.authorization)
            });
          }
        } catch { /* ignore */ }

        callback({ requestHeaders: details.requestHeaders });
      }
    );
  }
}

function getYuketangHeaderValue(headers: Record<string, string | string[]>, name: string): string {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) {
      if (Array.isArray(value)) return value.join('; ');
      return typeof value === 'string' ? value : '';
    }
  }
  return '';
}

export async function buildYuketangCookieHeader(): Promise<string> {
  const urls = ['https://www.yuketang.cn', 'https://yuketang.cn', 'https://pro.yuketang.cn'];
  const cookieMap = new Map<string, string>();
  const cookieSessions = [session.fromPartition('persist:yuketang'), session.defaultSession];

  for (const currentSession of cookieSessions) {
    for (const url of urls) {
      const cookies = await currentSession.cookies.get({ url });
      for (const cookie of cookies) {
        cookieMap.set(cookie.name, cookie.value);
      }
    }
  }

  if (cookieMap.size === 0) {
    throw new Error('No Yuketang cookies found. Please sign in via the embedded website first.');
  }

  return Array.from(cookieMap.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}
