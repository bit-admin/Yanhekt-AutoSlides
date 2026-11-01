import { BrowserWindow, shell } from 'electron';
import { createLogger } from '@main/infra/logger';

const log = createLogger('CommunityWindow');

const COMMUNITY_URL = 'https://qm.qq.com/cgi-bin/qm/qr?k=5lK8_-vXwOiZtVh7pSRT7IlnticEMla5&jump_from=webapi&authKey=vazptH4tO8RUgQR6/6QTaq5PVDHKoSw+L2QJAsourPhE+UwxuQtquThy/EhqQjip';

/** Only QQ's invitation page and its desktop download fallback may navigate here. */
export function isCommunityWebUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      (url.hostname === 'qm.qq.com' || url.hostname === 'im.qq.com');
  } catch {
    return false;
  }
}

/** Do not grant a remote page access to arbitrary QQ commands or other handlers. */
export function isCommunityDeepLink(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'tencent:' && url.hostname === 'groupwpa' &&
      !url.username && !url.password && !url.port && url.pathname === '/' &&
      url.searchParams.get('subcmd') === 'all' &&
      /^[0-9a-f]+$/i.test(url.searchParams.get('param') ?? '');
  } catch {
    return false;
  }
}

export class CommunityWindow {
  private window: BrowserWindow | null = null;
  private pending: Promise<void> | null = null;

  /** Settles when closed, QQ is handed off, or loading/launching fails. */
  open(parent: BrowserWindow): Promise<void> {
    if (this.window && this.pending) {
      this.window.focus();
      return this.pending;
    }

    const window = new BrowserWindow({
      parent,
      modal: true,
      width: 560,
      height: 640,
      title: 'AutoSlides Community',
      autoHideMenuBar: true,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webviewTag: false,
        // In-memory and separate from all AutoSlides sign-in sessions; no preload.
        partition: 'autoslides-community',
      },
    });
    this.window = window;

    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const pending = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
    this.pending = pending;
    const fail = (error: unknown) => {
      log.error('Community window failed:', error);
      reject(error instanceof Error ? error : new Error(String(error)));
      if (!window.isDestroyed()) window.close();
    };
    let launching = false;
    const launchQQ = (url: string) => {
      if (launching || window.isDestroyed()) return;
      launching = true;
      void shell.openExternal(url).then(() => {
        if (!window.isDestroyed()) window.close();
      }).catch(fail);
    };

    const contents = window.webContents;
    let latestLoad = 0;
    const loadPage = (url: string) => {
      const load = ++latestLoad;
      void contents.loadURL(url).catch((error: unknown) => {
        if (window.isDestroyed() || load !== latestLoad) return;
        // Electron may dispatch a custom protocol itself, without our navigation
        // hook running, and reject loadURL with the protocol URL as ERR_ABORTED.
        // Inspect its structured fields, not instanceof (Electron errors may come
        // from another JS realm), and never mistake this for a failed web load.
        const details = typeof error === 'object' && error !== null
          ? error as { code?: unknown; errno?: unknown; url?: unknown }
          : null;
        const aborted = details?.code === 'ERR_ABORTED' || details?.errno === -3;
        if (aborted) {
          // An explicit handoff still awaits shell.openExternal's success/failure.
          if (launching) return;
          if (typeof details?.url === 'string' && isCommunityDeepLink(details.url)) {
            // Native protocol dispatch has already happened; don't launch twice.
            window.close();
            return;
          }
        }
        fail(error);
      });
    };
    const session = contents.session;
    session.setPermissionCheckHandler(() => false);
    session.setPermissionRequestHandler((requester, permission, callback, details) => {
      // Some Chromium external-protocol navigations surface as permission requests.
      callback(false);
      if (requester === contents && permission === 'openExternal' &&
          'externalURL' in details && typeof details.externalURL === 'string' &&
          isCommunityDeepLink(details.externalURL)) {
        launchQQ(details.externalURL);
      }
    });
    const blockDownload = (event: Electron.Event) => event.preventDefault();
    session.on('will-download', blockDownload);

    const navigate = (event: { preventDefault(): void; url: string; isMainFrame: boolean }) => {
      if (isCommunityWebUrl(event.url) || (!event.isMainFrame && event.url === 'about:blank')) return;
      event.preventDefault();
      if (isCommunityDeepLink(event.url)) launchQQ(event.url);
    };
    contents.on('will-frame-navigate', navigate);
    contents.on('will-redirect', navigate);
    contents.setWindowOpenHandler(({ url }) => {
      if (isCommunityDeepLink(url)) launchQQ(url);
      else if (isCommunityWebUrl(url)) loadPage(url);
      return { action: 'deny' };
    });
    contents.on('page-title-updated', (event) => event.preventDefault());
    window.once('closed', () => {
      session.removeListener('will-download', blockDownload);
      this.window = null;
      this.pending = null;
      resolve();
    });
    // The invite often launches QQ before its first paint. Avoid flashing an empty
    // native modal, and never show it late while the OS handoff is in progress.
    window.once('ready-to-show', () => {
      if (!launching && !window.isDestroyed()) window.show();
    });
    loadPage(COMMUNITY_URL);
    return pending;
  }
}
