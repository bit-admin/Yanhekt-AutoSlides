import { ipcMain, shell } from 'electron';
import { ExtractorInstallerService } from '../extractorInstallerService';
import { fetchGithubRelease, buildGithubReleaseOptions } from '../../shared/githubRelease';
import type { IpcServices } from './types';

export function registerExtractorInstallerIpcHandlers(services: IpcServices): void {
  const { extractorInstallerService } = services;

  ipcMain.handle('extractorInstaller:checkLatest', async () => {
    try {
      const result = await fetchGithubRelease({
        primary: buildGithubReleaseOptions('bit-admin/AutoSlides-Extractor', 'AutoSlides-ExtractorInstaller'),
        fallback: buildGithubReleaseOptions('bit-admin/AutoSlides-Extractor', 'AutoSlides-ExtractorInstaller', true)
      });
      if (result.success && result.data) {
        const release = JSON.parse(result.data);
        const platformAssets = extractorInstallerService.getAssetsForPlatform(release.assets || []);
        return {
          success: true,
          tagName: release.tag_name,
          name: release.name,
          body: release.body || '',
          bodyHtml: release.body_html || '',
          htmlUrl: release.html_url,
          publishedAt: release.published_at,
          assets: platformAssets.map((asset: { name: string; browser_download_url: string; size: number }) => ({
            name: asset.name,
            url: asset.browser_download_url,
            size: asset.size,
            formattedSize: ExtractorInstallerService.formatBytes(asset.size),
            proxyUrl: ExtractorInstallerService.getProxyUrl(asset.browser_download_url)
          })),
          repoUrl: ExtractorInstallerService.getRepoUrl()
        };
      }
      return { success: false, error: result.error || 'Unknown error' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('extractorInstaller:download', async (event, url: string, filename: string) => {
    try {
      const progressCallback = (progress: { downloaded: number; total: number; percent: number }) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('extractorInstaller:progress', progress);
        }
      };
      const filePath = await extractorInstallerService.downloadInstaller(url, filename, progressCallback);
      if (!event.sender.isDestroyed()) {
        event.sender.send('extractorInstaller:complete', filename);
      }
      return { success: true, filePath };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (!event.sender.isDestroyed()) {
        event.sender.send('extractorInstaller:error', errorMessage);
      }
      return { success: false, error: errorMessage };
    }
  });

  ipcMain.handle('extractorInstaller:cancel', async () => {
    const cancelled = extractorInstallerService.cancelDownload();
    return { success: cancelled };
  });

  ipcMain.handle('extractorInstaller:isDownloading', async () => {
    return { isDownloading: extractorInstallerService.isDownloading() };
  });

  ipcMain.handle('extractorInstaller:install', async (_event, filename: string) => {
    try {
      const filePath = await extractorInstallerService.installInstaller(filename);
      return { success: true, filePath };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('extractorInstaller:openDownloadFolder', async () => {
    try {
      await extractorInstallerService.openUpdatesFolder();
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('extractorInstaller:openRepo', async () => {
    await shell.openExternal(ExtractorInstallerService.getRepoUrl());
  });
}
