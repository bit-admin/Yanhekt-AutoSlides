/**
 * PDF Service
 * Handles PDF generation from slide images using PDFKit
 */

import { app } from 'electron';
import fs from 'fs';
import PDFDocument from 'pdfkit';
import PptxGenJS from 'pptxgenjs';
import { sharpService } from '@main/infra/sharpService';
import {
  chineseToPinyin,
  containsCjk,
  resolveSystemCjkFont,
  translateSessionToEnglish,
  type SystemCjkFont,
} from './coverFontService';
import { createLogger } from '@main/infra/logger';
const log = createLogger('Pdf');

export type AspectRatio = '16:9' | '4:3';

export interface CoverPageInfo {
  courseName: string;
  sessionName?: string;
  copyrightText: string;
  footerText: string;
}

export interface PdfMakeOptions {
  reduceEnabled: boolean;
  aspectRatio?: AspectRatio;
  effort: 'standard' | 'compact' | 'minimal' | 'custom';
  customColors?: number | null;
  customWidth?: number | null;
  customHeight?: number | null;
  cover?: CoverPageInfo;
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

  /**
   * Rough height (in inches) needed to render `text` inside a PPTX text box
   * of `widthInches` at `fontPt` points. PptxGenJS shapes don't grow with
   * their content, so we pre-size them ourselves to avoid an oversized box.
   *
   * The caller adds an addText() `margin` for internal padding — that goes
   * INTO the box, so include it in our total height. Heuristic uses ~0.42em
   * average glyph width (Times-class faces are narrower than 0.5em) and
   * ~1.2x line height. Capped at half the slide so a runaway string can't
   * push off the page.
   */
  private estimatePptxTextHeight(
    text: string,
    widthInches: number,
    fontPt: number,
    slideHeightInches: number,
    paraSpacePt: number,
    marginPt: number
  ): number {
    const lineHeightInches = (fontPt * 1.2) / 72;
    const avgCharWidthInches = (fontPt * 0.42) / 72;
    const marginInches = marginPt / 72;
    const usableWidth = Math.max(0.5, widthInches - marginInches * 2);
    const charsPerLine = Math.max(1, Math.floor(usableWidth / avgCharWidthInches));
    const paragraphs = text.split('\n');
    let totalLines = 0;
    for (const paragraph of paragraphs) {
      const trimmed = paragraph.trimEnd();
      const len = trimmed.length;
      totalLines += len === 0 ? 1 : Math.ceil(len / charsPerLine);
    }
    const paragraphGapInches = (paraSpacePt / 72) * Math.max(0, paragraphs.length - 1);
    const verticalPaddingInches = marginInches * 2;
    const estimated = totalLines * lineHeightInches + paragraphGapInches + verticalPaddingInches;
    return Math.min(slideHeightInches * 0.5, Math.max(0.4, estimated));
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
   * Try to register a system CJK font on the document.
   * Returns the font alias if registration succeeded, or null on failure.
   */
  private tryRegisterCjkFont(
    doc: PDFKit.PDFDocument,
    font: SystemCjkFont
  ): string | null {
    try {
      if (font.postScriptName) {
        doc.registerFont('cjk', font.path, font.postScriptName);
      } else {
        doc.registerFont('cjk', font.path);
      }
      return 'cjk';
    } catch (error) {
      log.warn(
        `[pdfService] Failed to register CJK font ${font.path}:`,
        error instanceof Error ? error.message : error
      );
      return null;
    }
  }

  private renderPdfCoverPage(
    doc: PDFKit.PDFDocument,
    cover: CoverPageInfo,
    pageSize: { width: number; height: number }
  ): void {
    doc.addPage({ size: [pageSize.width, pageSize.height], margin: 0 });

    const systemFont = resolveSystemCjkFont();
    const cjkAlias = systemFont ? this.tryRegisterCjkFont(doc, systemFont) : null;
    const usePinyin = cjkAlias === null;

    const courseText = usePinyin && containsCjk(cover.courseName)
      ? chineseToPinyin(cover.courseName)
      : cover.courseName;
    const sessionText = cover.sessionName
      ? (usePinyin ? translateSessionToEnglish(cover.sessionName) : cover.sessionName)
      : undefined;

    const cjkFontName = cjkAlias ?? 'Helvetica';

    // Sizes scale off page height so they look balanced at any aspect ratio.
    const courseFontSize = Math.round(pageSize.height * 0.07);
    const sessionFontSize = Math.round(pageSize.height * 0.04);
    const copyrightFontSize = Math.max(14, Math.round(pageSize.height * 0.024));
    const footerFontSize = Math.max(10, Math.round(pageSize.height * 0.014));

    const sidePad = Math.round(pageSize.width * 0.1);
    const textBoxWidth = pageSize.width - sidePad * 2;
    const copyrightBoxWidth = Math.round(pageSize.width * 0.72);
    const copyrightX = (pageSize.width - copyrightBoxWidth) / 2;

    // Course name
    doc
      .font(cjkFontName)
      .fontSize(courseFontSize)
      .fillColor('#1a1a1a')
      .text(courseText, sidePad, pageSize.height * 0.16, {
        width: textBoxWidth,
        align: 'center',
        lineBreak: true,
      });

    // Session name (only when provided — batch mode)
    if (sessionText) {
      doc
        .font(cjkFontName)
        .fontSize(sessionFontSize)
        .fillColor('#555555')
        .text(sessionText, sidePad, pageSize.height * 0.3, {
          width: textBoxWidth,
          align: 'center',
          lineBreak: true,
        });
    }

    // Copyright block: framed box, left-aligned, two paragraphs.
    const copyrightY = pageSize.height * 0.45;
    const copyrightTextOptions = {
      width: copyrightBoxWidth,
      align: 'left' as const,
      lineGap: copyrightFontSize * 0.3,
      paragraphGap: copyrightFontSize * 0.8,
    };
    const innerPad = Math.round(copyrightFontSize * 1.4);

    doc.font('Times-Roman').fontSize(copyrightFontSize);
    const textHeight = doc.heightOfString(cover.copyrightText, {
      width: copyrightBoxWidth - innerPad * 2,
      lineGap: copyrightTextOptions.lineGap,
      paragraphGap: copyrightTextOptions.paragraphGap,
    });
    const boxHeight = textHeight + innerPad * 2;

    // Draw the framing rectangle first.
    doc
      .lineWidth(1.5)
      .strokeColor('#000000')
      .rect(copyrightX, copyrightY, copyrightBoxWidth, boxHeight)
      .stroke();

    // Then the text inside, left-aligned.
    doc
      .font('Times-Roman')
      .fontSize(copyrightFontSize)
      .fillColor('#1a1a1a')
      .text(cover.copyrightText, copyrightX + innerPad, copyrightY + innerPad, {
        ...copyrightTextOptions,
        width: copyrightBoxWidth - innerPad * 2,
      });

    // Footer
    const footerY = pageSize.height - Math.round(pageSize.height * 0.05);
    doc
      .font('Helvetica')
      .fontSize(footerFontSize)
      .fillColor('#888888')
      .text(cover.footerText, sidePad, footerY, {
        width: textBoxWidth,
        align: 'center',
        lineBreak: false,
      });
  }

  private addPptxCoverSlide(
    pptx: PptxGenJS,
    cover: CoverPageInfo,
    slideSize: { width: number; height: number }
  ): void {
    const slide = pptx.addSlide();
    slide.background = { color: 'FFFFFF' };

    const cjkFont = 'Microsoft YaHei';
    const latinFont = 'Arial';

    // Course name
    slide.addText(cover.courseName, {
      x: 0,
      y: slideSize.height * 0.16,
      w: slideSize.width,
      h: slideSize.height * 0.12,
      align: 'center',
      valign: 'middle',
      fontSize: Math.round(slideSize.height * 7),
      bold: true,
      color: '1A1A1A',
      fontFace: containsCjk(cover.courseName) ? cjkFont : latinFont,
    });

    // Session name (only in batch mode)
    if (cover.sessionName) {
      slide.addText(cover.sessionName, {
        x: 0,
        y: slideSize.height * 0.3,
        w: slideSize.width,
        h: slideSize.height * 0.07,
        align: 'center',
        valign: 'middle',
        fontSize: Math.round(slideSize.height * 4),
        color: '555555',
        fontFace: containsCjk(cover.sessionName) ? cjkFont : latinFont,
      });
    }

    // Copyright block: black-bordered frame, left-aligned. PPTX text shapes
    // don't auto-resize to their content, so estimate the wrapped height to
    // keep the border snug around the text instead of a fixed slab.
    const copyrightWidth = slideSize.width * 0.72;
    const copyrightFontPt = Math.max(11, Math.round(slideSize.height * 1.6));
    const paraSpacePt = 4;
    const marginPt = 6;
    const copyrightHeight = this.estimatePptxTextHeight(
      cover.copyrightText,
      copyrightWidth,
      copyrightFontPt,
      slideSize.height,
      paraSpacePt,
      marginPt
    );
    slide.addText(cover.copyrightText, {
      x: (slideSize.width - copyrightWidth) / 2,
      y: slideSize.height * 0.45,
      w: copyrightWidth,
      h: copyrightHeight,
      align: 'left',
      valign: 'top',
      fontSize: copyrightFontPt,
      color: '1A1A1A',
      fontFace: 'Times New Roman',
      paraSpaceAfter: paraSpacePt,
      margin: marginPt,
      line: { color: '000000', width: 1.5 },
    });

    // Footer
    slide.addText(cover.footerText, {
      x: 0,
      y: slideSize.height - slideSize.height * 0.06,
      w: slideSize.width,
      h: slideSize.height * 0.04,
      align: 'center',
      valign: 'middle',
      fontSize: Math.max(9, Math.round(slideSize.height * 1.4)),
      color: '888888',
      fontFace: latinFont,
    });
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

      // Create PDF document with app metadata.
      // When no cover page is requested we keep font:null so the existing
      // image-only pipeline stays byte-for-byte identical to before.
      const appName = app.getName();
      const appVersion = app.getVersion();
      const wantsCover = !!options.cover;
      const docOptions: ConstructorParameters<typeof PDFDocument>[0] = {
        autoFirstPage: false,
        bufferPages: false,
        info: {
          Title: 'Slides',
          Author: appName,
          Creator: `${appName} ${appVersion}`,
          Producer: `${appName} ${appVersion}`,
        },
      };
      if (!wantsCover) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - font: null is valid PDFKit option to skip loading default fonts
        docOptions.font = null;
      }
      const doc = new PDFDocument(docOptions);

      // Create write stream
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      // Render cover page first (before any image pages) if requested.
      if (options.cover) {
        this.renderPdfCoverPage(doc, options.cover, pageSize);
      }

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
      log.error('PDF generation failed:', error);
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

      if (options.cover) {
        this.addPptxCoverSlide(pptx, options.cover, slideSize);
      }

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
      log.error('PPTX generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Create singleton instance
export const pdfService = new PdfService();
