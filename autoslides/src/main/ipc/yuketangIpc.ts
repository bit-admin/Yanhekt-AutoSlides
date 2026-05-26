import { ipcMain, BrowserWindow, dialog, shell } from 'electron';
import path from 'node:path';
import {
  exportLessonSummary,
  exportClassPresentation,
  fetchLessonTitle,
  fetchClassPresentationTitle
} from '../yuketangService';
import { buildYuketangCookieHeader } from '../windowManager';
import type { IpcServices } from './types';

export function registerYuketangIpcHandlers(services: IpcServices): void {
  const { configService, windowManager } = services;

  ipcMain.handle('yuketang:export', async (_event, payload: { lessonId?: string; format: 'pdf' | 'images' }) => {
    const lessonId = String(payload?.lessonId ?? '').trim();
    const format = payload?.format || 'pdf';
    const outputDir = configService.getConfig().outputDirectory;
    const cookieHeader = await buildYuketangCookieHeader();
    const { yuketangClassCapture } = windowManager;
    const addonsWindow = windowManager.getAddonsWindow();

    const onProgress = (message: string) => {
      addonsWindow?.webContents.send('yuketang:exportProgress', message);
    };

    let pdfOutputPath: string | undefined;
    if (format === 'pdf') {
      onProgress('Loading metadata...');
      let title = 'slides';
      try {
        if (/^\d+$/.test(lessonId)) {
          title = await fetchLessonTitle(lessonId, cookieHeader);
        } else if (yuketangClassCapture.presentationId && yuketangClassCapture.authorization) {
          title = await fetchClassPresentationTitle(
            yuketangClassCapture.presentationId,
            yuketangClassCapture.authorization,
            cookieHeader
          );
        }
      } catch {
        // Fall back to generic name
      }

      const parentWindow = addonsWindow || BrowserWindow.getFocusedWindow();
      const result = await dialog.showSaveDialog(parentWindow!, {
        title: 'Save PDF',
        defaultPath: path.join(outputDir, `slides_${title}.pdf`),
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
      });
      if (result.canceled || !result.filePath) {
        return { cancelled: true };
      }
      pdfOutputPath = result.filePath;
    }

    if (/^\d+$/.test(lessonId)) {
      return exportLessonSummary({
        lessonId,
        outputDir,
        format,
        pdfOutputPath,
        cookieHeader,
        onProgress
      });
    }

    if (yuketangClassCapture.presentationId && yuketangClassCapture.authorization) {
      return exportClassPresentation({
        presentationId: yuketangClassCapture.presentationId,
        authorization: yuketangClassCapture.authorization,
        cookieHeader,
        outputDir,
        format,
        pdfOutputPath,
        onProgress
      });
    }

    throw new Error(
      'No lesson_id found. Open a lesson report page, or open class fullscreen PPT and wait for capture.'
    );
  });

  ipcMain.handle('yuketang:getClassCapture', async () => {
    return {
      presentationId: windowManager.yuketangClassCapture.presentationId,
      hasAuthorization: Boolean(windowManager.yuketangClassCapture.authorization)
    };
  });

  ipcMain.handle('yuketang:openFolder', async (_event, folderPath: string) => {
    const target = typeof folderPath === 'string' ? folderPath.trim() : '';
    if (!target) throw new Error('No folder path provided.');
    const openError = await shell.openPath(target);
    if (openError) throw new Error(openError);
  });
}
