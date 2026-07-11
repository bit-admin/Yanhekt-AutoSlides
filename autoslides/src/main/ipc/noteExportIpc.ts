import { ipcMain } from 'electron';
import type { NoteExportPayload } from '@main/export/noteExportService';
import type { IpcServices } from './types';

export function registerNoteExportIpcHandlers(services: IpcServices): void {
  const { noteExportService } = services;

  ipcMain.handle('noteExport:export', async (_event, payload: NoteExportPayload) => {
    return noteExportService.export(payload);
  });
}
