/**
 * Slide Extraction Service
 * Handles file system operations for saving extracted slides
 */

import { promises as fs } from 'fs';
import path from 'path';
import { shell } from 'electron';
import { sharpService } from '@main/infra/sharpService';
import type { TrashEntry, TrashMetadata, CropEntry, CropRect } from './slideExtraction/types';
import {
  expandTilde,
  validateSlideFilename,
  getRootOutputDirectory as getRootOutputDirectoryHelper,
  getRelativePathFromRoot as getRelativePathFromRootHelper,
  isPathInside as isPathInsideHelper,
  pathExists as pathExistsHelper
} from './slideExtraction/pathHelpers';
import { appendManifest, readManifest, withFolderLock, writeManifest } from './slideExtraction/manifestFile';
import { createLogger } from '@main/infra/logger';
import { withPngCopyright } from '@main/infra/pngCopyright';
import { ensureCopyrightNotice } from '@main/infra/copyrightNoticeFile';
import { ensureWritableOutputDir } from '@main/infra/outputDir';
const log = createLogger('SlideExtraction');

export type { TrashEntry, TrashMetadata, CropEntry, CropRect };

const TRASH_MANIFEST = 'trash-manifest.jsonl';
const CROP_MANIFEST = 'crop-manifest.jsonl';

export class SlideExtractionService {
  // The configured output folder, read when a directory is created. Set once
  // at startup (`setOutputRoot`); without it directories are created as asked.
  private outputRoot: (() => string) | null = null;

  /** Tell the service where the configured output folder is. */
  setOutputRoot(read: () => string): void {
    this.outputRoot = read;
  }

  /**
   * Reduce PNG colors to 128 using palette quantization
   * @param imageBuffer Original PNG image buffer
   * @returns Optimized PNG buffer with reduced colors
   */
  private async reducePngColors(imageBuffer: Uint8Array): Promise<Uint8Array> {
    try {
      const optimizedBuffer = await sharpService.reducePngColors(imageBuffer);
      if (optimizedBuffer) {
        log.debug(`PNG color reduction: ${imageBuffer.length} -> ${optimizedBuffer.length} bytes (${Math.round((1 - optimizedBuffer.length / imageBuffer.length) * 100)}% reduction)`);
        return optimizedBuffer;
      }
      return imageBuffer;
    } catch (error) {
      log.warn('PNG color reduction failed, using original:', error);
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
      validateSlideFilename(filename);

      const expandedPath = expandTilde(outputPath);

      // Ensure directory exists
      await this.ensureDirectory(expandedPath);

      // Full file path
      const filePath = path.join(expandedPath, filename);

      // Apply color reduction if enabled
      const finalBuffer = enableColorReduction
        ? await this.reducePngColors(imageBuffer)
        : imageBuffer;

      // Write image buffer to file, with the copyright reminder as PNG text chunks.
      await fs.writeFile(filePath, withPngCopyright(finalBuffer));
      // Slide folders sit in the output folder; keep its COPYRIGHT.txt there.
      if (path.basename(expandedPath).startsWith('slides_')) {
        void ensureCopyrightNotice(path.dirname(expandedPath));
      }

      log.debug(`Slide saved successfully: ${filePath}`);
    } catch (error) {
      log.error('Failed to save slide:', error);
      throw error;
    }
  }

  /**
   * Ensure directory exists, create if it doesn't
   */
  async ensureDirectory(dirPath: string): Promise<void> {
    try {
      const expandedPath = expandTilde(dirPath);

      // Inside the output folder this refuses to recreate a path whose drive
      // is not connected (see `ensureWritableOutputDir`); elsewhere it is a
      // plain recursive create.
      const root = this.outputRoot ? expandTilde(this.outputRoot()) : null;
      if (root) await ensureWritableOutputDir(root, expandedPath);
      else await fs.mkdir(expandedPath, { recursive: true });
      log.debug(`Directory ensured: ${expandedPath}`);
    } catch (error) {
      log.error('Failed to ensure directory:', error);
      throw error;
    }
  }

  /**
   * Check if directory exists
   */
  async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const expandedPath = expandTilde(dirPath);

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
      const expandedPath = expandTilde(dirPath);

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
      const expandedPath = expandTilde(outputPath);

      validateSlideFilename(filename);

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
      log.debug(`Slide moved to trash successfully: ${resolvedFilePath}`);
    } catch (error) {
      log.error('Failed to move slide to trash:', error);
      throw error;
    }
  }

  private getRootOutputDirectory(sessionOutputPath: string): string {
    return getRootOutputDirectoryHelper(sessionOutputPath);
  }

  private getRelativePathFromRoot(rootDir: string, filePath: string): string {
    return getRelativePathFromRootHelper(rootDir, filePath);
  }

  private isPathInside(basePath: string, targetPath: string): boolean {
    return isPathInsideHelper(basePath, targetPath);
  }

  private async pathExists(targetPath: string): Promise<boolean> {
    return pathExistsHelper(targetPath);
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
      const expandedPath = expandTilde(outputPath);

      validateSlideFilename(filename);

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

      const trashEntry: TrashEntry = {
        id: `trash_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        filename,
        originalPath: resolvedFilePath,
        originalParentFolder: path.basename(resolvedOutputPath),
        trashPath: trashFilePath,
        reason: metadata.reason,
        reasonDetails: metadata.reasonDetails,
        duplicateOf: metadata.duplicateOf,
        trashedAt: new Date().toISOString()
      };

      // The entry is written before the file moves. If the app stops between
      // the two, the entry names a trash file that is not there, which every
      // reader skips, and the slide is still in its folder. The other order
      // could leave a trashed file that nothing lists.
      await withFolderLock(trashDir, async () => {
        // Inside the lock: a restore or clear ahead of this removes the
        // mirrored folders it emptied.
        await this.ensureDirectory(trashFileDir);
        const manifestPath = path.join(trashDir, TRASH_MANIFEST);
        await appendManifest(manifestPath, trashEntry);
        try {
          await fs.rename(resolvedFilePath, trashFilePath);
        } catch (moveError) {
          // Take the entry back; if that fails too it stays harmless (see above).
          try {
            const entries = await readManifest<TrashEntry>(manifestPath);
            await writeManifest(manifestPath, entries.filter(entry => entry.id !== trashEntry.id));
          } catch (undoError) {
            log.warn('Could not remove the entry of a slide that was not moved:', undoError);
          }
          throw moveError;
        }
      });

      log.debug(`Slide moved to in-app trash: ${trashFilePath}`);
    } catch (error) {
      log.error('Failed to move slide to in-app trash:', error);
      throw error;
    }
  }

  async loadSlideImage(filePath: string): Promise<Uint8Array> {
    try {
      const expandedPath = expandTilde(filePath);

      // Validate file path to prevent directory traversal attacks
      const resolvedFilePath = path.resolve(expandedPath);

      // Check if file exists and is a file
      const stats = await fs.stat(resolvedFilePath);
      if (!stats.isFile()) {
        throw new Error('Path is not a file');
      }

      // Read the file as buffer
      const buffer = await fs.readFile(resolvedFilePath);
      log.debug(`Slide image loaded successfully: ${resolvedFilePath}`);

      return new Uint8Array(buffer);
    } catch (error) {
      log.error('Failed to load slide image:', error);
      throw error;
    }
  }

  /**
   * Save post-processing results to file system
   */
  async savePostProcessingResults(filePath: string, data: any): Promise<void> {
    try {
      const expandedPath = expandTilde(filePath);

      // Ensure directory exists
      const dirPath = path.dirname(expandedPath);
      await this.ensureDirectory(dirPath);

      // Convert data to JSON string
      const jsonData = JSON.stringify(data, null, 2);

      // Write JSON data to file
      await fs.writeFile(expandedPath, jsonData, 'utf8');
      log.debug(`Post-processing results saved successfully: ${expandedPath}`);
    } catch (error) {
      log.error('Failed to save post-processing results:', error);
      throw error;
    }
  }

  /**
   * Read slide image as base64 string
   */
  async readSlideAsBase64(outputPath: string, filename: string): Promise<string> {
    try {
      const expandedPath = expandTilde(outputPath);

      validateSlideFilename(filename);

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

      log.debug(`Slide read as base64 successfully: ${resolvedFilePath}`);
      return base64;
    } catch (error) {
      log.error('Failed to read slide as base64:', error);
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
      const expandedPath = expandTilde(outputPath);

      validateSlideFilename(filename);

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

      log.debug(`Slide prepared for AI: ${filename} (${buffer.length} bytes)`);
      return base64;
    } catch (error) {
      log.error('Failed to read slide for AI:', error);
      throw error;
    }
  }

  /**
   * List all slide files in a directory
   */
  async listSlides(outputPath: string): Promise<string[]> {
    try {
      const expandedPath = expandTilde(outputPath);

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

      log.debug(`Found ${slideFiles.length} slides in ${expandedPath}`);
      return slideFiles;
    } catch (error) {
      log.error('Failed to list slides:', error);
      return [];
    }
  }

  /**
   * Clean up old slide files (optional utility)
   */
  async cleanupOldSlides(dirPath: string, maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    try {
      const expandedPath = expandTilde(dirPath);

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
              log.debug(`Deleted old slide: ${filePath}`);
            }
          } catch {
            // Skip files that can't be accessed
          }
        }
      }

      return deletedCount;
    } catch (error) {
      log.error('Failed to cleanup old slides:', error);
      return 0;
    }
  }

  // ============================================================================
  // Crop Management Methods
  // ============================================================================

  /**
   * Get the crop directory path for a given output directory
   */
  getCropDirectory(outputDir: string): string {
    const expandedPath = expandTilde(outputDir);
    return path.join(expandedPath, '.autoslidesCrop');
  }

  /**
   * Get all crop entries from the manifest file
   */
  async getCropEntries(outputDir: string): Promise<CropEntry[]> {
    try {
      const cropDir = this.getCropDirectory(outputDir);
      const manifestPath = path.join(cropDir, 'crop-manifest.jsonl');

      if (!(await this.pathExists(manifestPath))) {
        return [];
      }

      const content = await fs.readFile(manifestPath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());

      const entries: CropEntry[] = [];
      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as CropEntry;
          if (await this.pathExists(entry.cropPath)) {
            entries.push(entry);
          } else {
            log.debug(`Crop backup no longer exists: ${entry.cropPath}`);
          }
        } catch (parseError) {
          log.warn('Failed to parse crop entry:', parseError);
        }
      }

      return entries;
    } catch (error) {
      log.error('Failed to get crop entries:', error);
      return [];
    }
  }

  /**
   * Apply crop to an active slide, preserving the original in the crop backup folder
   */
  async applyCrop(imagePath: string, outputDir: string, rect: CropRect, autoCropped?: boolean): Promise<void> {
    try {
      const expandedOutputDir = expandTilde(outputDir);
      const resolvedOutputDir = path.resolve(expandedOutputDir);
      const resolvedImagePath = path.resolve(imagePath);

      if (!this.isPathInside(resolvedOutputDir, resolvedImagePath)) {
        throw new Error('Invalid image path: file is outside the output directory');
      }

      const filename = path.basename(resolvedImagePath);
      if (!filename.endsWith('.png') || !filename.startsWith('Slide_')) {
        throw new Error('Invalid filename: must be a slide PNG file (Slide_*.png)');
      }

      const imageStats = await fs.stat(resolvedImagePath);
      if (!imageStats.isFile()) {
        throw new Error('Path is not a file');
      }

      const cropDir = this.getCropDirectory(resolvedOutputDir);
      const relativePath = this.getRelativePathFromRoot(resolvedOutputDir, resolvedImagePath);
      const cropFilePath = path.join(cropDir, relativePath);
      const cropFileDir = path.dirname(cropFilePath);

      // One crop change at a time per output folder: the backup, the cropped
      // file and the manifest line are read and written together.
      await withFolderLock(cropDir, async () => {
        const allEntries = await this.getCropEntries(resolvedOutputDir);
        const existingEntry = allEntries.find(entry => entry.originalPath === resolvedImagePath);

        if (!existingEntry) {
          await this.ensureDirectory(cropFileDir);
          await fs.copyFile(resolvedImagePath, cropFilePath);
        }

        const sourcePath = existingEntry?.cropPath || cropFilePath;
        const sourceBuffer = await fs.readFile(sourcePath);
        const normalizedRect = {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };

        const croppedBuffer = await sharpService.crop(new Uint8Array(sourceBuffer), normalizedRect);
        if (!croppedBuffer) {
          throw new Error('Failed to crop image');
        }

        await fs.writeFile(resolvedImagePath, withPngCopyright(croppedBuffer));

        const updatedEntry: CropEntry = {
          filename,
          originalPath: resolvedImagePath,
          originalParentFolder: path.basename(path.dirname(resolvedImagePath)),
          cropPath: sourcePath,
          rect: normalizedRect,
          croppedAt: new Date().toISOString(),
          autoCropped: autoCropped ?? false,
        };

        const entriesToKeep = allEntries.filter(entry => entry.originalPath !== resolvedImagePath);
        entriesToKeep.push(updatedEntry);
        await this.rewriteCropManifest(cropDir, entriesToKeep);
      });
    } catch (error) {
      log.error('Failed to apply crop:', error);
      throw error;
    }
  }

  /**
   * Restore a cropped slide back to its original uncropped image
   */
  async restoreCrop(imagePath: string, outputDir: string): Promise<void> {
    try {
      const expandedOutputDir = expandTilde(outputDir);
      const resolvedOutputDir = path.resolve(expandedOutputDir);
      const resolvedImagePath = path.resolve(imagePath);

      if (!this.isPathInside(resolvedOutputDir, resolvedImagePath)) {
        throw new Error('Invalid image path: file is outside the output directory');
      }

      const cropDir = this.getCropDirectory(resolvedOutputDir);
      await withFolderLock(cropDir, async () => {
        const allEntries = await this.getCropEntries(resolvedOutputDir);
        const entry = allEntries.find(item => item.originalPath === resolvedImagePath);

        if (!entry) {
          throw new Error('Crop backup not found');
        }

        await this.ensureDirectory(path.dirname(resolvedImagePath));
        await fs.copyFile(entry.cropPath, resolvedImagePath);

        await this.pruneCropEntries([resolvedImagePath], resolvedOutputDir);
      });
    } catch (error) {
      log.error('Failed to restore crop:', error);
      throw error;
    }
  }

  /**
   * Get crop backup image as base64 for display
   */
  async getCropImageAsBase64(cropPath: string): Promise<string> {
    try {
      const expandedPath = expandTilde(cropPath);
      const resolvedPath = path.resolve(expandedPath);

      const stats = await fs.stat(resolvedPath);
      if (!stats.isFile()) {
        throw new Error('Path is not a file');
      }

      const buffer = await fs.readFile(resolvedPath);
      return buffer.toString('base64');
    } catch (error) {
      log.error('Failed to read crop image:', error);
      throw error;
    }
  }

  // ============================================================================
  // Trash Management Methods
  // ============================================================================

  /**
   * Get the trash directory path for a given output directory
   */
  getTrashDirectory(outputDir: string): string {
    const expandedPath = expandTilde(outputDir);
    return path.join(expandedPath, '.autoslidesTrash');
  }

  /**
   * Get all trash entries from the manifest file
   */
  async getTrashEntries(outputDir: string): Promise<TrashEntry[]> {
    try {
      const entries = await this.liveTrashEntries(this.getTrashDirectory(outputDir));
      log.debug(`Found ${entries.length} trash entries`);
      return entries;
    } catch (error) {
      log.error('Failed to get trash entries:', error);
      return [];
    }
  }

  /**
   * The manifest's entries whose trash file exists, one per trash file (the
   * newest line wins). A line without its file is one of: a move that never
   * happened, a restore or clear whose manifest rewrite did not complete, or
   * a file removed outside the app. None of them is in the trash.
   */
  private async liveTrashEntries(trashDir: string): Promise<TrashEntry[]> {
    const raw = await readManifest<TrashEntry>(path.join(trashDir, TRASH_MANIFEST), parseError =>
      log.warn('Failed to parse trash entry:', parseError),
    );
    const byFile = new Map<string, TrashEntry>();
    for (const entry of raw) {
      if (!entry || typeof entry.trashPath !== 'string') continue;
      if (await this.pathExists(entry.trashPath)) {
        // Re-inserted so the entry keeps the position of its newest line.
        byFile.delete(entry.trashPath);
        byFile.set(entry.trashPath, entry);
      } else {
        log.debug(`Trash file no longer exists: ${entry.trashPath}`);
      }
    }
    return [...byFile.values()];
  }

  /**
   * Restore files from trash to their original locations
   */
  async restoreFromTrash(ids: string[], outputDir: string): Promise<{ restored: number; failed: number }> {
    const outcome = await this.restoreTrashEntries(ids, outputDir);
    return { restored: outcome.restored.length, failed: outcome.failed.length };
  }

  /**
   * Restore files from trash, saying which entries came back and which did
   * not. Callers that record the restore elsewhere (timeline, `edited`) must
   * do so for `restored` only. A file is never restored over one that exists
   * at its original path.
   */
  async restoreTrashEntries(
    ids: string[],
    outputDir: string,
  ): Promise<{ restored: TrashEntry[]; failed: TrashEntry[] }> {
    const trashDir = this.getTrashDirectory(outputDir);
    try {
      return await withFolderLock(trashDir, async () => {
        const restored: TrashEntry[] = [];
        const failed: TrashEntry[] = [];
        const wanted = new Set(ids);
        const allEntries = await this.liveTrashEntries(trashDir);

        for (const entry of allEntries) {
          if (!wanted.has(entry.id)) continue;
          try {
            await this.ensureDirectory(path.dirname(entry.originalPath));
            if (await this.pathExists(entry.originalPath)) {
              throw new Error('a file already exists at the original path');
            }
            await fs.rename(entry.trashPath, entry.originalPath);
            restored.push(entry);
            log.debug(`Restored: ${entry.filename} to ${entry.originalPath}`);
          } catch (restoreError) {
            log.error(`Failed to restore ${entry.filename}:`, restoreError);
            failed.push(entry);
          }
        }

        if (restored.length > 0) {
          const gone = new Set(restored.map(entry => entry.id));
          await writeManifest(path.join(trashDir, TRASH_MANIFEST), allEntries.filter(entry => !gone.has(entry.id)));
          await this.cleanupEmptyTrashDirs(trashDir);
        }
        return { restored, failed };
      });
    } catch (error) {
      log.error('Failed to restore from trash:', error);
      throw error;
    }
  }

  /**
   * Clear all trash by moving contents to system trash
   */
  async clearTrash(outputDir: string): Promise<{ cleared: number; failed: number }> {
    const trashDir = this.getTrashDirectory(outputDir);
    try {
      const { result, clearedOriginalPaths } = await withFolderLock(trashDir, async () => {
        const result = { cleared: 0, failed: 0 };
        if (!(await this.pathExists(trashDir))) return { result, clearedOriginalPaths: [] as string[] };

        const allEntries = await this.liveTrashEntries(trashDir);
        for (const item of await fs.readdir(trashDir)) {
          // The manifest, and a replacement of it left by an interrupted write.
          if (item === TRASH_MANIFEST || item.startsWith(`${TRASH_MANIFEST}.`)) continue;

          const itemPath = path.join(trashDir, item);
          try {
            await shell.trashItem(itemPath);
            result.cleared++;
            log.debug(`Moved to system trash: ${itemPath}`);
          } catch (trashError) {
            log.error(`Failed to move to system trash: ${itemPath}`, trashError);
            result.failed++;
          }
        }

        // What could not be moved is still in the trash, so it stays listed.
        const remaining: TrashEntry[] = [];
        const clearedOriginalPaths: string[] = [];
        for (const entry of allEntries) {
          if (await this.pathExists(entry.trashPath)) remaining.push(entry);
          else clearedOriginalPaths.push(entry.originalPath);
        }
        await writeManifest(path.join(trashDir, TRASH_MANIFEST), remaining);
        return { result, clearedOriginalPaths };
      });

      if (clearedOriginalPaths.length > 0) {
        await this.removeCropEntriesByOriginalPaths(clearedOriginalPaths, outputDir);
      }

      log.debug(`Trash cleared: ${result.cleared} items`);
      return result;
    } catch (error) {
      log.error('Failed to clear trash:', error);
      throw error;
    }
  }

  /**
   * Clear specific trash entries by moving them to the system trash
   */
  async clearTrashEntries(ids: string[], outputDir: string): Promise<{ cleared: number; failed: number }> {
    const result = { cleared: 0, failed: 0 };
    if (ids.length === 0) return result;

    const trashDir = this.getTrashDirectory(outputDir);
    try {
      const clearedOriginalPaths = await withFolderLock(trashDir, async () => {
        const wanted = new Set(ids);
        const allEntries = await this.liveTrashEntries(trashDir);
        const clearedIds = new Set<string>();
        const paths: string[] = [];

        for (const entry of allEntries) {
          if (!wanted.has(entry.id)) continue;
          try {
            await shell.trashItem(entry.trashPath);
            result.cleared++;
            clearedIds.add(entry.id);
            paths.push(entry.originalPath);
            log.debug(`Moved selected trash item to system trash: ${entry.trashPath}`);
          } catch (trashError) {
            log.error(`Failed to move selected trash item to system trash: ${entry.trashPath}`, trashError);
            result.failed++;
          }
        }

        if (clearedIds.size > 0) {
          await writeManifest(
            path.join(trashDir, TRASH_MANIFEST),
            allEntries.filter(entry => !clearedIds.has(entry.id)),
          );
          await this.cleanupEmptyTrashDirs(trashDir);
        }
        return paths;
      });

      if (clearedOriginalPaths.length > 0) {
        await this.removeCropEntriesByOriginalPaths(clearedOriginalPaths, outputDir);
      }

      return result;
    } catch (error) {
      log.error('Failed to clear selected trash entries:', error);
      throw error;
    }
  }

  /**
   * Move entire result folders (active folder + mirrored trash/crop subfolders)
   * to the system trash and prune their manifest entries.
   */
  async removeFolders(
    folderNames: string[],
    outputDir: string
  ): Promise<{ removed: number; failed: number }> {
    const result = { removed: 0, failed: 0 };

    if (!folderNames || folderNames.length === 0) {
      return result;
    }

    try {
      const expandedOutputDir = expandTilde(outputDir);
      const resolvedOutputDir = path.resolve(expandedOutputDir);
      const trashDir = this.getTrashDirectory(resolvedOutputDir);
      const cropDir = this.getCropDirectory(resolvedOutputDir);

      const cleanedNames: string[] = [];

      for (const rawName of folderNames) {
        if (!rawName || rawName.includes('..') || rawName.includes('/') || rawName.includes('\\')) {
          log.warn(`Skipping invalid folder name: ${rawName}`);
          result.failed++;
          continue;
        }

        const folderName = rawName;
        let folderFailed = false;

        const targets = [
          path.join(resolvedOutputDir, folderName),
          path.join(trashDir, folderName),
          path.join(cropDir, folderName),
        ];

        for (const target of targets) {
          if (!(await this.pathExists(target))) continue;
          try {
            await shell.trashItem(target);
            log.debug(`Moved folder to system trash: ${target}`);
          } catch (trashError) {
            log.error(`Failed to move folder to system trash: ${target}`, trashError);
            folderFailed = true;
          }
        }

        if (folderFailed) {
          result.failed++;
        } else {
          result.removed++;
          cleanedNames.push(folderName);
        }
      }

      if (cleanedNames.length > 0) {
        const nameSet = new Set(cleanedNames);

        // Read under the lock, after the folders went: the manifests are read
        // raw here (the listing getters would already hide these entries), and
        // an entry appended for another folder meanwhile is kept.
        await withFolderLock(trashDir, async () => {
          const manifestPath = path.join(trashDir, TRASH_MANIFEST);
          const entries = await readManifest<TrashEntry>(manifestPath);
          const keep = entries.filter(entry => !nameSet.has(entry.originalParentFolder));
          if (keep.length !== entries.length) {
            await writeManifest(manifestPath, keep);
            await this.cleanupEmptyTrashDirs(trashDir);
          }
        });

        await withFolderLock(cropDir, async () => {
          const manifestPath = path.join(cropDir, CROP_MANIFEST);
          const entries = await readManifest<CropEntry>(manifestPath);
          const keep = entries.filter(entry => !nameSet.has(entry.originalParentFolder));
          if (keep.length !== entries.length) {
            await writeManifest(manifestPath, keep);
            await this.cleanupEmptyCropDirs(cropDir);
          }
        });
      }

      return result;
    } catch (error) {
      log.error('Failed to remove folders:', error);
      throw error;
    }
  }

  /**
   * Get trash image as base64 for display
   */
  async getTrashImageAsBase64(trashPath: string): Promise<string> {
    try {
      const expandedPath = expandTilde(trashPath);

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
      log.error('Failed to read trash image:', error);
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
        if (item === TRASH_MANIFEST || item.startsWith(`${TRASH_MANIFEST}.`)) continue;

        const itemPath = path.join(trashDir, item);
        const stats = await fs.stat(itemPath);

        if (stats.isDirectory()) {
          await this.removeEmptyDirsRecursive(itemPath);
        }
      }
    } catch (error) {
      log.warn('Failed to cleanup empty trash dirs:', error);
    }
  }

  /**
   * Clean up empty directories in crop folder
   */
  private async cleanupEmptyCropDirs(cropDir: string): Promise<void> {
    try {
      const items = await fs.readdir(cropDir);

      for (const item of items) {
        if (item === CROP_MANIFEST || item.startsWith(`${CROP_MANIFEST}.`)) continue;

        const itemPath = path.join(cropDir, item);
        const stats = await fs.stat(itemPath);

        if (stats.isDirectory()) {
          await this.removeEmptyDirsRecursive(itemPath);
        }
      }
    } catch (error) {
      log.warn('Failed to cleanup empty crop dirs:', error);
    }
  }

  /**
   * Rewrite the crop manifest with the provided entries, or remove it if empty
   */
  private async rewriteCropManifest(cropDir: string, entries: CropEntry[]): Promise<void> {
    await writeManifest(path.join(cropDir, CROP_MANIFEST), entries);
  }

  /**
   * Remove crop entries and backups for the provided original slide paths
   */
  private async removeCropEntriesByOriginalPaths(originalPaths: string[], outputDir: string): Promise<void> {
    if (originalPaths.length === 0) {
      return;
    }
    await withFolderLock(this.getCropDirectory(outputDir), () => this.pruneCropEntries(originalPaths, outputDir));
  }

  /** The body of `removeCropEntriesByOriginalPaths`, for callers that hold the crop folder's lock. */
  private async pruneCropEntries(originalPaths: string[], outputDir: string): Promise<void> {

    const cropDir = this.getCropDirectory(outputDir);
    const pathSet = new Set(originalPaths.map(item => path.resolve(item)));
    const allEntries = await this.getCropEntries(outputDir);
    const entriesToRemove = allEntries.filter(entry => pathSet.has(path.resolve(entry.originalPath)));

    for (const entry of entriesToRemove) {
      try {
        await fs.unlink(entry.cropPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          log.warn(`Failed to remove crop backup: ${entry.cropPath}`, error);
        }
      }
    }

    const entriesToKeep = allEntries.filter(entry => !pathSet.has(path.resolve(entry.originalPath)));
    await this.rewriteCropManifest(cropDir, entriesToKeep);
    await this.cleanupEmptyCropDirs(cropDir);
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

  /**
   * Read raw image bytes from an arbitrary path (file-picker / Results / developer
   * lab). Callers must already have rejected `..` segments at the IPC boundary.
   */
  async readImageBuffer(filePath: string): Promise<Uint8Array> {
    const buffer = await fs.readFile(filePath);
    return new Uint8Array(buffer);
  }
}

// Create singleton instance
export const slideExtractionService = new SlideExtractionService();
