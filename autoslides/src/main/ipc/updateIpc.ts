import { ipcMain, app } from 'electron';
import { UpdateDownloadService } from '../updateDownloadService';
import { fetchGithubRelease, buildGithubReleaseOptions } from '../../shared/githubRelease';
import type { IpcServices } from './types';

export function registerUpdateIpcHandlers(services: IpcServices): void {
  const { updateDownloadService } = services;

  ipcMain.handle('update:checkForUpdates', async () => {
    const parseRelease = (data: string) => {
      const release = JSON.parse(data);
      const latestTag = release.tag_name;
      const latestVersion = latestTag.replace(/^v/, '');
      const currentVersion = app.getVersion();

      const compareVersions = (v1: string, v2: string): number => {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);

        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
          const p1 = parts1[i] || 0;
          const p2 = parts2[i] || 0;
          if (p1 > p2) return 1;
          if (p1 < p2) return -1;
        }
        return 0;
      };

      const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;
      const platformAssets = updateDownloadService.getAssetsForPlatform(release.assets || []);

      return {
        success: true,
        hasUpdate,
        currentVersion,
        latestVersion,
        releaseUrl: release.html_url,
        releaseBody: release.body_html || release.body || '',
        publishedAt: release.published_at || '',
        assets: platformAssets.map((asset: { name: string; browser_download_url: string; size: number }) => ({
          name: asset.name,
          url: asset.browser_download_url,
          size: asset.size,
          formattedSize: UpdateDownloadService.formatBytes(asset.size),
          proxyUrl: UpdateDownloadService.getProxyUrl(asset.browser_download_url)
        }))
      };
    };

    try {
      const result = await fetchGithubRelease({
        primary: buildGithubReleaseOptions('bit-admin/Yanhekt-AutoSlides', 'AutoSlides'),
        fallback: buildGithubReleaseOptions('bit-admin/Yanhekt-AutoSlides', 'AutoSlides', true)
      });
      if (result.success && result.data) {
        return parseRelease(result.data);
      }
      return { success: false, error: result.error || 'Unknown error' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('update:getReleaseInfo', async () => {
    try {
      const result = await fetchGithubRelease({
        primary: buildGithubReleaseOptions('bit-admin/Yanhekt-AutoSlides', 'AutoSlides'),
        fallback: buildGithubReleaseOptions('bit-admin/Yanhekt-AutoSlides', 'AutoSlides', true)
      });

      if (result.success && result.data) {
        const release = JSON.parse(result.data);
        const platformAssets = updateDownloadService.getAssetsForPlatform(release.assets || []);

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
            formattedSize: UpdateDownloadService.formatBytes(asset.size),
            proxyUrl: UpdateDownloadService.getProxyUrl(asset.browser_download_url)
          }))
        };
      }

      return { success: false, error: result.error || 'Unknown error' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('update:downloadUpdate', async (event, url: string, filename: string) => {
    try {
      const progressCallback = (progress: { downloaded: number; total: number; percent: number }) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('update:downloadProgress', progress);
        }
      };

      const filePath = await updateDownloadService.downloadUpdate(url, filename, progressCallback);

      if (!event.sender.isDestroyed()) {
        event.sender.send('update:downloadComplete', filename);
      }

      return { success: true, filePath };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (!event.sender.isDestroyed()) {
        event.sender.send('update:downloadError', errorMessage);
      }
      return { success: false, error: errorMessage };
    }
  });

  ipcMain.handle('update:cancelDownload', async () => {
    const cancelled = updateDownloadService.cancelDownload();
    return { success: cancelled };
  });

  ipcMain.handle('update:openDownloadFolder', async () => {
    try {
      await updateDownloadService.openUpdatesFolder();
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('update:getDownloadFolder', async () => {
    return { success: true, path: updateDownloadService.getUpdatesPath() };
  });

  ipcMain.handle('update:installUpdate', async (event, filename: string) => {
    try {
      const filePath = await updateDownloadService.installUpdate(filename);

      const platform = process.platform;
      if (platform === 'darwin' || platform === 'win32') {
        if (!event.sender.isDestroyed()) {
          event.sender.send('update:promptQuit', filename);
        }
      }

      return { success: true, filePath };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('update:listDownloadedUpdates', async () => {
    try {
      const updates = updateDownloadService.listDownloadedUpdates();
      return { success: true, updates };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('update:deleteOldUpdates', async (_event, filenames: string[]) => {
    try {
      return await updateDownloadService.deleteUpdates(filenames);
    } catch (error) {
      return { success: false, errors: [error instanceof Error ? error.message : 'Unknown error'] };
    }
  });

  ipcMain.handle('update:findOldUpdates', async () => {
    try {
      const currentVersion = app.getVersion();
      const oldFiles = updateDownloadService.findOldUpdates(currentVersion);
      return { success: true, files: oldFiles, currentVersion };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('update:isDownloading', async () => {
    return { isDownloading: updateDownloadService.isDownloading() };
  });
}
