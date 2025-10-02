/**
 * Slide Extraction Service
 * Handles file system operations for saving extracted slides
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

export class SlideExtractionService {
  /**
   * Save slide image to file system
   */
  async saveSlide(outputPath: string, filename: string, imageBuffer: Uint8Array): Promise<void> {
    try {
      // Expand tilde in path
      const expandedPath = outputPath.startsWith('~')
        ? path.join(os.homedir(), outputPath.slice(1))
        : outputPath;

      // Ensure directory exists
      await this.ensureDirectory(expandedPath);

      // Full file path
      const filePath = path.join(expandedPath, filename);

      // Write image buffer to file
      await fs.writeFile(filePath, imageBuffer);

      console.log(`Slide saved successfully: ${filePath}`);
    } catch (error) {
      console.error('Failed to save slide:', error);
      throw error;
    }
  }

  /**
   * Ensure directory exists, create if it doesn't
   */
  async ensureDirectory(dirPath: string): Promise<void> {
    try {
      // Expand tilde in path
      const expandedPath = dirPath.startsWith('~')
        ? path.join(os.homedir(), dirPath.slice(1))
        : dirPath;

      await fs.mkdir(expandedPath, { recursive: true });
      console.log(`Directory ensured: ${expandedPath}`);
    } catch (error) {
      console.error('Failed to ensure directory:', error);
      throw error;
    }
  }

  /**
   * Check if directory exists
   */
  async directoryExists(dirPath: string): Promise<boolean> {
    try {
      // Expand tilde in path
      const expandedPath = dirPath.startsWith('~')
        ? path.join(os.homedir(), dirPath.slice(1))
        : dirPath;

      const stats = await fs.stat(expandedPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Get directory size and file count
   */
  async getDirectoryInfo(dirPath: string): Promise<{ fileCount: number; totalSize: number }> {
    try {
      // Expand tilde in path
      const expandedPath = dirPath.startsWith('~')
        ? path.join(os.homedir(), dirPath.slice(1))
        : dirPath;

      const files = await fs.readdir(expandedPath);
      let fileCount = 0;
      let totalSize = 0;

      for (const file of files) {
        const filePath = path.join(expandedPath, file);
        try {
          const stats = await fs.stat(filePath);
          if (stats.isFile()) {
            fileCount++;
            totalSize += stats.size;
          }
        } catch {
          // Skip files that can't be accessed
        }
      }

      return { fileCount, totalSize };
    } catch {
      return { fileCount: 0, totalSize: 0 };
    }
  }

  /**
   * Clean up old slide files (optional utility)
   */
  async cleanupOldSlides(dirPath: string, maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    try {
      // Expand tilde in path
      const expandedPath = dirPath.startsWith('~')
        ? path.join(os.homedir(), dirPath.slice(1))
        : dirPath;

      const files = await fs.readdir(expandedPath);
      const now = Date.now();
      let deletedCount = 0;

      for (const file of files) {
        if (file.startsWith('Slide_') && file.endsWith('.png')) {
          const filePath = path.join(expandedPath, file);
          try {
            const stats = await fs.stat(filePath);
            if (now - stats.mtime.getTime() > maxAgeMs) {
              await fs.unlink(filePath);
              deletedCount++;
              console.log(`Deleted old slide: ${filePath}`);
            }
          } catch {
            // Skip files that can't be accessed
          }
        }
      }

      return deletedCount;
    } catch (error) {
      console.error('Failed to cleanup old slides:', error);
      return 0;
    }
  }
}

// Create singleton instance
export const slideExtractionService = new SlideExtractionService();