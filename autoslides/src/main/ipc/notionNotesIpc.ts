import { ipcMain } from 'electron';
import type { IpcServices } from './types';
import { broadcastConfig } from './broadcastConfig';

// Notion watch-notes bridge. Handlers take a tab id and plain values only; the
// token and each tab's page live in NotionNotesService (see its header). Only
// getToken returns the token, for Settings' show/hide field.
export function registerNotionNotesIpcHandlers(services: IpcServices): void {
  const { notionNotesService, configService } = services;

  ipcMain.handle('notionNotes:connect', async (_event, token: string) => {
    const result = await notionNotesService.connect(typeof token === 'string' ? token : '');
    if (result.ok) broadcastConfig(configService);
    return result;
  });

  ipcMain.handle('notionNotes:getToken', async () => configService.getNotionToken());

  ipcMain.handle('notionNotes:disconnect', async () => {
    notionNotesService.disconnect();
    broadcastConfig(configService);
  });

  ipcMain.handle('notionNotes:searchPages', async (_event, query: string, cursor: string | null) =>
    notionNotesService.searchPages(typeof query === 'string' ? query : '', typeof cursor === 'string' ? cursor : null),
  );

  ipcMain.handle('notionNotes:choosePage', async (_event, tabId: string, pageId: string) =>
    notionNotesService.choosePage(String(tabId), String(pageId)),
  );

  ipcMain.handle('notionNotes:append', async (_event, tabId: string, bytes: unknown, filename: string) => {
    // Same coercion as obsidianNotes:append (ArrayBuffer, or a typed array).
    const data = bytes instanceof ArrayBuffer
      ? new Uint8Array(bytes)
      : ArrayBuffer.isView(bytes)
        ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
        : null;
    if (!data) return { ok: false, error: 'bad_request' };
    return notionNotesService.append(String(tabId), data, String(filename));
  });

  ipcMain.handle('notionNotes:close', async (_event, tabId: string) => {
    notionNotesService.close(String(tabId));
  });

  ipcMain.handle('notionNotes:openPage', async (_event, tabId: string) =>
    notionNotesService.openPage(String(tabId)),
  );
}
