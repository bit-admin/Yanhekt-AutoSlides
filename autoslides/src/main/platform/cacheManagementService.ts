/**
 * Cache Management Service
 * Handles cache statistics, cleanup, and data reset operations
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

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
  private readonly tempPath: string;

  constructor() {
    this.userDataPath = app.getPath('userData');
    this.tempPath = app.getPath('temp');
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      const stats: CacheStats = {
        totalSize: 0,
        tempFiles: 0
      };

      // Calculate app-specific temp files
      const appTempPath = path.join(this.tempPath, 'AutoSlides');
      if (await this.pathExists(appTempPath)) {
        const tempStats = await this.calculateDirectoryStats(appTempPath);
        stats.totalSize += tempStats.size;
        stats.tempFiles += tempStats.files;
      }

      // Calculate other cache directories in userData
      const cacheDirectories = ['cache', 'tmp', 'temp', 'Cache'];
      for (const dir of cacheDirectories) {
        const cachePath = path.join(this.userDataPath, dir);
        if (await this.pathExists(cachePath)) {
          const cacheStats = await this.calculateDirectoryStats(cachePath);
          stats.totalSize += cacheStats.size;
          stats.tempFiles += cacheStats.files;
        }
      }

      return stats;
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return {
        totalSize: 0,
        tempFiles: 0
      };
    }
  }

  /**
   * Clear cache files
   */
  async clearCache(): Promise<CacheOperationResult> {
    try {
      let clearedFiles = 0;

      // Clear app-specific temp files
      const appTempPath = path.join(this.tempPath, 'AutoSlides');
      if (await this.pathExists(appTempPath)) {
        clearedFiles += await this.removeDirectory(appTempPath);
      }


      // Clear cache directories in userData
      const cacheDirectories = ['cache', 'tmp', 'temp', 'Cache'];
      for (const dir of cacheDirectories) {
        const cachePath = path.join(this.userDataPath, dir);
        if (await this.pathExists(cachePath)) {
          clearedFiles += await this.removeDirectory(cachePath);
        }
      }

      console.log(`Cache cleared: ${clearedFiles} files removed`);
      return { success: true };
    } catch (error) {
      console.error('Failed to clear cache:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Reset all application data (factory reset)
   */
  async resetAllData(): Promise<CacheOperationResult> {
    try {
      // Get list of files/directories to preserve (none for now)
      const preserveList: string[] = [];

      // Get all items in userData directory
      const items = await fs.promises.readdir(this.userDataPath);

      let removedItems = 0;
      for (const item of items) {
        if (!preserveList.includes(item)) {
          const itemPath = path.join(this.userDataPath, item);
          try {
            const stat = await fs.promises.stat(itemPath);
            if (stat.isDirectory()) {
              removedItems += await this.removeDirectory(itemPath);
            } else {
              await fs.promises.unlink(itemPath);
              removedItems++;
            }
          } catch (error) {
            console.warn(`Failed to remove ${itemPath}:`, error);
          }
        }
      }

      // Also clear app temp directory
      const appTempPath = path.join(this.tempPath, 'AutoSlides');
      if (await this.pathExists(appTempPath)) {
        removedItems += await this.removeDirectory(appTempPath);
      }

      console.log(`Factory reset completed: ${removedItems} items removed`);
      return { success: true };
    } catch (error) {
      console.error('Failed to reset all data:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if path exists
   */
  private async pathExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Calculate directory statistics
   */
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
          // Skip files that can't be accessed
          console.warn(`Cannot access ${itemPath}:`, error);
        }
      }
    } catch (error) {
      console.warn(`Cannot read directory ${dirPath}:`, error);
    }

    return { size: totalSize, files: fileCount };
  }

  /**
   * Remove directory recursively
   */
  private async removeDirectory(dirPath: string): Promise<number> {
    let removedCount = 0;

    try {
      const items = await fs.promises.readdir(dirPath);

      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        try {
          const stat = await fs.promises.stat(itemPath);

          if (stat.isDirectory()) {
            removedCount += await this.removeDirectory(itemPath);
          } else {
            await fs.promises.unlink(itemPath);
            removedCount++;
          }
        } catch (error) {
          console.warn(`Failed to remove ${itemPath}:`, error);
        }
      }

      // Remove the directory itself
      await fs.promises.rmdir(dirPath);
    } catch (error) {
      console.warn(`Failed to remove directory ${dirPath}:`, error);
    }

    return removedCount;
  }

}

// Create singleton instance
export const cacheManagementService = new CacheManagementService();