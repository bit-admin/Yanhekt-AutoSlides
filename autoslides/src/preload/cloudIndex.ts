import { ipcRenderer } from 'electron';

/**
 * Bridge for the Cloud Index Workspace page's embedded `<webview>`. The main
 * process intercepts navigations to a v1 share link inside that webview (see
 * `WindowManager.guardCloudIndexWebview`) and forwards the blocked URL here so
 * the renderer can render a native detail view instead of the remote viewer's
 * own UI.
 */
export const cloudIndex = {
  onShareLinkIntercepted: (callback: (url: string) => void): (() => void) => {
    const handler = (_e: unknown, url: string) => callback(url);
    ipcRenderer.on('cloudIndex:shareLinkIntercepted', handler);
    return () => ipcRenderer.removeListener('cloudIndex:shareLinkIntercepted', handler);
  },
};
