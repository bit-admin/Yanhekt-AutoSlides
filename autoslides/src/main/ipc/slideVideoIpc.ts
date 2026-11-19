import { ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { IpcServices } from './types';
import { expandTilde, hasTraversalSegment, isPathInsideRoot } from '@main/infra/pathUtils';
import { createLogger } from '@main/infra/logger';
import { SlideVideoCancelledError } from '@main/video/slideVideoService';
import {
  DEFAULT_SLIDE_VIDEO_OPTIONS,
  SLIDE_VIDEO_AUDIO_BITRATES,
  SLIDE_VIDEO_AUDIO_FILTERS,
  SLIDE_VIDEO_CRFS,
  SLIDE_VIDEO_REPEATS,
  SLIDE_VIDEO_RESOLUTIONS,
  type SlideVideoOptions,
} from '@common/slideVideo';
import { isLectureAudioExt, isLectureVideoExt } from '@common/lectureVideoNaming';

const log = createLogger('SlideVideoIpc');

export interface SlideVideoRequest {
  slidesFolder: string;
  /** The session's screen recording, when one is on disk. */
  screenPath?: string | null;
  /** The session's classroom mic `.aac`, when one is on disk. */
  micPath?: string | null;
  options?: Partial<SlideVideoOptions>;
}

function normalizeOptions(raw: Partial<SlideVideoOptions> | undefined): SlideVideoOptions {
  const o = { ...DEFAULT_SLIDE_VIDEO_OPTIONS };
  if (SLIDE_VIDEO_RESOLUTIONS.includes(raw?.resolution as never)) o.resolution = raw!.resolution!;
  if (SLIDE_VIDEO_CRFS.includes(raw?.crf as never)) o.crf = raw!.crf!;
  if (SLIDE_VIDEO_REPEATS.includes(raw?.repeatSeconds as never)) o.repeatSeconds = raw!.repeatSeconds!;
  if (SLIDE_VIDEO_AUDIO_BITRATES.includes(raw?.audioBitrateKbps as never)) o.audioBitrateKbps = raw!.audioBitrateKbps!;
  if (raw?.audioFilter && raw.audioFilter in SLIDE_VIDEO_AUDIO_FILTERS) o.audioFilter = raw.audioFilter;
  if (raw?.audioSource === 'screen' || raw?.audioSource === 'mic') o.audioSource = raw.audioSource;
  return o;
}

function fileInOutputDir(outputDir: string, candidate: unknown, isKind: (ext: string) => boolean): string | null {
  if (typeof candidate !== 'string' || !candidate || hasTraversalSegment(candidate)) return null;
  if (!isPathInsideRoot(outputDir, candidate) || !isKind(path.extname(candidate))) return null;
  return fs.existsSync(candidate) ? path.resolve(candidate) : null;
}

export function registerSlideVideoIpcHandlers(services: IpcServices): void {
  const { configService, slideVideoService, slideTimelineService } = services;

  ipcMain.handle('slideVideo:make', async (event, request: SlideVideoRequest) => {
    const outputDir = expandTilde(configService.getConfig().outputDirectory);
    const folder = request?.slidesFolder;
    if (typeof folder !== 'string' || !folder || hasTraversalSegment(folder) || !isPathInsideRoot(outputDir, folder)
      || path.resolve(folder) === path.resolve(outputDir)) {
      throw new Error('The slides folder is outside the output folder');
    }
    const stat = await fs.promises.stat(folder).catch(() => null);
    if (!stat?.isDirectory()) throw new Error('The slides folder is missing');

    const timeline = await slideTimelineService.read(folder, { afterWrites: true });
    if (!timeline?.events?.length) throw new Error('This slides folder has no timeline.json');

    const options = normalizeOptions(request.options);
    const screen = fileInOutputDir(outputDir, request.screenPath, isLectureVideoExt);
    const mic = fileInOutputDir(outputDir, request.micPath, isLectureAudioExt);
    const audioPath = options.audioSource === 'mic' ? mic ?? screen : screen ?? mic;
    if (!audioPath) throw new Error('No screen recording or classroom mic audio for this session');

    try {
      return await slideVideoService.make({ slidesFolder: folder, timeline, audioPath, options }, (progress) => {
        if (!event.sender.isDestroyed()) event.sender.send('slideVideo:progress', progress);
      });
    } catch (error) {
      if (!(error instanceof SlideVideoCancelledError)) log.error('Slide video failed:', folder, error);
      throw error;
    }
  });

  ipcMain.handle('slideVideo:cancel', async () => slideVideoService.cancel());
  ipcMain.handle('slideVideo:isActive', async () => slideVideoService.isActive());
}
