/**
 * PDF Service
 * Handles PDF generation from slide images using PDFKit
 */

import { app } from 'electron';
import fs from 'fs';
import PDFDocument from 'pdfkit';
import PptxGenJS from 'pptxgenjs';
import { sharpService } from './sharpService';

export type AspectRatio = '16:9' | '4:3';

export interface PdfMakeOptions {
  reduceEnabled: boolean;
  aspectRatio?: AspectRatio;
  effort: 'standard' | 'compact' | 'minimal' | 'custom';
  customColors?: number | null;
  customWidth?: number | null;
  customHeight?: number | null;
}

export interface FolderEntry {
  name: string;      // Folder display name (without slides_ prefix)
  path: string;      // Full folder path
  images: string[];  // Image paths sorted a-z
}

type ImageDimensions = { width: number; height: number };
type PdfImagePlacement =
  | { cover: [number, number]; align: 'center'; valign: 'center' }
  | { fit: [number, number]; align: 'center'; valign: 'center' };
type PptxImageSizing = { type: 'cover' | 'contain'; w: number; h: number };

const EFFORT_PRESETS: Record<AspectRatio, Record<string, { colors: number; width: number; height: number }>> = {
  '16:9': {
    standard: { colors: 128, width: 1280, height: 720 },
    compact: { colors: 64, width: 960, height: 540 },
    minimal: { colors: 16, width: 854, height: 480 },
  },
  '4:3': {
    standard: { colors: 128, width: 960, height: 720 },
    compact: { colors: 64, width: 720, height: 540 },
    minimal: { colors: 16, width: 640, height: 480 },
  },
};

const DEFAULT_PAGE_SIZE: Record<AspectRatio, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '4:3': { width: 1440, height: 1080 },
};

export class PdfService {
  private getAspectRatio(options: PdfMakeOptions): AspectRatio {
    return options.aspectRatio === '4:3' ? '4:3' : '16:9';
  }

  /**
   * Get page size based on options
   */
  private getPageSize(options: PdfMakeOptions): { width: number; height: number } {
    const ratio = this.getAspectRatio(options);
    const defaultSize = DEFAULT_PAGE_SIZE[ratio];

    if (!options.reduceEnabled) {
      return defaultSize;
    }

    if (options.effort !== 'custom') {
      const preset = EFFORT_PRESETS[ratio][options.effort];
      return { width: preset.width, height: preset.height };
    }

    return {
      width: options.customWidth || defaultSize.width,
      height: options.customHeight || defaultSize.height,
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

    const ratio = this.getAspectRatio(options);

    if (options.effort !== 'custom') {
      const preset = EFFORT_PRESETS[ratio][options.effort];
      return {
        colors: preset.colors,
        width: preset.width,
        height: preset.height,
      };
    }

    return {
      colors: options.customColors || null,
      width: options.customWidth || null,
      height: options.customHeight || null,
    };
  }

  private getImagePlacement(
    dimensions: ImageDimensions | null,
    pageSize: { width: number; height: number }
  ): PdfImagePlacement {
    const centered = {
      align: 'center' as const,
      valign: 'center' as const,
    };
    const box: [number, number] = [pageSize.width, pageSize.height];

    if (!dimensions) {
      return { fit: box, ...centered };
    }

    if (this.shouldCropToFill(dimensions, pageSize)) {
      return { cover: box, ...centered };
    }

    return { fit: box, ...centered };
  }

  private shouldCropToFill(
    dimensions: ImageDimensions | null,
    targetSize: { width: number; height: number }
  ): boolean {
    if (!dimensions) return false;

    const sourceAspect = dimensions.width / dimensions.height;
    const targetAspect = targetSize.width / targetSize.height;
    return sourceAspect > targetAspect + 0.001;
  }

  private getPptxSlideSize(options: PdfMakeOptions): { width: number; height: number } {
    return this.getAspectRatio(options) === '4:3'
      ? { width: 10, height: 7.5 }
      : { width: 13.333, height: 7.5 };
  }

  private getPptxImageSizing(
    dimensions: ImageDimensions | null,
    slideSize: { width: number; height: number }
  ): PptxImageSizing {
    return {
      type: this.shouldCropToFill(dimensions, slideSize) ? 'cover' : 'contain',
      w: slideSize.width,
      h: slideSize.height,
    };
  }

  private async prepareImageForExport(
    imagePath: string,
    options: PdfMakeOptions,
    params: { colors: number | null; width: number | null; height: number | null }
  ): Promise<{ imageBuffer: Buffer; imageDimensions: ImageDimensions | null }> {
    let imageBuffer = await fs.promises.readFile(imagePath);
    const imageDimensions = sharpService.isAvailable()
      ? await sharpService.getImageDimensions(new Uint8Array(imageBuffer))
      : null;

    if (options.reduceEnabled && sharpService.isAvailable()) {
      imageBuffer = Buffer.from(
        await sharpService.processImageForPdf(new Uint8Array(imageBuffer), {
          colors: params.colors,
          width: params.width,
          height: params.height,
        })
      );
    }

    return { imageBuffer, imageDimensions };
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
          const { imageBuffer, imageDimensions } = await this.prepareImageForExport(
            imagePath,
            options,
            params
          );

          // Add page with fixed size
          doc.addPage({
            size: [pageSize.width, pageSize.height],
            margin: 0,
          });

          // Add image to page
          doc.image(imageBuffer, 0, 0, {
            ...this.getImagePlacement(imageDimensions, pageSize),
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

  /**
   * Generate PPTX from folders
   * @param folders Array of folder entries with images
   * @param options Export options shared with PDF generation
   * @param outputPath Output PPTX file path
   * @param onProgress Progress callback (current, total)
   * @returns Result with success status and path/error
   */
  async makePptx(
    folders: FolderEntry[],
    options: PdfMakeOptions,
    outputPath: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
      const totalImages = folders.reduce((sum, f) => sum + f.images.length, 0);
      if (totalImages === 0) {
        return { success: false, error: 'No images to process' };
      }

      const slideSize = this.getPptxSlideSize(options);
      const pptx = new PptxGenJS();
      const appName = app.getName();
      const layoutName = this.getAspectRatio(options) === '4:3'
        ? 'AUTOSLIDES_4_3'
        : 'AUTOSLIDES_16_9';

      pptx.author = appName;
      pptx.company = appName;
      pptx.subject = 'Slides';
      pptx.title = 'Slides';
      pptx.defineLayout({
        name: layoutName,
        width: slideSize.width,
        height: slideSize.height,
      });
      pptx.layout = layoutName;
      pptx.theme = {
        headFontFace: 'Arial',
        bodyFontFace: 'Arial',
      };

      let processed = 0;
      const params = this.getProcessingParams(options);

      for (const folder of folders) {
        for (const imagePath of folder.images) {
          const { imageBuffer, imageDimensions } = await this.prepareImageForExport(
            imagePath,
            options,
            params
          );
          const slide = pptx.addSlide();
          const imageData = `data:image/png;base64,${imageBuffer.toString('base64')}`;

          slide.background = { color: 'FFFFFF' };
          slide.addImage({
            data: imageData,
            x: 0,
            y: 0,
            w: slideSize.width,
            h: slideSize.height,
            sizing: this.getPptxImageSizing(imageDimensions, slideSize),
          });

          processed++;
          onProgress?.(processed, totalImages);
        }
      }

      await pptx.writeFile({ fileName: outputPath });

      return { success: true, path: outputPath };
    } catch (error) {
      console.error('PPTX generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Create singleton instance
export const pdfService = new PdfService();
