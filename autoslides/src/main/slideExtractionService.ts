/**
 * Slide Extraction Service
 * Handles file system operations for saving extracted slides
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { shell } from 'electron';

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
   * Move a specific slide file to trash with safety checks
   */
  async deleteSlide(outputPath: string, filename: string): Promise<void> {
    try {
      // Expand tilde in path
      const expandedPath = outputPath.startsWith('~')
        ? path.join(os.homedir(), outputPath.slice(1))
        : outputPath;

      // Validate filename to prevent directory traversal attacks
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        throw new Error('Invalid filename: contains path traversal characters');
      }

      // Ensure filename has .png extension and starts with Slide_
      if (!filename.endsWith('.png') || !filename.startsWith('Slide_')) {
        throw new Error('Invalid filename: must be a slide PNG file (Slide_*.png)');
      }

      // Full file path
      const filePath = path.join(expandedPath, filename);

      // Verify the file exists and is within the expected directory
      const resolvedFilePath = path.resolve(filePath);
      const resolvedOutputPath = path.resolve(expandedPath);

      if (!resolvedFilePath.startsWith(resolvedOutputPath)) {
        throw new Error('Invalid file path: file is outside the output directory');
      }

      // Check if file exists
      try {
        const stats = await fs.stat(resolvedFilePath);
        if (!stats.isFile()) {
          throw new Error('Path is not a file');
        }
      } catch (error) {
        if ((error as any).code === 'ENOENT') {
          throw new Error('File does not exist');
        }
        throw error;
      }

      // Move the file to trash using Electron's shell API
      await shell.trashItem(resolvedFilePath);
      console.log(`Slide moved to trash successfully: ${resolvedFilePath}`);
    } catch (error) {
      console.error('Failed to move slide to trash:', error);
      throw error;
    }
  }

  /**
   * Load slide image from file system
   */
  async loadSlideImage(filePath: string): Promise<Uint8Array> {
    try {
      // Expand tilde in path
      const expandedPath = filePath.startsWith('~')
        ? path.join(os.homedir(), filePath.slice(1))
        : filePath;

      // Validate file path to prevent directory traversal attacks
      const resolvedFilePath = path.resolve(expandedPath);

      // Check if file exists and is a file
      const stats = await fs.stat(resolvedFilePath);
      if (!stats.isFile()) {
        throw new Error('Path is not a file');
      }

      // Read the file as buffer
      const buffer = await fs.readFile(resolvedFilePath);
      console.log(`Slide image loaded successfully: ${resolvedFilePath}`);

      return new Uint8Array(buffer);
    } catch (error) {
      console.error('Failed to load slide image:', error);
      throw error;
    }
  }

  /**
   * Save post-processing results to file system
   */
  async savePostProcessingResults(filePath: string, data: any): Promise<void> {
    try {
      // Expand tilde in path
      const expandedPath = filePath.startsWith('~')
        ? path.join(os.homedir(), filePath.slice(1))
        : filePath;

      // Ensure directory exists
      const dirPath = path.dirname(expandedPath);
      await this.ensureDirectory(dirPath);

      // Convert data to JSON string
      const jsonData = JSON.stringify(data, null, 2);

      // Write JSON data to file
      await fs.writeFile(expandedPath, jsonData, 'utf8');
      console.log(`Post-processing results saved successfully: ${expandedPath}`);
    } catch (error) {
      console.error('Failed to save post-processing results:', error);
      throw error;
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