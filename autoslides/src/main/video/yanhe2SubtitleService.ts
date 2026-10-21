/**
 * Writes a Yanhe 2.0 recording's transcript into the output folder as a
 * SubRip file, beside where the same lecture's Yanhekt screen download goes
 * and with that download's stem: `screen_<course>_<session>__c<id>s<id>.srt`.
 * A player opening the `.mp4` of that name loads it without being told.
 *
 * Like saved slides, it is filed under the Yanhekt lecture or not at all: no
 * Yanhekt sign-in or no matching course and session writes nothing.
 *
 * The times are the transcript's own plus `shift`, the delay the player's
 * captions use for this lecture (measured, or the fixed one from Settings).
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import { buildDownloadFileName } from '@common/downloadNaming';
import { lectureLabel } from '@common/lectureNaming';
import { transcriptToSrt } from '@common/yanhe2Transcript';
import type { Yanhe2SubtitlePrepared, Yanhe2SubtitleResult, Yanhe2SubtitleTarget } from '@common/yanhe2Subtitles';
import { createLogger } from '@main/infra/logger';
import { expandTilde } from '@main/infra/pathUtils';
import type { ConfigService } from '@main/platform/configService';
import type { Yanhe2Service } from '@main/platform/yanhe2/yanhe2Service';
import { lectureTargetOf, type Yanhe2TwinResolver } from '@main/platform/yanhe2/yanhe2TwinResolver';

const log = createLogger('Yanhe2Subtitles');

/** Byte order mark: without it some Windows players read a Chinese `.srt` in the system code page. */
const UTF8_BOM = '﻿';
/** Captions are never held back or brought forward by more than the setting allows. */
const MAX_SHIFT_SECONDS = 600;

function subIdOf(query: unknown): string {
  const subId = (query as { subId?: unknown } | null)?.subId;
  return typeof subId === 'string' ? subId : '';
}

/** The stem the Yanhekt screen download of that lecture is saved under. */
export function yanhe2SubtitleStem(target: Yanhe2SubtitleTarget): string {
  return buildDownloadFileName({
    name: `screen_${lectureLabel(target.courseTitle, target.sessionTitle)}`,
    courseId: target.courseId,
    sessionId: target.sessionId,
  });
}

export class Yanhe2SubtitleService {
  constructor(
    private readonly yanhe2Service: Yanhe2Service,
    private readonly twinResolver: Yanhe2TwinResolver,
    private readonly configService: ConfigService,
  ) {}

  /** Check the session has a transcript and find the Yanhekt lecture. Writes nothing. */
  async prepare(account: string, query: unknown): Promise<Yanhe2SubtitlePrepared> {
    const transcript = await this.yanhe2Service.getTranscript(account, subIdOf(query));
    if (transcript.kind !== 'ok') return { kind: transcript.kind };
    if (transcript.data.length === 0) return { kind: 'no_transcript' };
    const twin = await this.twinResolver.find(account, query);
    return twin.kind === 'ok' ? { kind: 'ok', target: lectureTargetOf(twin.data) } : twin;
  }

  async save(account: string, query: unknown, shift: unknown): Promise<Yanhe2SubtitleResult> {
    const seconds = typeof shift === 'number' && Number.isFinite(shift)
      ? Math.max(-MAX_SHIFT_SECONDS, Math.min(MAX_SHIFT_SECONDS, shift))
      : 0;
    const transcript = await this.yanhe2Service.getTranscript(account, subIdOf(query));
    if (transcript.kind !== 'ok') return { kind: transcript.kind };
    const srt = transcriptToSrt(transcript.data, seconds);
    if (!srt) return { kind: 'no_transcript' };
    const twin = await this.twinResolver.find(account, query);
    if (twin.kind !== 'ok') return twin;

    const outputDir = expandTilde(this.configService.getConfig().outputDirectory);
    const filePath = path.join(outputDir, `${yanhe2SubtitleStem(lectureTargetOf(twin.data))}.srt`);
    const partPath = `${filePath}.part`;
    try {
      await fs.mkdir(outputDir, { recursive: true });
      // Whole or not at all, like the other downloads.
      await fs.writeFile(partPath, UTF8_BOM + srt, 'utf8');
      await fs.rename(partPath, filePath);
      return { kind: 'ok', filePath };
    } catch (error) {
      await fs.rm(partPath, { force: true }).catch(() => { /* best effort */ });
      log.error('Yanhe 2.0 subtitles were not written:', error);
      return { kind: 'failed' };
    }
  }
}
