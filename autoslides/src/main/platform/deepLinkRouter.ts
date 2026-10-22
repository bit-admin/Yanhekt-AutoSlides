// `autoslides://` links (`@common/deepLink`). They arrive in main: macOS sends
// `open-url` (before `ready` on a cold launch); Windows and Linux put the link
// in argv, and in the running app's `second-instance` argv. Main checks the
// link, brings the window forward and hands it to the renderer once the
// renderer says it is ready, like the command line's renderer bridge.
//
// Only the latest link waits: clicking two links during a cold launch opens
// the second.
import type { WebContents } from 'electron';
import { parseDeepLink, type DeepLink } from '@common/deepLink';
import { createLogger } from '@main/infra/logger';

const log = createLogger('DeepLink');

export class DeepLinkRouter {
  private readyContents: WebContents | null = null;
  private pending: DeepLink | null = null;

  /** `showWindow` restores and focuses the main window, or creates one. */
  constructor(private readonly showWindow: () => void) {}

  receive(raw: string): void {
    const link = parseDeepLink(raw);
    if (!link) {
      // The raw text came from outside; log its length, not its content.
      log.warn(`Ignored a link that is not an AutoSlides link (${raw.length} characters)`);
      return;
    }
    this.pending = link;
    this.showWindow();
    this.flush();
  }

  /** The main window's renderer installed its handler. */
  markReady(contents: WebContents): void {
    if (this.readyContents === contents) return;
    this.readyContents = contents;
    const lost = (): void => {
      contents.off('did-start-navigation', onNavigation);
      if (this.readyContents === contents) this.readyContents = null;
    };
    // In-page navigations (the router) keep the renderer; only a new document loses it.
    const onNavigation = (details: { isMainFrame: boolean; isSameDocument: boolean }): void => {
      if (details.isMainFrame && !details.isSameDocument) lost();
    };
    contents.on('did-start-navigation', onNavigation);
    contents.once('render-process-gone', lost);
    contents.once('destroyed', lost);
    this.flush();
  }

  private flush(): void {
    const contents = this.readyContents;
    if (!this.pending || !contents || contents.isDestroyed()) return;
    const link = this.pending;
    this.pending = null;
    contents.send('deepLink:open', link);
  }
}
