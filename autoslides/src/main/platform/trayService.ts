import { app, Menu, Notification, Tray, nativeImage, type BrowserWindow } from 'electron';
import path from 'node:path';
import type { ConfigService } from '@main/platform/configService';
import { createLogger } from '@main/infra/logger';
const log = createLogger('Tray');

// Settings → Download & Playback → Keep Running in the Tray (`closeToTray`; on macOS the
// label says "When the Window Is Closed").
//
// Closing the main window hides it instead of destroying it, so the renderer
// stays alive. That matters because the task queue, the download queue and
// slide extraction all run in the renderer (with `backgroundThrottling: false`),
// and `autoslides` commands go through it too. Without the setting, closing
// destroys the window and stops that work on every platform, even on macOS,
// where the app itself stays open in the Dock.
//
// Windows and Linux get a tray icon to bring the window back. macOS uses the
// Dock icon (`activate` in main.ts) and has no menu bar icon.
const USES_TRAY_ICON = process.platform !== 'darwin';

export interface TrayServiceDeps {
  configService: ConfigService;
  translate: (key: string) => string;
  getMainWindow: () => BrowserWindow | null;
  showMainWindow: () => void;
  quit: () => void;
}

export class TrayService {
  private tray: Tray | null = null;
  // The "still running" hint shows once per launch, on the first hide.
  private hiddenHintShown = false;
  // Held until clicked or closed: a collected Notification loses its click.
  private readonly shown = new Set<Notification>();

  constructor(private readonly deps: TrayServiceDeps) {}

  isEnabled(): boolean {
    return this.deps.configService.getCloseToTray();
  }

  /** Create or remove the tray icon to match the setting. */
  applyConfig(): void {
    if (this.isEnabled()) {
      if (USES_TRAY_ICON && !this.tray) this.create();
      return;
    }
    this.destroy();
    // Turned off while the window is hidden (e.g. by a command): show it, so
    // a later close quits or closes as the user now expects.
    const win = this.deps.getMainWindow();
    if (win && !win.isVisible()) this.deps.showMainWindow();
  }

  /** Rebuild the menu labels, e.g. after a language change. */
  refreshMenu(): void {
    if (!this.tray) return;
    this.tray.setToolTip(this.deps.translate('window.tray.tooltip'));
    this.tray.setContextMenu(this.buildMenu());
  }

  /** The main window was just hidden by a close. */
  noteHidden(): void {
    if (this.hiddenHintShown) return;
    this.hiddenHintShown = true;
    // macOS has no tray icon: the hint points at the Dock instead.
    this.notify('window.tray.hiddenTitle', USES_TRAY_ICON ? 'window.tray.hiddenBody' : 'window.tray.hiddenBodyMac');
  }

  /** Tasks and downloads all finished while the window was hidden. */
  noteWorkFinished(): void {
    this.notify('window.tray.doneTitle', 'window.tray.doneBody');
  }

  destroy(): void {
    this.tray?.destroy();
    this.tray = null;
  }

  private create(): void {
    try {
      const tray = new Tray(this.loadIcon());
      tray.setToolTip(this.deps.translate('window.tray.tooltip'));
      tray.setContextMenu(this.buildMenu());
      // Windows sends click / double-click. Most Linux trays only open the
      // menu, which is why the menu has Show too.
      tray.on('click', () => this.deps.showMainWindow());
      tray.on('double-click', () => this.deps.showMainWindow());
      // Clicking one of our notifications opens the window too.
      tray.on('balloon-click', () => this.deps.showMainWindow());
      this.tray = tray;
    } catch (error) {
      log.error('Could not create the tray icon:', error);
      this.tray = null;
    }
  }

  private buildMenu(): Menu {
    const t = this.deps.translate;
    return Menu.buildFromTemplate([
      { label: t('window.tray.show'), click: () => this.deps.showMainWindow() },
      { type: 'separator' },
      // app.quit() runs the main window's close guard, which still asks first
      // while tasks or downloads are running.
      { label: t('window.tray.quit'), click: () => this.deps.quit() },
    ]);
  }

  private loadIcon(): Electron.NativeImage {
    const file = process.platform === 'win32' ? 'tray.ico' : 'tray.png';
    const dir = app.isPackaged
      ? path.join(process.resourcesPath, 'tray')
      : path.join(app.getAppPath(), 'resources', 'tray');
    const image = nativeImage.createFromPath(path.join(dir, file));
    if (image.isEmpty()) log.warn('Tray icon not found in', dir);
    return image;
  }

  private notify(titleKey: string, bodyKey: string): void {
    const title = this.deps.translate(titleKey);
    const content = this.deps.translate(bodyKey);
    try {
      if (process.platform === 'win32' && this.tray) {
        // A balloon belongs to the tray icon, so Windows shows it without the
        // app having registered a notification identity.
        this.tray.displayBalloon({ title, content, iconType: 'info' });
      } else if (Notification.isSupported()) {
        const notification = new Notification({ title, body: content, silent: true });
        const release = (): void => { this.shown.delete(notification); };
        notification.on('click', () => {
          release();
          this.deps.showMainWindow();
        });
        notification.on('close', release);
        this.shown.add(notification);
        notification.show();
      }
    } catch (error) {
      log.warn('Could not show a tray notification:', error);
    }
  }
}
