import { ipcMain } from 'electron';
import type {
  RecordCaptureConfirmedPayload,
  RecordGapBoundaryPayload,
  RelinkDuplicatePayload,
  RestoreCanonicalPayload,
  UnlinkToGapPayload,
} from '@common/sidecars';
import type { IpcServices } from './types';
import { createLogger } from '@main/infra/logger';

const log = createLogger('SlideTimelineIpc');

export function registerSlideTimelineIpcHandlers(services: IpcServices): void {
  const { slideTimelineService } = services;

  ipcMain.handle('slideTimeline:get', async (_event, folderPath: string) => {
    try {
      return await slideTimelineService.read(folderPath);
    } catch (error) {
      log.error('Failed to read slide timeline:', error);
      return null;
    }
  });

  ipcMain.handle(
    'slideTimeline:recordCaptureConfirmed',
    async (_event, folderPath: string, payload: RecordCaptureConfirmedPayload) => {
      try {
        await slideTimelineService.recordCaptureConfirmed(folderPath, payload);
        return { success: true };
      } catch (error) {
        log.error('Failed to record capture confirmed:', error);
        return { success: false };
      }
    }
  );

  ipcMain.handle(
    'slideTimeline:recordGapBoundary',
    async (_event, folderPath: string, payload: RecordGapBoundaryPayload) => {
      try {
        await slideTimelineService.recordGapBoundary(folderPath, payload);
        return { success: true };
      } catch (error) {
        log.error('Failed to record gap boundary:', error);
        return { success: false };
      }
    }
  );

  ipcMain.handle(
    'slideTimeline:relinkDuplicate',
    async (_event, folderPath: string, payload: RelinkDuplicatePayload) => {
      try {
        await slideTimelineService.relinkDuplicate(folderPath, payload);
        return { success: true };
      } catch (error) {
        log.error('Failed to relink duplicate:', error);
        return { success: false };
      }
    }
  );

  ipcMain.handle(
    'slideTimeline:unlinkToGap',
    async (_event, folderPath: string, payload: UnlinkToGapPayload) => {
      try {
        await slideTimelineService.unlinkToGap(folderPath, payload);
        return { success: true };
      } catch (error) {
        log.error('Failed to unlink to gap:', error);
        return { success: false };
      }
    }
  );

  ipcMain.handle(
    'slideTimeline:restoreCanonical',
    async (_event, folderPath: string, payload: RestoreCanonicalPayload) => {
      try {
        await slideTimelineService.restoreCanonical(folderPath, payload);
        return { success: true };
      } catch (error) {
        log.error('Failed to restore canonical:', error);
        return { success: false };
      }
    }
  );

  ipcMain.handle('slideTimeline:clear', async (_event, folderPath: string) => {
    try {
      await slideTimelineService.clear(folderPath);
      return { success: true };
    } catch (error) {
      log.error('Failed to clear timeline:', error);
      return { success: false };
    }
  });

  ipcMain.handle('slideTimeline:ensureRecordedHostFields', async (_event, folderPath: string) => {
    try {
      await slideTimelineService.ensureRecordedHostFields(folderPath);
      return { success: true };
    } catch (error) {
      log.error('Failed to stamp recorded host fields on timeline:', error);
      return { success: false };
    }
  });
}
