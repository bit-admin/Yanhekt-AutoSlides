/**
 * PDF Service
 * Handles PDF generation from slide images using PDFKit
 */

import { app } from 'electron';
import fs from 'fs';
import PDFDocument from 'pdfkit';
import { sharpService } from './sharpService';

export interface PdfMakeOptions {
  reduceEnabled: boolean;
  effort: 'standard' | 'compact' | 'minimal' | 'custom';
  customColors?: number | null;   // Original/256/128/64/32/16
  customWidth?: number | null;    // Original (1920)/1600/1280/960/854
  customHeight?: number | null;   // Original (1080)/900/720/540/480
}

export interface FolderEntry {
  name: string;      // Folder display name (without slides_ prefix)
  path: string;      // Full folder path
  images: string[];  // Image paths sorted a-z
}

// Effort presets: { colors, width, height }
const EFFORT_PRESETS: Record<string, { colors: number; width: number; height: number }> = {
  standard: { colors: 128, width: 1280, height: 720 },
  compact: { colors: 64, width: 960, height: 540 },
  minimal: { colors: 16, width: 854, height: 480 },
};

// Default page size (original image dimensions)
const DEFAULT_PAGE_SIZE = { width: 1920, height: 1080 };

export class PdfService {
  /**
   * Get page size based on options
   */
  private getPageSize(options: PdfMakeOptions): { width: number; height: number } {
    if (!options.reduceEnabled) {
      return DEFAULT_PAGE_SIZE;
    }

    if (options.effort !== 'custom') {
      const preset = EFFORT_PRESETS[options.effort];
      return { width: preset.width, height: preset.height };
    }

    // Custom mode
    return {
      width: options.customWidth || DEFAULT_PAGE_SIZE.width,
      height: options.customHeight || DEFAULT_PAGE_SIZE.height,
    };
  }

  /**
   * Get processing parameters based on options
   */
  private getProcessingParams(options: PdfMakeOptions): {
    colors: number | null;
    width: number | null;
    height: number | null;
  } {
    if (!options.reduceEnabled) {
      return { colors: null, width: null, height: null };
    }

    if (options.effort !== 'custom') {
      const preset = EFFORT_PRESETS[options.effort];
      return {
        colors: preset.colors,
        width: preset.width,
        height: preset.height,
      };
    }

    // Custom mode
    return {
      colors: options.customColors || null,
      width: options.customWidth || null,
      height: options.customHeight || null,
    };
  }

  /**
   * Generate PDF from folders
   * @param folders Array of folder entries with images
   * @param options PDF generation options
   * @param outputPath Output PDF file path
   * @param onProgress Progress callback (current, total)
   * @returns Result with success status and path/error
   */
  async makePdf(
    folders: FolderEntry[],
    options: PdfMakeOptions,
    outputPath: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
      // Calculate total images
      const totalImages = folders.reduce((sum, f) => sum + f.images.length, 0);
      if (totalImages === 0) {
        return { success: false, error: 'No images to process' };
      }

      // Get page size
      const pageSize = this.getPageSize(options);

      // Create PDF document with app metadata
      // font: null prevents loading default Helvetica font (we only use images, no text)
      const appName = app.getName();
      const appVersion = app.getVersion();
      const doc = new PDFDocument({
        autoFirstPage: false,
        bufferPages: false,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - font: null is valid PDFKit option to skip loading default fonts
        font: null,
        info: {
          Title: 'Slides',
          Author: appName,
          Creator: `${appName} ${appVersion}`,
          Producer: `${appName} ${appVersion}`,
        },
      });

      // Create write stream
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      let processed = 0;
      const params = this.getProcessingParams(options);

      // Process each folder
      for (const folder of folders) {
        for (let i = 0; i < folder.images.length; i++) {
          const imagePath = folder.images[i];

          // Read image
          let imageBuffer = await fs.promises.readFile(imagePath);

          // Process image if reduction enabled
          if (options.reduceEnabled && sharpService.isAvailable()) {
            imageBuffer = Buffer.from(
              await sharpService.processImageForPdf(new Uint8Array(imageBuffer), {
                colors: params.colors,
                width: params.width,
                height: params.height,
              })
            );
          }

          // Add page with fixed size
          doc.addPage({
            size: [pageSize.width, pageSize.height],
            margin: 0,
          });

          // Add image to page
          doc.image(imageBuffer, 0, 0, {
            width: pageSize.width,
            height: pageSize.height,
          });

          // Add TOC bookmark on first image of each folder
          if (i === 0) {
            doc.outline.addItem(folder.name);
          }

          // Update progress
          processed++;
          onProgress?.(processed, totalImages);
        }
      }

      // Finalize PDF
      doc.end();

      // Wait for write to complete
      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      return { success: true, path: outputPath };
    } catch (error) {
      console.error('PDF generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Create singleton instance
export const pdfService = new PdfService();
