/**
 * Cache Management Service
 *
 * Manual stats + clear for Chromium session caches and app-owned cache dirs.
 * There is no automatic cleanup — Settings → General drives this.
 *
 * Clear uses Electron session APIs for HTTP + V8/WASM caches (safe while the
 * app is running). GPU/Dawn/shader dirs and app folders (thumbnails,
 * lecture-posters, updates, temp) are removed as files. Cookies, Local
 * Storage, config, and models are left alone.
 */

import * as fs from 'fs';
import * as path from 'path';
import { app, session } from 'electron';
import { createLogger } from '@main/infra/logger';
import {
  APP_CACHE_DIR_NAMES,
  collectCacheRoots,
  collectFilesystemOnlyCacheRoots,
} from './cachePaths';

const log = createLogger('PlatformCacheManagement');

export interface CacheStats {
  totalSize: number;
  tempFiles: number;
}

export interface CacheOperationResult {
  success: boolean;
  error?: string;
}

export class CacheManagementService {
  private readonly userDataPath: string;
  private readonly appTempPath: string;

  constructor() {
    this.userDataPath = app.getPath('userData');
    this.appTempPath = path.join(app.getPath('temp'), 'AutoSlides');
  }

  async getStats(): Promise<CacheStats> {
    try {
      const partitions = await this.listPartitionNames();
      const roots = collectCacheRoots(this.userDataPath, this.appTempPath, partitions);

      let totalSize = 0;
      let tempFiles = 0;
      for (const root of roots) {
        if (!(await this.pathExists(root))) continue;
        const stats = await this.calculateDirectoryStats(root);
        totalSize += stats.size;
        tempFiles += stats.files;
      }

      return { totalSize, tempFiles };
    } catch (error) {
      log.error('Failed to get cache stats:', error);
      return { totalSize: 0, tempFiles: 0 };
    }
  }

  async clearCache(): Promise<CacheOperationResult> {
    try {
      await this.clearSessionCaches();
      await this.removeAppCacheDirs();
      await this.removeFilesystemOnlyCaches();

      log.debug('Cache cleared via session APIs + app cache dirs');
      return { success: true };
    } catch (error) {
      log.error('Failed to clear cache:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Reset all application data (factory reset)
   */
  async resetAllData(): Promise<CacheOperationResult> {
    try {
      // Release Chromium file handles before deleting userData.
      try {
        await this.clearSessionCaches({ storage: true });
      } catch (error) {
        log.warn('Session clear during factory reset failed:', error);
      }

      const items = await fs.promises.readdir(this.userDataPath);
      for (const item of items) {
        await this.removeTree(path.join(this.userDataPath, item));
      }

      await this.removeTree(this.appTempPath);

      log.debug('Factory reset completed');
      return { success: true };
    } catch (error) {
      log.error('Failed to reset all data:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Clear HTTP + code caches on the default session and every persist:
   * partition that already exists on disk. Optionally wipe storage too
   * (factory reset only — that includes cookies).
   */
  private async clearSessionCaches(opts: { storage?: boolean } = {}): Promise<void> {
    const sessions = [session.defaultSession];
    for (const name of await this.listPartitionNames()) {
      sessions.push(session.fromPartition(`persist:${name}`));
    }

    for (const ses of sessions) {
      await ses.clearCache();
      await ses.clearCodeCaches({});
      if (opts.storage) {
        await ses.clearStorageData();
      }
    }
  }

  private async removeAppCacheDirs(): Promise<void> {
    for (const name of APP_CACHE_DIR_NAMES) {
      await this.removeTree(path.join(this.userDataPath, name));
    }
    await this.removeTree(this.appTempPath);
  }

  private async removeFilesystemOnlyCaches(): Promise<void> {
    const partitions = await this.listPartitionNames();
    for (const root of collectFilesystemOnlyCacheRoots(this.userDataPath, partitions)) {
      await this.removeTree(root);
    }
  }

  private async listPartitionNames(): Promise<string[]> {
    const root = path.join(this.userDataPath, 'Partitions');
    try {
      const entries = await fs.promises.readdir(root, { withFileTypes: true });
      return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    } catch {
      return [];
    }
  }

  private async pathExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async calculateDirectoryStats(dirPath: string): Promise<{ size: number; files: number }> {
    let totalSize = 0;
    let fileCount = 0;

    try {
      const items = await fs.promises.readdir(dirPath);

      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        try {
          const stat = await fs.promises.stat(itemPath);

          if (stat.isDirectory()) {
            const subStats = await this.calculateDirectoryStats(itemPath);
            totalSize += subStats.size;
            fileCount += subStats.files;
          } else {
            totalSize += stat.size;
            fileCount++;
          }
        } catch (error) {
          log.warn(`Cannot access ${itemPath}:`, error);
        }
      }
    } catch (error) {
      log.warn(`Cannot read directory ${dirPath}:`, error);
    }

    return { size: totalSize, files: fileCount };
  }

  private async removeTree(target: string): Promise<void> {
    try {
      await fs.promises.rm(target, { recursive: true, force: true });
    } catch (error) {
      log.warn(`Failed to remove ${target}:`, error);
    }
  }
}

export const cacheManagementService = new CacheManagementService();
