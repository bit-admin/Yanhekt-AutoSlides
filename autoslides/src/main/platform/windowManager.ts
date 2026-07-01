import { app, BrowserWindow, Menu, dialog, nativeTheme, session, shell } from 'electron';
import path from 'node:path';
import type { ConfigService } from '@main/platform/configService';
import { demoWebPreferences } from '@main/demo/demoEnv';
import { appUserAgent } from '@main/infra/appUserAgent';
import { parseShareLink } from '@common/shareLink';
import enTranslations from '../../renderer/shared/i18n/locales/en.json';
import zhTranslations from '../../renderer/shared/i18n/locales/zh.json';
import jaTranslations from '../../renderer/shared/i18n/locales/ja.json';
import koTranslations from '../../renderer/shared/i18n/locales/ko.json';
import { createLogger } from '@main/infra/logger';
const log = createLogger('WindowManager');

export interface YuketangClassCapture {
  presentationId: string;
  authorization: string;
  sourceUrl: string;
  updatedAt: string;
}

declare const TOOLS_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const TOOLS_WINDOW_VITE_NAME: string;

export function getWindowBackgroundColor(): string {
  return nativeTheme.shouldUseDarkColors ? '#1e1e1e' : '#ffffff';
}

export class WindowManager {
  private toolsWindow: BrowserWindow | null = null;
  readonly yuketangClassCapture: YuketangClassCapture = {
    presentationId: '',
    authorization: '',
    sourceUrl: '',
    updatedAt: ''
  };

  private onToolsWindowClosed?: () => void;
  private configService?: ConfigService;

  // Whether the renderer reports active work (running/queued tasks, downloads,
  // or post-processing). Pushed from the renderer via `window:setBusyState` and
  // read by the main window's close handler to warn before quitting.
  private appBusy = false;

  setConfigService(configService: ConfigService): void {
    this.configService = configService;
  }

  setAppBusy(busy: boolean): void {
    this.appBusy = busy;
  }

  isAppBusy(): boolean {
    return this.appBusy;
  }

  /**
   * Native confirmation shown when the user tries to close/quit while work is
   * still running. Synchronous by design — it runs inside a window `close`
   * handler that has called `event.preventDefault()`. Returns true if the user
   * chose to proceed (close/quit anyway).
   */
  confirmCloseWhileBusy(window: BrowserWindow): boolean {
    const t = (key: string) => this.getTranslation(key);
    const choice = dialog.showMessageBoxSync(window, {
      type: 'warning',
      buttons: [t('window.closeGuard.cancel'), t('window.closeGuard.confirm')],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
      title: t('window.closeGuard.title'),
      message: t('window.closeGuard.message'),
      detail: t('window.closeGuard.detail')
    });
    return choice === 1;
  }

  private getTranslation(key: string): string {
    const languageMode = this.configService?.getLanguageMode() ?? 'system';
    let locale: 'en' | 'zh' | 'ja' | 'ko' = 'en';

    if (languageMode === 'zh') {
      locale = 'zh';
    } else if (languageMode === 'en') {
      locale = 'en';
    } else {
      // system: follow the OS locale (the menu/native dialogs are the only
      // main-process strings, so they track the system language directly).
      const systemLang = app.getLocale();
      if (systemLang.startsWith('zh')) locale = 'zh';
      else if (systemLang.startsWith('ja')) locale = 'ja';
      else if (systemLang.startsWith('ko')) locale = 'ko';
      else locale = 'en';
    }

    const translations =
      locale === 'zh' ? zhTranslations
        : locale === 'ja' ? jaTranslations
          : locale === 'ko' ? koTranslations
            : enTranslations;
    const keys = key.split('.');
    let result: unknown = translations;

    for (const k of keys) {
      result = (result as Record<string, unknown>)?.[k];
    }

    return (typeof result === 'string' ? result : key);
  }

  private createMenuTemplate(): Electron.MenuItemConstructorOptions[] {
    const t = (key: string) => this.getTranslation(key);
    return [
      { label: app.name, submenu: [
        { role: 'about', label: t('titlebar.about') },
        { type: 'separator' },
        { label: t('titlebar.settings'), accelerator: 'CmdOrCtrl+,', click: () => {
          const mainWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
          if (mainWindow) {
            mainWindow.webContents.send('menu:openSettings');
          }
        } },
        { type: 'separator' },
        { label: t('titlebar.checkForUpdates'), click: async () => {
          const mainWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
          if (mainWindow) {
            mainWindow.webContents.send('menu:checkForUpdates');
          }
        } },
        {
          label: t('titlebar.legalNotices'),
          click: () => {
            const termsPath = app.isPackaged
              ? path.join(process.resourcesPath, 'terms/terms.rtf')
              : path.join(__dirname, '../../resources/terms/terms.rtf');
            shell.openPath(termsPath);
          }
        },
        { type: 'separator' },
        { role: 'services', label: t('titlebar.services') },
        { type: 'separator' },
        { role: 'hide', label: t('titlebar.hide') },
        { role: 'hideOthers', label: t('titlebar.hideOthers') },
        { role: 'unhide', label: t('titlebar.showAll') },
        { type: 'separator' },
        { role: 'quit', label: t('titlebar.quit') }
      ] },
      { label: t('titlebar.file'), submenu: [{ label: t('titlebar.new'), accelerator: 'CmdOrCtrl+N', enabled: false }, { label: t('titlebar.open'), accelerator: 'CmdOrCtrl+O', enabled: false }, { type: 'separator' }, { role: 'close', label: t('titlebar.close') }] },
      { label: t('titlebar.edit'), submenu: [{ role: 'undo', label: t('titlebar.undo') }, { role: 'redo', label: t('titlebar.redo') }, { type: 'separator' }, { role: 'cut', label: t('titlebar.cut') }, { role: 'copy', label: t('titlebar.copy') }, { role: 'paste', label: t('titlebar.paste') }, { role: 'selectAll', label: t('titlebar.selectAll') }] },
      { label: t('titlebar.view'), submenu: [{ role: 'reload', label: t('titlebar.reload') }, { role: 'forceReload', label: t('titlebar.forceReload') }, { role: 'toggleDevTools', label: t('titlebar.toggleDevTools') }, { type: 'separator' }, { role: 'resetZoom', label: t('titlebar.resetZoom') }, { role: 'zoomIn', label: t('titlebar.zoomIn') }, { role: 'zoomOut', label: t('titlebar.zoomOut') }, { type: 'separator' }, { role: 'togglefullscreen', label: t('titlebar.toggleFullscreen') }] },
      { label: t('titlebar.window'), submenu: [{ role: 'minimize', label: t('titlebar.minimize') }, { role: 'close', label: t('titlebar.close') }, { type: 'separator' }, { role: 'front', label: t('titlebar.bringAllToFront') }] },
      { label: t('titlebar.help'), role: 'help', submenu: [
        { label: t('titlebar.visitGitHub'), click: () => { shell.openExternal('https://github.com/bit-admin/Yanhekt-AutoSlides'); } },
        { label: t('titlebar.itCenterSoftware'), click: () => { shell.openExternal('https://it.ruc.edu.kg/zh/software'); } }
      ] }
    ];
  }

  updateApplicationMenu(): void {
    if (process.platform === 'darwin') {
      const menu = Menu.buildFromTemplate(this.createMenuTemplate());
      Menu.setApplicationMenu(menu);
    }
  }

  /**
   * Guard the main window's Cloud Index `<webview>` (embeds share.ruc.edu.kg):
   * intercept navigations to a v1 share link before they load, so the remote
   * viewer's own UI never paints — the renderer shows a native detail view
   * instead (see `cloudIndex:shareLinkIntercepted`). `will-navigate` on a real
   * `webContents` (unlike the `<webview>` tag's own DOM-level event) supports
   * `preventDefault()`. Ordinary apex browsing (search/results) uses `pushState`
   * client-side routing, not a top-level navigation, so it's unaffected.
   */
  guardCloudIndexWebview(mainWindow: BrowserWindow): void {
    mainWindow.webContents.on('did-attach-webview', (_event, webContents) => {
      // Identify the embedded share.ruc.edu.kg page (and its requests back to the
      // Index Worker) as genuine app traffic — same UA as our native fetches.
      webContents.setUserAgent(appUserAgent());
      webContents.setWindowOpenHandler(({ url }) => {
        webContents.loadURL(url);
        return { action: 'deny' };
      });
      webContents.on('will-navigate', (event, url) => {
        if (!parseShareLink(url)) return;
        event.preventDefault();
        mainWindow.webContents.send('cloudIndex:shareLinkIntercepted', url);
      });
    });
  }

  setOnToolsWindowClosed(fn: () => void): void {
    this.onToolsWindowClosed = fn;
  }

  getToolsWindow(): BrowserWindow | null {
    return this.toolsWindow;
  }

  createToolsWindow(tab?: string): void {
    const targetTab = tab || 'offline';

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
        contextIsolation: true,
        // Web Capture + Yuketang tabs embed a <webview>.
        webviewTag: true,
        // Mirror the main window's demo flag so this renderer reports isDemoMode too.
        ...demoWebPreferences()
      }
    });

    // Keep webview navigations (e.g. Yuketang window.open) inside the webview
    // rather than spawning OS windows.
    this.toolsWindow.webContents.on('did-attach-webview', (_event, webContents) => {
      log.debug('[Tools] Webview attached, setting up window open handler');
      webContents.setWindowOpenHandler(({ url }) => {
        log.debug('[Tools] Intercepted window.open:', url);
        webContents.loadURL(url);
        return { action: 'deny' };
      });
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
            this.toolsWindow?.webContents.send('yuketang:classCaptureUpdated', {
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
