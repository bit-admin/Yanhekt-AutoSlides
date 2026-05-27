/**
 * Yuketang Export Service
 * Handles downloading slides from Yuketang education platform.
 * Adapted from REFERENCE/src/yuketang-export.js for AutoSlides conventions.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { pdfService } from './pdfService';
import type { FolderEntry, PdfMakeOptions } from './pdfService';

const LESSON_API = 'https://www.yuketang.cn/api/v3/lesson-summary/student';
const CLASS_PRESENTATION_API = 'https://www.yuketang.cn/api/v3/lesson/presentation/fetch';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function sanitizeFileName(name: string): string {
  const cleaned = String(name ?? '')
    .replace(/[\\/:*?"<>|]/g, '.')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'untitled';
}

async function fetchJson(url: string, headers: Record<string, string>): Promise<unknown> {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}): ${url}`);
  }
  const payload = await response.json() as { code: number; message?: string; data: unknown };
  if (payload.code !== 0) {
    throw new Error(payload.message || `API failed with code ${payload.code}`);
  }
  return payload.data;
}

async function fetchImage(url: string, headers: Record<string, string>): Promise<Buffer> {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Slide download failed (${response.status}): ${url}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

interface Slide {
  cover: string;
  [key: string]: unknown;
}

interface PresentationInfo {
  id: string;
  title?: string;
}

interface LessonData {
  lesson?: { title?: string };
  presentations?: PresentationInfo[];
}

interface PresentationData {
  slides?: Slide[];
  presentation?: { title?: string };
  title?: string;
}

export interface YuketangExportResult {
  lessonId: string;
  lessonTitle: string;
  lessonDir: string;
  presentationCount: number;
  format: string;
  pdfPath?: string;
}

/**
 * Download slides for a lesson report and save as images (+ optional PDF).
 */
export async function exportLessonSummary({
  lessonId,
  outputDir,
  format,
  pdfOutputPath,
  cookieHeader,
  onProgress,
}: {
  lessonId: string;
  outputDir: string;
  format: 'pdf' | 'images';
  pdfOutputPath?: string;
  cookieHeader: string;
  onProgress: (message: string) => void;
}): Promise<YuketangExportResult> {
  const headers: Record<string, string> = {
    cookie: cookieHeader,
    'user-agent': USER_AGENT,
  };

  onProgress('Loading lesson metadata...');
  const lessonData = await fetchJson(
    `${LESSON_API}?lesson_id=${encodeURIComponent(lessonId)}`,
    headers
  ) as LessonData;

  const lessonTitle = sanitizeFileName(lessonData?.lesson?.title || `lesson_${lessonId}`);
  const presentations = Array.isArray(lessonData?.presentations) ? lessonData.presentations : [];
  const folderName = `slides_${lessonTitle}`;
  const lessonDir = path.join(outputDir, folderName);
  await fs.mkdir(lessonDir, { recursive: true });

  // Download all presentations as images into flat folder
  for (let i = 0; i < presentations.length; i += 1) {
    const presentation = presentations[i];
    const presentationId = presentation.id;
    const presentationTitle = presentation.title || `presentation_${presentationId}`;
    onProgress(`Loading presentation ${i + 1}/${presentations.length}: ${presentationTitle}`);

    const presentationData = await fetchJson(
      `${LESSON_API}/presentation?presentation_id=${encodeURIComponent(
        presentationId
      )}&lesson_id=${encodeURIComponent(lessonId)}`,
      headers
    ) as PresentationData;
    const slides = Array.isArray(presentationData?.slides) ? presentationData.slides : [];

    const presIndex = String(i + 1).padStart(2, '0');
    for (let j = 0; j < slides.length; j += 1) {
      const slide = slides[j];
      onProgress(
        `Presentation ${i + 1}: downloading slide ${j + 1}/${slides.length}...`
      );
      const buffer = await fetchImage(slide.cover, headers);
      const slideIndex = String(j + 1).padStart(3, '0');
      const output = path.join(lessonDir, `Slide_${presIndex}_${slideIndex}.png`);
      await fs.writeFile(output, buffer);
    }
  }

  // If PDF format, generate PDF from images using pdfService
  let finalPdfPath: string | undefined;
  if (format === 'pdf' && pdfOutputPath) {
    onProgress('Generating PDF...');
    const imageFiles = await getImageFiles(lessonDir);
    if (imageFiles.length > 0) {
      const folderEntry: FolderEntry = {
        name: lessonTitle,
        path: lessonDir,
        images: imageFiles,
      };
      const pdfOptions: PdfMakeOptions = {
        reduceEnabled: false,
        effort: 'standard',
      };
      await pdfService.makePdf([folderEntry], pdfOptions, pdfOutputPath);
      finalPdfPath = pdfOutputPath;
    }
  }

  onProgress(`Done. Exported ${presentations.length} presentation(s).`);
  return {
    lessonId,
    lessonTitle,
    lessonDir,
    presentationCount: presentations.length,
    format,
    pdfPath: finalPdfPath,
  };
}

/**
 * Download slides for a class presentation (captured via API intercept) and save as images (+ optional PDF).
 */
export async function exportClassPresentation({
  presentationId,
  authorization,
  cookieHeader,
  outputDir,
  format,
  pdfOutputPath,
  onProgress,
}: {
  presentationId: string;
  authorization: string;
  cookieHeader: string;
  outputDir: string;
  format: 'pdf' | 'images';
  pdfOutputPath?: string;
  onProgress: (message: string) => void;
}): Promise<YuketangExportResult> {
  const headers: Record<string, string> = {
    authorization,
    cookie: cookieHeader,
    'user-agent': USER_AGENT,
  };

  onProgress('Loading class presentation metadata...');
  const presentationData = await fetchJson(
    `${CLASS_PRESENTATION_API}?presentation_id=${encodeURIComponent(presentationId)}`,
    headers
  ) as PresentationData;

  const slides = Array.isArray(presentationData?.slides) ? presentationData.slides : [];
  const presentationTitle = sanitizeFileName(
    presentationData?.presentation?.title || presentationData?.title || `presentation_${presentationId}`
  );
  const folderName = `slides_${presentationTitle}`;
  const lessonDir = path.join(outputDir, folderName);
  await fs.mkdir(lessonDir, { recursive: true });

  // Download slides as images (single presentation: PP = 01)
  for (let i = 0; i < slides.length; i += 1) {
    const slide = slides[i];
    onProgress(`Class presentation: downloading slide ${i + 1}/${slides.length}...`);
    const buffer = await fetchImage(slide.cover, headers);
    const slideIndex = String(i + 1).padStart(3, '0');
    await fs.writeFile(path.join(lessonDir, `Slide_01_${slideIndex}.png`), buffer);
  }

  // If PDF format, generate PDF from images using pdfService
  let finalPdfPath: string | undefined;
  if (format === 'pdf' && pdfOutputPath) {
    onProgress('Generating PDF...');
    const imageFiles = await getImageFiles(lessonDir);
    if (imageFiles.length > 0) {
      const folderEntry: FolderEntry = {
        name: presentationTitle,
        path: lessonDir,
        images: imageFiles,
      };
      const pdfOptions: PdfMakeOptions = {
        reduceEnabled: false,
        effort: 'standard',
      };
      await pdfService.makePdf([folderEntry], pdfOptions, pdfOutputPath);
      finalPdfPath = pdfOutputPath;
    }
  }

  onProgress('Done. Exported 1 presentation.');
  return {
    lessonId: '',
    lessonTitle: presentationTitle,
    lessonDir,
    presentationCount: 1,
    format,
    pdfPath: finalPdfPath,
  };
}

/**
 * Get sorted image file paths from a directory.
 */
async function getImageFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter(e => e.isFile() && /\.(png|jpg|jpeg|webp)$/i.test(e.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(e => path.join(dir, e.name));
}

/**
 * Fetch the lesson title from Yuketang API (for save dialog default name).
 */
export async function fetchLessonTitle(lessonId: string, cookieHeader: string): Promise<string> {
  const headers: Record<string, string> = {
    cookie: cookieHeader,
    'user-agent': USER_AGENT,
  };
  const lessonData = await fetchJson(
    `${LESSON_API}?lesson_id=${encodeURIComponent(lessonId)}`,
    headers
  ) as LessonData;
  return sanitizeFileName(lessonData?.lesson?.title || `lesson_${lessonId}`);
}

/**
 * Fetch the class presentation title from Yuketang API (for save dialog default name).
 */
export async function fetchClassPresentationTitle(
  presentationId: string,
  authorization: string,
  cookieHeader: string
): Promise<string> {
  const headers: Record<string, string> = {
    authorization,
    cookie: cookieHeader,
    'user-agent': USER_AGENT,
  };
  const presentationData = await fetchJson(
    `${CLASS_PRESENTATION_API}?presentation_id=${encodeURIComponent(presentationId)}`,
    headers
  ) as PresentationData;
  return sanitizeFileName(
    presentationData?.presentation?.title || presentationData?.title || `presentation_${presentationId}`
  );
}
