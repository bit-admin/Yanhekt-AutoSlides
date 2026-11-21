import { View, WebContentsView, type BrowserWindow, type WebContents } from 'electron';
import path from 'node:path';
import {
  GUEST_INBOUND,
  GUEST_MENU_EVENT_CHANNEL,
  GUEST_MENU_RENDER_CHANNEL,
  GUEST_MESSAGE_CHANNEL,
  GUEST_OUTBOUND,
  isGuestUrlAllowed,
  scaleGuestRect,
  type GuestEvent,
  type GuestKind,
  type GuestMenuState,
  type GuestRect,
} from '@common/guestView';
import { createLogger } from '@main/infra/logger';

const log = createLogger('GuestViews');

const SPECS: Record<GuestKind, { partition: string; preload?: string; keepPopups: boolean }> = {
  browserLogin: { partition: 'persist:browserlogin', preload: 'guestSsoPreload.cjs', keepPopups: false },
  webCapture: { partition: 'persist:webcapture', preload: 'guestCapturePreload.cjs', keepPopups: true },
  yuketang: { partition: 'persist:yuketang', keepPopups: true },
};

const MENU_MARGIN = 12;
const OUTLINE_WIDTH = 2;
const MENU_PAGE = 'data:text/html;charset=utf-8,<!doctype html><html><body></body></html>';

interface Guest {
  view: WebContentsView;
  bounds: GuestRect | null;
  outline: { rect: GuestRect; color: string } | null;
  outlineViews: View[];
}

/**
 * Owns the embedded sites. The renderer reports where each surface sits; main
 * decides the session and preload, so renderer state cannot select either.
 */
export class GuestViewManager {
  private window: BrowserWindow | null = null;
  private readonly guests = new Map<GuestKind, Guest>();
  private menuView: WebContentsView | null = null;
  private menuReady: Promise<void> | null = null;
  private menuState: GuestMenuState | null = null;
  private menuHeight = 0;

  constructor(private readonly buildDir: string) {}

  attach(window: BrowserWindow): void {
    this.window = window;
    const host = window.webContents;
    // A reload starts a new renderer with no surfaces; drop the old ones.
    host.on('did-start-navigation', (details) => {
      if (details.isMainFrame && !details.isSameDocument) this.closeAll();
    });
    host.on('render-process-gone', () => this.closeAll());
    window.on('closed', () => {
      this.closeAll();
      this.destroyMenu();
      if (this.window === window) this.window = null;
    });
  }

  isHost(sender: WebContents): boolean {
    return !!this.window && !this.window.isDestroyed() && sender === this.window.webContents;
  }

  open(kind: GuestKind, url: string): void {
    if (this.guests.has(kind) || !this.window) return;
    if (!isGuestUrlAllowed(kind, url)) throw new Error('This address cannot be opened here.');
    const spec = SPECS[kind];
    const view = new WebContentsView({
      webPreferences: {
        partition: spec.partition,
        preload: spec.preload ? path.join(this.buildDir, spec.preload) : undefined,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        // Capture keeps running while the surface is hidden behind another page.
        backgroundThrottling: false,
      },
    });
    view.setBackgroundColor('#ffffff');
    view.setVisible(false);
    this.window.contentView.addChildView(view);
    this.guests.set(kind, { view, bounds: null, outline: null, outlineViews: [] });
    this.wire(kind, view.webContents, spec.keepPopups);
    this.load(view.webContents, url);
  }

  close(kind: GuestKind): void {
    const guest = this.guests.get(kind);
    if (!guest) return;
    this.guests.delete(kind);
    if (kind === 'browserLogin') this.hideMenu();
    this.removeOutline(guest);
    if (this.window && !this.window.isDestroyed()) this.window.contentView.removeChildView(guest.view);
    // Removing a view does not destroy its page.
    if (!guest.view.webContents.isDestroyed()) guest.view.webContents.close();
  }

  layout(kind: GuestKind, rect: GuestRect | null): void {
    const guest = this.guests.get(kind);
    if (!guest || !this.window) return;
    const zoom = this.window.webContents.getZoomFactor();
    if (guest.view.webContents.getZoomFactor() !== zoom) guest.view.webContents.setZoomFactor(zoom);
    guest.bounds = rect ? scaleGuestRect(rect, zoom) : null;
    if (guest.bounds) guest.view.setBounds(guest.bounds);
    guest.view.setVisible(!!guest.bounds);
    if (!guest.bounds && this.window.webContents.isFocused() === false && guest.view.webContents.isFocused()) {
      this.window.webContents.focus();
    }
    this.renderOutline(guest);
    if (kind === 'browserLogin') this.placeMenu();
  }

  load(contents: WebContents, url: string): void {
    contents.loadURL(url).catch(() => log.debug('Guest page did not finish loading'));
  }

  navigate(kind: GuestKind, action: 'load' | 'reload' | 'back' | 'forward', url?: unknown): void {
    const contents = this.contents(kind);
    if (!contents) return;
    if (action === 'load') {
      if (!isGuestUrlAllowed(kind, url)) throw new Error('This address cannot be opened here.');
      this.load(contents, url);
    } else if (action === 'reload') {
      contents.reload();
    } else if (action === 'back') {
      if (contents.navigationHistory.canGoBack()) contents.navigationHistory.goBack();
    } else if (contents.navigationHistory.canGoForward()) {
      contents.navigationHistory.goForward();
    }
  }

  getUrl(kind: GuestKind): string {
    return this.contents(kind)?.getURL() ?? '';
  }

  send(kind: GuestKind, channel: string, payload: unknown): void {
    if (!GUEST_OUTBOUND[kind].includes(channel)) return;
    this.contents(kind)?.send(channel, payload);
  }

  async executeJavaScript(kind: GuestKind, code: string): Promise<unknown> {
    const contents = this.contents(kind);
    return contents ? contents.executeJavaScript(code) : null;
  }

  focus(kind: GuestKind): void {
    this.contents(kind)?.focus();
  }

  /** Returns a PNG data URL. Works while the surface is hidden. */
  async capture(kind: GuestKind, rect?: GuestRect | null): Promise<string> {
    const contents = this.contents(kind);
    if (!contents || !this.window) return '';
    const zoom = this.window.webContents.getZoomFactor();
    const opts = { stayHidden: true, stayAwake: true };
    const image = rect
      ? await contents.capturePage(scaleGuestRect(rect, zoom), opts)
      : await contents.capturePage(undefined, opts);
    return image.isEmpty() ? '' : image.toDataURL();
  }

  /** Native outline above the page. It never appears in captured frames. */
  setOutline(kind: GuestKind, rect: GuestRect | null, color: string): void {
    const guest = this.guests.get(kind);
    if (!guest) return;
    guest.outline = rect ? { rect, color } : null;
    this.renderOutline(guest);
  }

  async setMenu(state: GuestMenuState | null): Promise<void> {
    this.menuState = state;
    if (!state) {
      this.hideMenu();
      return;
    }
    const view = this.ensureMenu();
    if (!view) return;
    await this.menuReady;
    if (this.menuState !== state || view.webContents.isDestroyed()) return;
    view.webContents.send(GUEST_MENU_RENDER_CHANNEL, state);
    this.placeMenu();
  }

  private contents(kind: GuestKind): WebContents | null {
    const contents = this.guests.get(kind)?.view.webContents;
    return contents && !contents.isDestroyed() ? contents : null;
  }

  private emit(event: GuestEvent): void {
    const window = this.window;
    if (window && !window.isDestroyed()) window.webContents.send('guestView:event', event);
  }

  private wire(kind: GuestKind, contents: WebContents, keepPopups: boolean): void {
    contents.setWindowOpenHandler(({ url }) => {
      if (keepPopups && /^https?:\/\//i.test(url)) this.load(contents, url);
      return { action: 'deny' };
    });
    contents.on('did-navigate', (_e, url) => this.emit({ kind, type: 'did-navigate', url }));
    contents.on('did-navigate-in-page', (_e, url, isMainFrame) => {
      if (isMainFrame) this.emit({ kind, type: 'did-navigate-in-page', url });
    });
    contents.on('did-start-loading', () => this.emit({ kind, type: 'did-start-loading' }));
    contents.on('did-stop-loading', () => this.emit({ kind, type: 'did-stop-loading' }));
    contents.on('did-finish-load', () => this.emit({ kind, type: 'did-finish-load' }));
    contents.on('dom-ready', () => this.emit({ kind, type: 'dom-ready' }));
    contents.on('page-title-updated', (_e, title) => this.emit({ kind, type: 'page-title-updated', title }));
    contents.ipc.on(GUEST_MESSAGE_CHANNEL, (event, channel: unknown, payload: unknown) => {
      if (event.senderFrame !== contents.mainFrame) return;
      if (typeof channel !== 'string' || !GUEST_INBOUND[kind].includes(channel)) return;
      this.emit({ kind, type: 'message', channel, payload });
    });
  }

  private closeAll(): void {
    for (const kind of [...this.guests.keys()]) this.close(kind);
    this.hideMenu();
  }

  private removeOutline(guest: Guest): void {
    if (this.window && !this.window.isDestroyed()) {
      for (const edge of guest.outlineViews) this.window.contentView.removeChildView(edge);
    }
    guest.outlineViews = [];
  }

  private renderOutline(guest: Guest): void {
    if (!this.window) return;
    if (!guest.outline || !guest.bounds) {
      for (const edge of guest.outlineViews) edge.setVisible(false);
      return;
    }
    if (guest.outlineViews.length === 0) {
      guest.outlineViews = Array.from({ length: 4 }, () => new View());
      for (const edge of guest.outlineViews) this.window.contentView.addChildView(edge);
    }
    const zoom = this.window.webContents.getZoomFactor();
    const r = scaleGuestRect(guest.outline.rect, zoom);
    const x = guest.bounds.x + r.x;
    const y = guest.bounds.y + r.y;
    const edges: GuestRect[] = [
      { x, y, width: r.width, height: OUTLINE_WIDTH },
      { x, y: y + r.height - OUTLINE_WIDTH, width: r.width, height: OUTLINE_WIDTH },
      { x, y, width: OUTLINE_WIDTH, height: r.height },
      { x: x + r.width - OUTLINE_WIDTH, y, width: OUTLINE_WIDTH, height: r.height },
    ];
    guest.outlineViews.forEach((edge, index) => {
      edge.setBackgroundColor(guest.outline!.color);
      edge.setBounds(edges[index]);
      edge.setVisible(true);
    });
  }

  private ensureMenu(): WebContentsView | null {
    if (this.menuView) return this.menuView;
    if (!this.window) return null;
    const view = new WebContentsView({
      webPreferences: {
        preload: path.join(this.buildDir, 'guestMenuPreload.cjs'),
        partition: 'autoslides-guest-menu',
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    view.setBackgroundColor('#00000000');
    view.setVisible(false);
    view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    view.webContents.on('will-navigate', (event) => event.preventDefault());
    view.webContents.ipc.on(GUEST_MENU_EVENT_CHANNEL, (_event, payload: unknown) => {
      const { type, index, height } = (payload ?? {}) as Record<string, unknown>;
      if (type === 'size' && typeof height === 'number') {
        this.menuHeight = height;
        this.placeMenu();
      } else if ((type === 'hover' || type === 'pick') && typeof index === 'number') {
        this.emit({ kind: 'browserLogin', type: type === 'hover' ? 'menu-hover' : 'menu-pick', index });
      }
    });
    this.window.contentView.addChildView(view);
    this.menuView = view;
    this.menuReady = view.webContents.loadURL(MENU_PAGE).catch(() => log.warn('Saved-logins menu did not load'));
    return view;
  }

  private placeMenu(): void {
    const view = this.menuView;
    const state = this.menuState;
    const guest = this.guests.get('browserLogin');
    if (!view || !this.window) return;
    if (!state || !guest?.bounds || !this.menuHeight) {
      view.setVisible(false);
      return;
    }
    const zoom = this.window.webContents.getZoomFactor();
    const menu = scaleGuestRect({ x: state.left, y: state.top, width: state.width, height: this.menuHeight }, zoom);
    view.setBounds({
      x: guest.bounds.x + menu.x - MENU_MARGIN,
      y: guest.bounds.y + menu.y - MENU_MARGIN,
      width: menu.width + MENU_MARGIN * 2,
      height: menu.height + MENU_MARGIN * 2,
    });
    view.webContents.setZoomFactor(zoom);
    // Re-adding moves it above the sign-in page.
    this.window.contentView.addChildView(view);
    view.setVisible(true);
  }

  private hideMenu(): void {
    this.menuState = null;
    this.menuHeight = 0;
    this.menuView?.setVisible(false);
  }

  private destroyMenu(): void {
    const view = this.menuView;
    this.menuView = null;
    this.menuReady = null;
    if (view && !view.webContents.isDestroyed()) view.webContents.close();
  }
}
