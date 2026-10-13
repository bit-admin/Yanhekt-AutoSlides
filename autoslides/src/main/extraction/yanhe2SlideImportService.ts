/**
 * Saves a Yanhe 2.0 recording's server slides into the output folder, as the
 * `slides_*` folder of the same lecture on Yanhekt.
 *
 * `prepare` finds that lecture (course number + start time, see
 * `platform/yanhe2/yanhe2Twin.ts`) and names the folder; `save` downloads the
 * JPEGs, re-encodes each as a `Slide_*.png` the way extraction saves its own
 * (indexed to 128 colors unless that setting is off) and writes
 * `metadata.json`. Post-processing is the renderer's, through the task queue.
 *
 * It declines rather than guesses: no Yanhekt sign-in, no matching course or
 * session, or a folder that already holds slides all save nothing.
 *
 * `timeline.json` is written too, one capture per slide at the time the
 * server gave it. Those times are on the Yanhe 2.0 screen recording's clock,
 * which is taken to be the Yanhekt video's (owner ruling 2026-10-13: the two
 * are in sync), so no offset is applied.
 */
import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { CourseData, SessionData } from '@common/apiTypes';
import { buildSlideFolderName } from '@common/lectureNaming';
import type { SlideMetadataSource } from '@common/sidecars/metadata';
import { createEmptyTimeline, recordCaptureConfirmed, type SlideTimeline } from '@common/sidecars/timeline';
import type {
  Yanhe2SlideSavePrepared,
  Yanhe2SlideSaveRefusal,
  Yanhe2SlideSaveResult,
  Yanhe2SlideSaveTarget,
} from '@common/yanhe2SlideSave';
import { createIntranetAxios } from '@main/infra/intranetTransport';
import { createLogger } from '@main/infra/logger';
import { expandTilde } from '@main/infra/pathUtils';
import { sharpService } from '@main/infra/sharpService';
import type { ApiClient } from '@main/platform/apiClient';
import type { ConfigService } from '@main/platform/configService';
import type { IntranetMappingService } from '@main/platform/intranetMappingService';
import type { Yanhe2Service } from '@main/platform/yanhe2/yanhe2Service';
import { isYanhe2SlideImageUrl } from '@main/platform/yanhe2/yanhe2Slides';
import { pickTwinCourse, pickTwinSession } from '@main/platform/yanhe2/yanhe2Twin';
import type { SlideExtractionService } from './slideExtractionService';
import type { SlideMetadataService } from './slideMetadataService';
import type { SlideTimelineService } from './slideTimelineService';

const log = createLogger('Yanhe2SlideImport');

/**
 * A recorded timeline for slides that each have one known time: every slide
 * is a capture that changed and was confirmed at that second, in slide order.
 */
export function buildYanhe2SlideTimeline(slides: { file: string; seconds: number }[]): SlideTimeline {
  let timeline = createEmptyTimeline(undefined, 'yanhe2');
  for (const slide of slides) {
    timeline = recordCaptureConfirmed(timeline, { changeAt: slide.seconds, confirmedAt: slide.seconds, file: slide.file });
  }
  return timeline;
}

/** Images in flight at once. */
const CONCURRENCY = 4;
const IMAGE_TIMEOUT_MS = 30_000;
const IMAGE_ATTEMPTS = 3;

interface Twin {
  course: CourseData;
  session: SessionData;
}

type Found<T> = { kind: 'ok'; data: T } | { kind: Yanhe2SlideSaveRefusal };

export interface Yanhe2SlideImportDeps {
  yanhe2Service: Yanhe2Service;
  apiClient: ApiClient;
  configService: ConfigService;
  intranetMapping: IntranetMappingService;
  slideExtractionService: SlideExtractionService;
  slideMetadataService: SlideMetadataService;
  slideTimelineService: SlideTimelineService;
}

export class Yanhe2SlideImportService {
  /** Folders being written right now. */
  private readonly saving = new Set<string>();

  constructor(private readonly deps: Yanhe2SlideImportDeps) {}

  /**
   * Check the session has slides, find the Yanhekt lecture and its folder, and
   * check the folder is free. Writes nothing.
   */
  async prepare(account: string, query: unknown): Promise<Yanhe2SlideSavePrepared> {
    // First, and cheapest: most refusals on a session list are a lecture with no slides.
    const listed = await this.deps.yanhe2Service.getSlides(account, query);
    if (listed.kind !== 'ok') return { kind: listed.kind };
    if (!listed.data.some((slide) => isYanhe2SlideImageUrl(slide.url))) return { kind: 'no_slides' };

    const twin = await this.findTwin(account, query);
    if (twin.kind !== 'ok') return twin;
    const target = this.targetOf(twin.data);
    if (this.saving.has(target.folderPath)) return { kind: 'busy' };
    if ((await this.deps.slideExtractionService.listSlides(target.folderPath)).length > 0) {
      return { kind: 'folder_in_use' };
    }
    return { kind: 'ok', target };
  }

  async save(
    account: string,
    query: unknown,
    onProgress: (done: number, total: number) => void,
  ): Promise<Yanhe2SlideSaveResult> {
    const twin = await this.findTwin(account, query);
    if (twin.kind !== 'ok') return twin;
    const target = this.targetOf(twin.data);
    if (this.saving.has(target.folderPath)) return { kind: 'busy' };

    this.saving.add(target.folderPath);
    try {
      const { slideExtractionService, slideMetadataService, slideTimelineService, yanhe2Service } = this.deps;
      if ((await slideExtractionService.listSlides(target.folderPath)).length > 0) return { kind: 'folder_in_use' };

      const listed = await yanhe2Service.getSlides(account, query);
      if (listed.kind !== 'ok') return { kind: listed.kind };
      // The list is what the server answered, but the URLs are still checked: only aita's own slide tree is fetched.
      const slides = listed.data.filter((slide) => isYanhe2SlideImageUrl(slide.url));
      if (slides.length === 0) return { kind: 'no_slides' };

      await slideExtractionService.ensureDirectory(expandTilde(target.folderPath));
      await slideMetadataService.writeExtraction(target.folderPath, {
        kind: 'recorded',
        source: this.sourceOf(twin.data),
        // The whole lecture, unattended: 'auto', like a task.
        extraction: { extractor: 'yanhe2', extractedAt: new Date().toISOString(), trigger: 'auto' },
      });

      const files = await this.writeSlides(slides.map((slide) => slide.url), target.folderPath, onProgress);
      if (!files) return { kind: 'network' };
      // Before the files are handed on: post-processing relinks and unlinks them in this timeline.
      await slideTimelineService.write(
        target.folderPath,
        buildYanhe2SlideTimeline(files.map((file, index) => ({ file, seconds: slides[index].seconds }))),
      );
      return { kind: 'ok', target, files };
    } catch (error) {
      log.error('Yanhe 2.0 slide save failed:', error);
      return { kind: 'failed' };
    } finally {
      this.saving.delete(target.folderPath);
    }
  }

  /**
   * Download, convert and write every slide. All or nothing: a slide that
   * cannot be had removes the ones already written, so a retry starts clean.
   */
  private async writeSlides(
    urls: string[],
    folderPath: string,
    onProgress: (done: number, total: number) => void,
  ): Promise<string[] | null> {
    const { configService, intranetMapping, slideExtractionService } = this.deps;
    const indexed = configService.getSlideExtractionConfig().enablePngColorReduction ?? true;
    // Extraction names a recorded slide `Slide_<ms>`; these keep that shape and sort in slide order.
    const base = Date.now();
    const files = urls.map((_url, index) => `Slide_${base + index}.png`);
    const written: string[] = [];

    await intranetMapping.ensureFresh();
    const route = intranetMapping.route();
    const bundle = createIntranetAxios({
      intranetMapping,
      isIntranetMode: route.intranet,
      publicFallback: route.publicFallback,
      maxSockets: CONCURRENCY,
      timeout: IMAGE_TIMEOUT_MS,
    });

    const download = async (url: string): Promise<Uint8Array> => {
      let last: unknown;
      for (let attempt = 0; attempt < IMAGE_ATTEMPTS; attempt++) {
        try {
          // Public, like the page's own <img>: no bearer, no signature, no redirect to follow.
          const response = await bundle.instance.get<ArrayBuffer>(url, { responseType: 'arraybuffer', maxRedirects: 0 });
          return new Uint8Array(response.data);
        } catch (error) {
          last = error;
        }
      }
      throw last;
    };

    let failed = false;
    let next = 0;
    let done = 0;
    const worker = async () => {
      while (!failed && next < urls.length) {
        const index = next++;
        try {
          const png = await sharpService.toSlidePng(await download(urls[index]), indexed);
          if (!png) throw new Error('not convertible to PNG');
          if (failed) return;
          await slideExtractionService.saveSlide(folderPath, files[index], png, false);
          written.push(files[index]);
          onProgress(++done, urls.length);
        } catch (error) {
          failed = true;
          const reason = axios.isAxiosError(error) ? (error.code ?? `HTTP ${error.response?.status ?? '?'}`) : String(error);
          log.warn(`Yanhe 2.0 slide ${index + 1} of ${urls.length} was not saved: ${reason}`);
        }
      }
    };

    try {
      onProgress(0, urls.length);
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker));
    } finally {
      bundle.destroy();
    }
    if (!failed) return files;

    const dir = expandTilde(folderPath);
    await Promise.all(written.map((file) => fs.rm(path.join(dir, file), { force: true }).catch(() => { /* best effort */ })));
    return null;
  }

  private async findTwin(account: string, query: unknown): Promise<Found<Twin>> {
    const { apiClient, configService, yanhe2Service } = this.deps;
    const key = await yanhe2Service.getTwinKey(account, query);
    if (key.kind !== 'ok') return { kind: key.kind };
    if (!key.data.courseCode || !key.data.startAt) return { kind: 'no_match' };

    // The session list is empty without a sign-in, which would read as "no match".
    const token = configService.getAuthToken();
    if (!token) return { kind: 'yanhekt_signed_out' };

    try {
      const listed = await apiClient.getCourseList(token, { keyword: key.data.courseCode, page: 1, pageSize: 16 });
      const course = pickTwinCourse(listed.data ?? [], key.data.courseCode);
      if (!course) return { kind: 'no_match' };
      const sessions = await apiClient.getCourseSessions(String(course.id), token);
      const session = pickTwinSession(sessions, key.data.startAt);
      return session ? { kind: 'ok', data: { course, session } } : { kind: 'no_match' };
    } catch (error) {
      if (axios.isAxiosError(error) && !error.response) return { kind: 'network' };
      log.warn('Yanhekt lookup for a Yanhe 2.0 session failed:', error instanceof Error ? error.message : error);
      return { kind: 'failed' };
    }
  }

  private targetOf({ course, session }: Twin): Yanhe2SlideSaveTarget {
    const courseId = String(course.id);
    const sessionId = String(session.session_id);
    const folderName = buildSlideFolderName(
      { courseTitle: course.name_zh, sessionTitle: session.title },
      { courseId, sessionId },
    );
    return {
      courseId,
      courseTitle: course.name_zh,
      sessionId,
      sessionTitle: session.title,
      folderPath: `${this.deps.configService.getConfig().outputDirectory}/${folderName}`,
    };
  }

  /** The same fields, in the same stored types, as a recorded extraction of that lecture. */
  private sourceOf({ course, session }: Twin): SlideMetadataSource {
    const professors = Array.isArray(course.professors) ? course.professors.filter((name) => typeof name === 'string') : [];
    const classrooms = Array.isArray(course.classrooms) ? course.classrooms.map((room) => room.name).filter(Boolean) : [];
    const weekNumber = Number(session.week_number);
    const day = Number(session.day);
    return {
      courseId: String(course.id),
      courseTitle: course.name_zh,
      sessionId: String(session.session_id),
      sessionTitle: session.title,
      instructor: professors.length > 0 ? professors.join(', ') : undefined,
      professors: professors.length > 0 ? professors : undefined,
      semester: course.semester === undefined ? undefined : String(course.semester),
      schoolYear: course.school_year === undefined ? undefined : String(course.school_year),
      college: course.college_name || undefined,
      classrooms: classrooms.length > 0 ? classrooms : undefined,
      weekNumber: Number.isFinite(weekNumber) ? weekNumber : undefined,
      day: Number.isFinite(day) ? day : undefined,
    };
  }
}
