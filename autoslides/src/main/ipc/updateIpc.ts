import { ipcMain, app } from 'electron';
import { UpdateDownloadService, type UpdateAsset } from '@main/download/updateDownloadService';
import { WindowsAutoUpdater, UpdateCancelledError } from '@main/download/windowsAutoUpdater';
import { signatureCodeOf, sourceOfUrl, windowsInstallerName } from '@main/download/windowsUpdateFeed';
import { fetchGithubRelease, buildGithubReleaseOptions } from '@common/githubRelease';
import { compareVersions } from '@main/download/updateVersion';
import type { IpcServices } from './types';

const REPO = 'bit-admin/Yanhekt-AutoSlides';

interface GithubRelease {
  tag_name: string;
  name?: string;
  body?: string;
  body_html?: string;
  html_url: string;
  published_at?: string;
  assets?: UpdateAsset[];
}

async function fetchLatestRelease(): Promise<{ release: GithubRelease } | { error: string }> {
  try {
    const result = await fetchGithubRelease({
      primary: buildGithubReleaseOptions(REPO, 'AutoSlides'),
      fallback: buildGithubReleaseOptions(REPO, 'AutoSlides', true),
    });
    if (result.success && result.data) return { release: JSON.parse(result.data) as GithubRelease };
    return { error: result.error || 'Unknown error' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * True when this Windows build can update in place to `release`: the release
 * carries electron-updater's `latest.yml` and a signed installer. Older
 * releases, and every other platform, use the download-and-open flow.
 */
function supportsInPlaceUpdate(release: GithubRelease, version: string): boolean {
  if (!WindowsAutoUpdater.isSupported()) return false;
  const names = new Set((release.assets || []).map((a) => a.name));
  const installer = windowsInstallerName(version);
  return names.has('latest.yml') && names.has(installer) && names.has(installer + '.sig');
}

export function registerUpdateIpcHandlers(services: IpcServices): void {
  const { updateDownloadService, windowsAutoUpdater } = services;

  const mapAssets = (release: GithubRelease) =>
    updateDownloadService.getAssetsForPlatform(release.assets || []).map((asset) => ({
      name: asset.name,
      url: asset.browser_download_url,
      size: asset.size,
      formattedSize: UpdateDownloadService.formatBytes(asset.size),
      proxyUrl: UpdateDownloadService.getProxyUrl(asset.browser_download_url),
    }));

  // The version the last check offered for in-place install, if any.
  let inPlaceVersion: string | null = null;
  const inPlaceVersionFor = (filename: string): string | null =>
    inPlaceVersion && filename === windowsInstallerName(inPlaceVersion) ? inPlaceVersion : null;

  ipcMain.handle('update:checkForUpdates', async () => {
    const fetched = await fetchLatestRelease();
    if ('error' in fetched) return { success: false, error: fetched.error };
    try {
      const { release } = fetched;
      const latestVersion = release.tag_name.replace(/^v/, '');
      const currentVersion = app.getVersion();
      const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;
      const inPlace = hasUpdate && supportsInPlaceUpdate(release, latestVersion);
      inPlaceVersion = inPlace ? latestVersion : null;
      return {
        success: true,
        hasUpdate,
        currentVersion,
        latestVersion,
        releaseUrl: release.html_url,
        releaseBody: release.body_html || release.body || '',
        publishedAt: release.published_at || '',
        inPlaceUpdate: inPlace,
        assets: mapAssets(release),
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('update:getReleaseInfo', async () => {
    const fetched = await fetchLatestRelease();
    if ('error' in fetched) return { success: false, error: fetched.error };
    const { release } = fetched;
    return {
      success: true,
      tagName: release.tag_name,
      name: release.name,
      body: release.body || '',
      bodyHtml: release.body_html || '',
      htmlUrl: release.html_url,
      publishedAt: release.published_at,
      assets: mapAssets(release),
    };
  });

  ipcMain.handle('update:downloadUpdate', async (event, url: string, filename: string) => {
    const progressCallback = (progress: { downloaded: number; total: number; percent: number }) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('update:downloadProgress', progress);
      }
    };

    try {
      const version = inPlaceVersionFor(filename);
      let filePath: string | undefined;
      if (version) {
        await windowsAutoUpdater.download(version, sourceOfUrl(url), { onProgress: progressCallback });
      } else {
        filePath = await updateDownloadService.downloadUpdate(url, filename, progressCallback);
      }

      if (!event.sender.isDestroyed()) {
        event.sender.send('update:downloadComplete', filename);
      }
      return { success: true, filePath };
    } catch (error) {
      // The renderer reset itself when it asked to cancel.
      if (error instanceof UpdateCancelledError) {
        return { success: false, error: 'cancelled' };
      }
      const raw = error instanceof Error ? error.message : 'Unknown error';
      // electron-updater wraps the signature hook's answer in its own message.
      const errorMessage = signatureCodeOf(raw) ?? raw;
      if (!event.sender.isDestroyed()) {
        event.sender.send('update:downloadError', errorMessage);
      }
      return { success: false, error: errorMessage };
    }
  });

  ipcMain.handle('update:cancelDownload', async () => {
    const cancelled = windowsAutoUpdater.cancel() || updateDownloadService.cancelDownload();
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
      const version = inPlaceVersionFor(filename);
      if (version && windowsAutoUpdater.isReady(version)) {
        // The renderer asked the user first; the quit hook runs the installer
        // silently and starts the new version.
        windowsAutoUpdater.restartToInstall();
        return { success: true };
      }

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
    return { isDownloading: updateDownloadService.isDownloading() || windowsAutoUpdater.isDownloading() };
  });
}
