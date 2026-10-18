import { ipcMain } from 'electron';
import { createSettingsWriter } from './settingsWriter';
import type { IpcServices } from './types';

export function registerQtExtractorIpcHandlers(services: IpcServices): void {
  const { qtExtractorService, configService, intranetMappingService } = services;
  // The two toggles now reach every window's config, so the extraction queue
  // (which reads `configStore.qtExtractor`) sees them without a restart.
  const settings = createSettingsWriter(configService, intranetMappingService);

  ipcMain.handle('qtExtractor:getStatus', async () => {
    return await qtExtractorService.verifyBinary();
  });

  ipcMain.handle('qtExtractor:detect', async () => {
    return await qtExtractorService.verifyBinary();
  });

  ipcMain.handle('qtExtractor:verify', async (_event, binaryPath?: string) => {
    return await qtExtractorService.verifyBinary(binaryPath);
  });

  ipcMain.handle('qtExtractor:selectBinary', async () => {
    return await qtExtractorService.selectBinaryViaDialog();
  });

  ipcMain.handle('qtExtractor:setBinaryPath', async (_event, binaryPath: string) => {
    configService.setQtExtractorBinaryPath(binaryPath || '');
  });

  ipcMain.handle('qtExtractor:setAutoRun', async (_event, enabled: boolean) => {
    settings.setQtExtractorAutoRun(!!enabled);
  });

  ipcMain.handle('qtExtractor:setAutoPostProcess', async (_event, enabled: boolean) => {
    settings.setQtExtractorAutoPostProcess(!!enabled);
  });

  ipcMain.handle(
    'qtExtractor:runExtraction',
    async (
      event,
      extractionId: string,
      videoPath: string,
      outputDir: string,
      params: {
        ssimThreshold: number;
        enableDownsampling: boolean;
        downsampleWidth: number;
        downsampleHeight: number;
        chunkSize?: number;
      }
    ) => {
      const send = (channel: string, ...args: unknown[]) => {
        if (!event.sender.isDestroyed()) event.sender.send(channel, ...args);
      };
      try {
        const result = await qtExtractorService.runExtraction(
          extractionId,
          videoPath,
          outputDir,
          params,
          {
            onProgress: (percent) => send('qtExtractor:progress', extractionId, percent),
            onSlidesExtracted: (slidesDir, count) =>
              send('qtExtractor:slidesExtracted', extractionId, slidesDir, count),
            onCompleted: (r) => send('qtExtractor:completed', extractionId, r),
            onError: (msg, category) => send('qtExtractor:error', extractionId, msg, category),
            onCancelled: () => send('qtExtractor:cancelled', extractionId)
          }
        );
        return { success: true, ...result };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message === 'cancelled') {
          return { success: false, cancelled: true };
        }
        return { success: false, error: message };
      }
    }
  );

  ipcMain.handle('qtExtractor:cancelExtraction', async (_event, extractionId: string) => {
    return qtExtractorService.cancelExtraction(extractionId);
  });

  ipcMain.handle('qtExtractor:applyColorReduction', async (_event, slidesDir: string) => {
    return await qtExtractorService.applyPngColorReduction(slidesDir);
  });
}
