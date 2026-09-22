import { ipcMain, BrowserWindow } from 'electron';
import type { IpcServices } from './types';
import { broadcastConfig } from './broadcastConfig';

// Obsidian watch-notes bridge. Handlers take a tab id and plain values only;
// paths are resolved and remembered by ObsidianNotesService (see its header).
export function registerObsidianNotesIpcHandlers(services: IpcServices): void {
  const { obsidianNotesService, configService } = services;

  ipcMain.handle('obsidianNotes:probeVault', async (_event, dir: string) =>
    obsidianNotesService.probeVault(typeof dir === 'string' ? dir : ''),
  );

  ipcMain.handle('obsidianNotes:selectVault', async (event) =>
    obsidianNotesService.selectVault(BrowserWindow.fromWebContents(event.sender)),
  );

  ipcMain.handle('obsidianNotes:openAuto', async (_event, tabId: string, title: string, slidesFolderName: string) =>
    obsidianNotesService.openAuto(String(tabId), String(title), String(slidesFolderName)),
  );

  ipcMain.handle('obsidianNotes:chooseNote', async (event, tabId: string, slidesFolderName: string) =>
    obsidianNotesService.chooseNote(String(tabId), String(slidesFolderName), BrowserWindow.fromWebContents(event.sender)),
  );

  ipcMain.handle('obsidianNotes:append', async (_event, tabId: string, bytes: unknown, filename: string) => {
    // The renderer sends an ArrayBuffer; accept a typed array too, which is what
    // some Electron versions hand back after the structured clone.
    const data = bytes instanceof ArrayBuffer
      ? new Uint8Array(bytes)
      : ArrayBuffer.isView(bytes)
        ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
        : null;
    if (!data) return { ok: false, error: 'bad_request' };
    return obsidianNotesService.append(String(tabId), data, String(filename));
  });

  ipcMain.handle('obsidianNotes:close', async (_event, tabId: string) => {
    obsidianNotesService.close(String(tabId));
  });

  ipcMain.handle('obsidianNotes:openInObsidian', async (_event, tabId: string) =>
    obsidianNotesService.openInObsidian(String(tabId)),
  );

  ipcMain.handle('obsidianNotes:reveal', async (_event, tabId: string) =>
    obsidianNotesService.reveal(String(tabId)),
  );

  ipcMain.handle('obsidianNotes:useFoundVault', async (_event, tabId: string) => {
    const result = obsidianNotesService.useFoundVault(String(tabId));
    if (result.ok) broadcastConfig(configService);
    return result;
  });
}
