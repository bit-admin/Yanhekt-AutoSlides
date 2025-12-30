/**
 * Slide Extraction Service
 * Handles file system operations for saving extracted slides
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { shell } from 'electron';
import { sharpService } from './sharpService';

/**
 * Trash entry metadata for in-app trash system
 */
export interface TrashEntry {
  id: string;
  filename: string;
  originalPath: string;
  originalParentFolder: string;
  trashPath: string;
  reason: 'duplicate' | 'exclusion' | 'ai_filtered' | 'manual';
  reasonDetails?: string;
  trashedAt: string;
}

/**
 * Metadata for moving to in-app trash
 */
export interface TrashMetadata {
  reason: 'duplicate' | 'exclusion' | 'ai_filtered' | 'manual';
  reasonDetails?: string;
}

export class SlideExtractionService {
  /**
   * Reduce PNG colors to 128 using palette quantization
   * @param imageBuffer Original PNG image buffer
   * @returns Optimized PNG buffer with reduced colors
   */
  private async reducePngColors(imageBuffer: Uint8Array): Promise<Uint8Array> {
    try {
      const optimizedBuffer = await sharpService.reducePngColors(imageBuffer);
      if (optimizedBuffer) {
        console.log(`PNG color reduction: ${imageBuffer.length} -> ${optimizedBuffer.length} bytes (${Math.round((1 - optimizedBuffer.length / imageBuffer.length) * 100)}% reduction)`);
        return optimizedBuffer;
      }
      return imageBuffer;
    } catch (error) {
      console.warn('PNG color reduction failed, using original:', error);
      return imageBuffer;
    }
  }

  /**
   * Save slide image to file system
   * @param outputPath Directory to save the slide
   * @param filename Name of the slide file
   * @param imageBuffer Raw PNG image buffer
   * @param enableColorReduction Whether to reduce PNG colors to 128
   */
  async saveSlide(outputPath: string, filename: string, imageBuffer: Uint8Array, enableColorReduction: boolean = false): Promise<void> {
    try {
      // Expand tilde in path
      const expandedPath = outputPath.startsWith('~')
        ? path.join(os.homedir(), outputPath.slice(1))
        : outputPath;

      // Ensure directory exists
      await this.ensureDirectory(expandedPath);

      // Full file path
      const filePath = path.join(expandedPath, filename);

      // Apply color reduction if enabled
      const finalBuffer = enableColorReduction
        ? await this.reducePngColors(imageBuffer)
        : imageBuffer;

      // Write image buffer to file
      await fs.writeFile(filePath, finalBuffer);

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
   * Get the root output directory from a session output path
   * The session path is typically: outputDir/slides_courseName_sessionName
   * We need to find the root output directory to place .autoslidesTrash
   */
  private getRootOutputDirectory(sessionOutputPath: string): string {
    // Go up one level from session path to get root output directory
    // e.g., ~/Downloads/AutoSlides/slides_Course_Session -> ~/Downloads/AutoSlides
    return path.dirname(sessionOutputPath);
  }

  /**
   * Get the relative path from root output directory to the file
   */
  private getRelativePathFromRoot(rootDir: string, filePath: string): string {
    return path.relative(rootDir, filePath);
  }

  /**
   * Move a slide file to in-app trash with metadata logging
   * Creates .autoslidesTrash folder inside the root output directory
   * Mirrors the original folder structure inside trash
   */
  async moveToInAppTrash(
    outputPath: string,
    filename: string,
    metadata: TrashMetadata
  ): Promise<void> {
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

      // Get root output directory and create trash folder path
      const rootOutputDir = this.getRootOutputDirectory(resolvedOutputPath);
      const trashDir = path.join(rootOutputDir, '.autoslidesTrash');

      // Get relative path from root to preserve folder structure in trash
      const relativePath = this.getRelativePathFromRoot(rootOutputDir, resolvedFilePath);
      const trashFilePath = path.join(trashDir, relativePath);
      const trashFileDir = path.dirname(trashFilePath);

      // Ensure trash directory structure exists (mirrors original structure)
      await this.ensureDirectory(trashFileDir);

      // Move file to trash location
      await fs.rename(resolvedFilePath, trashFilePath);

      // Create trash entry metadata
      const trashEntry: TrashEntry = {
        id: `trash_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        filename,
        originalPath: resolvedFilePath,
        originalParentFolder: path.basename(resolvedOutputPath),
        trashPath: trashFilePath,
        reason: metadata.reason,
        reasonDetails: metadata.reasonDetails,
        trashedAt: new Date().toISOString()
      };

      // Append to trash manifest
      await this.appendTrashMetadata(trashDir, trashEntry);

      console.log(`Slide moved to in-app trash: ${trashFilePath}`);
    } catch (error) {
      console.error('Failed to move slide to in-app trash:', error);
      throw error;
    }
  }

  /**
   * Append a trash entry to the JSONL manifest file
   */
  private async appendTrashMetadata(trashDir: string, entry: TrashEntry): Promise<void> {
    try {
      const manifestPath = path.join(trashDir, 'trash-manifest.jsonl');
      const jsonLine = JSON.stringify(entry) + '\n';
      await fs.appendFile(manifestPath, jsonLine, 'utf8');
      console.log(`Trash metadata appended to manifest: ${entry.filename}`);
    } catch (error) {
      console.error('Failed to append trash metadata:', error);
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
   * Read slide image as base64 string
   */
  async readSlideAsBase64(outputPath: string, filename: string): Promise<string> {
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
      const stats = await fs.stat(resolvedFilePath);
      if (!stats.isFile()) {
        throw new Error('Path is not a file');
      }

      // Read the file and convert to base64
      const buffer = await fs.readFile(resolvedFilePath);
      const base64 = buffer.toString('base64');

      console.log(`Slide read as base64 successfully: ${resolvedFilePath}`);
      return base64;
    } catch (error) {
      console.error('Failed to read slide as base64:', error);
      throw error;
    }
  }

  /**
   * Read slide image and prepare for AI classification
   * If the PNG is indexed (palette-based), returns it directly since it's already small.
   * If not indexed, resizes to target dimensions using Sharp.
   * @param outputPath Directory containing the slide
   * @param filename Name of the slide file
   * @param targetWidth Target width for resize (if needed)
   * @param targetHeight Target height for resize (if needed)
   * @returns Base64 encoded image ready for AI
   */
  async readSlideForAI(
    outputPath: string,
    filename: string,
    targetWidth: number,
    targetHeight: number
  ): Promise<string> {
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
      const stats = await fs.stat(resolvedFilePath);
      if (!stats.isFile()) {
        throw new Error('Path is not a file');
      }

      // Read the file as buffer
      const buffer = await fs.readFile(resolvedFilePath);

      // Use SharpService to prepare for AI (handles indexed PNG detection and resize)
      const base64 = await sharpService.prepareImageForAI(buffer, targetWidth, targetHeight);

      console.log(`Slide prepared for AI: ${filename} (${buffer.length} bytes)`);
      return base64;
    } catch (error) {
      console.error('Failed to read slide for AI:', error);
      throw error;
    }
  }

  /**
   * List all slide files in a directory
   */
  async listSlides(outputPath: string): Promise<string[]> {
    try {
      // Expand tilde in path
      const expandedPath = outputPath.startsWith('~')
        ? path.join(os.homedir(), outputPath.slice(1))
        : outputPath;

      // Check if directory exists
      const dirExists = await this.directoryExists(expandedPath);
      if (!dirExists) {
        return [];
      }

      // Read directory and filter for slide files
      const files = await fs.readdir(expandedPath);
      const slideFiles = files.filter(file =>
        file.startsWith('Slide_') && file.endsWith('.png')
      );

      // Sort by filename (which includes timestamp)
      slideFiles.sort();

      console.log(`Found ${slideFiles.length} slides in ${expandedPath}`);
      return slideFiles;
    } catch (error) {
      console.error('Failed to list slides:', error);
      return [];
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

  // ============================================================================
  // Trash Management Methods
  // ============================================================================

  /**
   * Get the trash directory path for a given output directory
   */
  getTrashDirectory(outputDir: string): string {
    const expandedPath = outputDir.startsWith('~')
      ? path.join(os.homedir(), outputDir.slice(1))
      : outputDir;
    return path.join(expandedPath, '.autoslidesTrash');
  }

  /**
   * Get all trash entries from the manifest file
   */
  async getTrashEntries(outputDir: string): Promise<TrashEntry[]> {
    try {
      const trashDir = this.getTrashDirectory(outputDir);
      const manifestPath = path.join(trashDir, 'trash-manifest.jsonl');

      // Check if manifest exists
      try {
        await fs.access(manifestPath);
      } catch {
        // No manifest means no trash entries
        return [];
      }

      // Read and parse JSONL file
      const content = await fs.readFile(manifestPath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());

      const entries: TrashEntry[] = [];
      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as TrashEntry;
          // Verify the trash file still exists
          try {
            await fs.access(entry.trashPath);
            entries.push(entry);
          } catch {
            // File no longer exists, skip this entry
            console.log(`Trash file no longer exists: ${entry.trashPath}`);
          }
        } catch (parseError) {
          console.warn('Failed to parse trash entry:', parseError);
        }
      }

      console.log(`Found ${entries.length} trash entries`);
      return entries;
    } catch (error) {
      console.error('Failed to get trash entries:', error);
      return [];
    }
  }

  /**
   * Restore files from trash to their original locations
   */
  async restoreFromTrash(ids: string[], outputDir: string): Promise<{ restored: number; failed: number }> {
    const result = { restored: 0, failed: 0 };

    try {
      const trashDir = this.getTrashDirectory(outputDir);
      const manifestPath = path.join(trashDir, 'trash-manifest.jsonl');

      // Get all entries
      const allEntries = await this.getTrashEntries(outputDir);
      const entriesToRestore = allEntries.filter(e => ids.includes(e.id));
      const entriesToKeep = allEntries.filter(e => !ids.includes(e.id));

      // Restore each file
      for (const entry of entriesToRestore) {
        try {
          // Ensure original directory exists
          const originalDir = path.dirname(entry.originalPath);
          await this.ensureDirectory(originalDir);

          // Move file back to original location
          await fs.rename(entry.trashPath, entry.originalPath);
          result.restored++;
          console.log(`Restored: ${entry.filename} to ${entry.originalPath}`);
        } catch (restoreError) {
          console.error(`Failed to restore ${entry.filename}:`, restoreError);
          result.failed++;
        }
      }

      // Rewrite manifest with remaining entries
      if (entriesToKeep.length === 0) {
        // Delete manifest if empty
        try {
          await fs.unlink(manifestPath);
        } catch {
          // Ignore if already deleted
        }
      } else {
        // Rewrite manifest with remaining entries
        const newContent = entriesToKeep.map(e => JSON.stringify(e)).join('\n') + '\n';
        await fs.writeFile(manifestPath, newContent, 'utf8');
      }

      // Clean up empty directories in trash
      await this.cleanupEmptyTrashDirs(trashDir);

      return result;
    } catch (error) {
      console.error('Failed to restore from trash:', error);
      throw error;
    }
  }

  /**
   * Clear all trash by moving contents to system trash
   */
  async clearTrash(outputDir: string): Promise<{ cleared: number; failed: number }> {
    const result = { cleared: 0, failed: 0 };

    try {
      const trashDir = this.getTrashDirectory(outputDir);

      // Check if trash directory exists
      try {
        await fs.access(trashDir);
      } catch {
        // No trash directory
        return result;
      }

      // Get all files and directories in trash (except manifest)
      const items = await fs.readdir(trashDir);

      for (const item of items) {
        if (item === 'trash-manifest.jsonl') {
          continue; // Skip manifest, will be deleted after
        }

        const itemPath = path.join(trashDir, item);
        try {
          await shell.trashItem(itemPath);
          result.cleared++;
          console.log(`Moved to system trash: ${itemPath}`);
        } catch (trashError) {
          console.error(`Failed to move to system trash: ${itemPath}`, trashError);
          result.failed++;
        }
      }

      // Delete manifest file
      const manifestPath = path.join(trashDir, 'trash-manifest.jsonl');
      try {
        await fs.unlink(manifestPath);
      } catch {
        // Ignore if already deleted
      }

      console.log(`Trash cleared: ${result.cleared} items`);
      return result;
    } catch (error) {
      console.error('Failed to clear trash:', error);
      throw error;
    }
  }

  /**
   * Get trash image as base64 for display
   */
  async getTrashImageAsBase64(trashPath: string): Promise<string> {
    try {
      // Expand tilde in path
      const expandedPath = trashPath.startsWith('~')
        ? path.join(os.homedir(), trashPath.slice(1))
        : trashPath;

      // Validate path to prevent directory traversal
      const resolvedPath = path.resolve(expandedPath);

      // Check if file exists
      const stats = await fs.stat(resolvedPath);
      if (!stats.isFile()) {
        throw new Error('Path is not a file');
      }

      // Read and convert to base64
      const buffer = await fs.readFile(resolvedPath);
      return buffer.toString('base64');
    } catch (error) {
      console.error('Failed to read trash image:', error);
      throw error;
    }
  }

  /**
   * Clean up empty directories in trash folder
   */
  private async cleanupEmptyTrashDirs(trashDir: string): Promise<void> {
    try {
      const items = await fs.readdir(trashDir);

      for (const item of items) {
        if (item === 'trash-manifest.jsonl') continue;

        const itemPath = path.join(trashDir, item);
        const stats = await fs.stat(itemPath);

        if (stats.isDirectory()) {
          await this.removeEmptyDirsRecursive(itemPath);
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup empty trash dirs:', error);
    }
  }

  /**
   * Recursively remove empty directories
   */
  private async removeEmptyDirsRecursive(dirPath: string): Promise<boolean> {
    try {
      const items = await fs.readdir(dirPath);

      // Process subdirectories first
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = await fs.stat(itemPath);
        if (stats.isDirectory()) {
          await this.removeEmptyDirsRecursive(itemPath);
        }
      }

      // Check again if directory is now empty
      const remainingItems = await fs.readdir(dirPath);
      if (remainingItems.length === 0) {
        await fs.rmdir(dirPath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}

// Create singleton instance
export const slideExtractionService = new SlideExtractionService();