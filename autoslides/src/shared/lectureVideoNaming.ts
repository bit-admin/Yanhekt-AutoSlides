// Local lecture video filename parse/format for the Lectures workspace.
//
// Downloads historically look like:
//   screen_泛函分析_第1周_星期三_第2大节__c62313s751843.mp4
// Rename writes Emby-style provider tags so the human stem can drop the prefix
// without losing identity:
//   泛函分析 - S01E02 - 第1周 星期三 第2大节 [yhid=c62313s751843] [vtype=screen].mp4
//
// S = course semester (1/2 → S01/S02), NOT week.
// E = 1-based index of sessionId in a stably sorted course session list.

import {
  parseLectureIds,
  stripLectureIds,
  type LectureIdentity,
  type ParsedLectureIds,
} from './lectureNaming';

export type LectureVideoType = 'screen' | 'camera';

/** Video preset recorded in `[ascomp=…]` after a successful Lectures compress. */
export type LectureCompressPresetTag = 'tiny' | 'small' | 'readable';

export interface ParsedLectureVideo extends ParsedLectureIds {
  /** Bare filename without directory. */
  fileName: string;
  /** Extension including the leading dot (e.g. `.mp4`), lowercased. */
  ext: string;
  /** Stem without extension. */
  stem: string;
  videoType?: LectureVideoType;
  /** True when ids came from `[yhid=…]` rather than the legacy `__c…` suffix. */
  hasEmbyTags: boolean;
  /** True when type came from `[vtype=…]` rather than a `screen_`/`camera_` prefix. */
  hasVtypeTag: boolean;
  /**
   * Compress preset from `[ascomp=tiny|small|readable]` when present (after a
   * successful Lectures batch compress). Used to skip re-encode + UI badge.
   */
  compressPreset?: LectureCompressPresetTag;
  /**
   * Recognised for Lectures grouping / rename / compress-as-screen:
   * both courseId and sessionId present (and preferably a video type).
   */
  recognised: boolean;
}

const YANHEKT_ID_TAG = /\[yhid=(c(\d+)(?:s(\d+))?(?:l(\d+))?)\]/i;
const VTYPE_TAG = /\[vtype=(screen|camera)\]/i;
/** After `[vtype=…]`: records which Lectures compress preset was applied. */
const ASCOMP_TAG = /\[ascomp=(tiny|small|readable)\]/i;
const LEGACY_TYPE_PREFIX = /^(screen|camera)_/i;

function isCompressPreset(value: string): value is LectureCompressPresetTag {
  return value === 'tiny' || value === 'small' || value === 'readable';
}

/** Strip Emby-style tags (case-insensitive), including compress status. */
export function stripEmbyTags(name: string): string {
  return name
    .replace(YANHEKT_ID_TAG, '')
    .replace(VTYPE_TAG, '')
    .replace(ASCOMP_TAG, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Build the Yanhekt id provider tag. Requires a course id; session/live are
 * optional (same rules as buildLectureIdSuffix).
 */
export function buildYanhektIdTag(identity: LectureIdentity): string {
  const courseId =
    identity.courseId == null ? undefined : String(identity.courseId).trim();
  const sessionId =
    identity.sessionId == null ? undefined : String(identity.sessionId).trim();
  const liveId =
    identity.liveId == null ? undefined : String(identity.liveId).trim();

  const c = courseId && /^\d+$/.test(courseId) ? courseId : undefined;
  const s = c && sessionId && /^\d+$/.test(sessionId) ? sessionId : undefined;
  const l = liveId && /^\d+$/.test(liveId) ? liveId : undefined;

  if (!c && !l) return '';
  const body = [
    c ? `c${c}` : '',
    s ? `s${s}` : '',
    l ? `l${l}` : '',
  ].join('');
  return body ? `[yhid=${body}]` : '';
}

export function buildVtypeTag(videoType: LectureVideoType): string {
  return `[vtype=${videoType}]`;
}

export function buildAscompTag(preset: LectureCompressPresetTag): string {
  return `[ascomp=${preset}]`;
}

/**
 * Parse a video file name (with or without extension). Accepts legacy
 * `screen_…__c…s…` names and Emby-tagged renames.
 */
export function parseLectureVideoName(fileName: string): ParsedLectureVideo {
  const base = fileName.split(/[/\\]/).pop() || fileName;
  const extMatch = base.match(/(\.[^.]+)$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : '';
  const stem = ext ? base.slice(0, -ext.length) : base;

  const yanhekt = stem.match(YANHEKT_ID_TAG);
  const vtypeTag = stem.match(VTYPE_TAG);
  const ascompTag = stem.match(ASCOMP_TAG);

  let courseId: string | undefined;
  let sessionId: string | undefined;
  let liveId: string | undefined;
  let hasEmbyTags = false;

  if (yanhekt) {
    hasEmbyTags = true;
    courseId = yanhekt[2];
    sessionId = yanhekt[3];
    liveId = yanhekt[4];
  } else {
    // Legacy `__c…s…` is $‑anchored. Tags appended after compress
    // (` [ascomp=tiny]`) would make parseLectureIds miss the id block — strip
    // known bracket tags first so identity still resolves.
    const stemForLegacyIds = stem
      .replace(ASCOMP_TAG, '')
      .replace(VTYPE_TAG, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    const legacy = parseLectureIds(stemForLegacyIds);
    courseId = legacy.courseId;
    sessionId = legacy.sessionId;
    liveId = legacy.liveId;
  }

  let videoType: LectureVideoType | undefined;
  let hasVtypeTag = false;
  if (vtypeTag) {
    hasVtypeTag = true;
    videoType = vtypeTag[1].toLowerCase() as LectureVideoType;
  } else {
    const prefix = stem.match(LEGACY_TYPE_PREFIX);
    if (prefix) {
      videoType = prefix[1].toLowerCase() as LectureVideoType;
    }
  }

  const compressRaw = ascompTag?.[1]?.toLowerCase() ?? '';
  const compressPreset = isCompressPreset(compressRaw) ? compressRaw : undefined;

  const recognised = Boolean(courseId && sessionId);

  return {
    fileName: base,
    ext,
    stem,
    courseId,
    sessionId,
    liveId,
    videoType,
    hasEmbyTags,
    hasVtypeTag,
    compressPreset,
    recognised,
  };
}

/**
 * User-facing label: drop type prefix, legacy id block, and Emby tags.
 */
export function formatLectureVideoDisplayName(fileName: string): string {
  const { stem, ext } = parseLectureVideoName(fileName);
  let name = stripEmbyTags(stem);
  name = stripLectureIds(name);
  name = name.replace(LEGACY_TYPE_PREFIX, '');
  // Collapse leftover separators introduced by tag removal.
  name = name
    .replace(/[_\s]+$/g, '')
    .replace(/^[_\s]+/g, '')
    .replace(/\s+-\s+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return name || stem || fileName.replace(ext, '');
}

/** Illegal path characters for Emby-ish stems (spaces allowed). */
export function sanitizeLectureVideoStem(stem: string): string {
  // Strip illegal path chars + ASCII controls without a control-char regex class
  // (eslint no-control-regex).
  let out = ''
  for (const ch of stem) {
    const code = ch.charCodeAt(0)
    if (code < 32) continue
    if ('<>:"/\\|?*'.includes(ch)) continue
    out += ch
  }
  return out.replace(/\s+/g, ' ').replace(/[. ]+$/g, '').trim()
}

export interface BuildLectureVideoFileNameInput {
  /** Human-readable stem without tags/extension. */
  stem: string;
  courseId: string | number;
  sessionId: string | number;
  videoType: LectureVideoType;
  /** When set, append `[ascomp=…]` after `[vtype=…]` (preserve on rename). */
  compressPreset?: LectureCompressPresetTag;
  ext?: string; // default .mp4
}

/**
 * Final on-disk name after rename. Tags are appended AFTER sanitising the stem.
 * Order: stem [yhid=…] [vtype=…] [ascomp=…].ext
 */
export function buildLectureVideoFileName(input: BuildLectureVideoFileNameInput): string {
  const stem = sanitizeLectureVideoStem(input.stem);
  const idTag = buildYanhektIdTag({
    courseId: input.courseId,
    sessionId: input.sessionId,
  });
  const typeTag = buildVtypeTag(input.videoType);
  const ascompTag = input.compressPreset ? buildAscompTag(input.compressPreset) : '';
  const ext = input.ext
    ? input.ext.startsWith('.')
      ? input.ext.toLowerCase()
      : `.${input.ext.toLowerCase()}`
    : '.mp4';
  const parts = [stem, idTag, typeTag, ascompTag].filter(Boolean);
  return `${parts.join(' ')}${ext}`;
}

/**
 * Set or replace `[ascomp={preset}]` on an existing basename (legacy or Emby).
 * Identity / vtype tags are left alone. Used after a successful compress replace.
 */
export function withAscompTag(
  fileName: string,
  preset: LectureCompressPresetTag,
): string {
  const base = fileName.split(/[/\\]/).pop() || fileName;
  const extMatch = base.match(/(\.[^.]+)$/);
  const ext = extMatch ? extMatch[1] : '';
  let stem = ext ? base.slice(0, -ext.length) : base;
  stem = stem.replace(ASCOMP_TAG, '').replace(/\s{2,}/g, ' ').trim();
  return `${stem} ${buildAscompTag(preset)}${ext}`;
}

export interface SessionOrderProps {
  session_id: string | number;
  week_number?: number | null;
  day?: number | null;
  started_at?: string | null;
}

/**
 * Stable 1-based episode index for Emby E-numbering.
 * Sorts a copy by (week_number, day, started_at, session_id) so Monday §5 and
 * Wednesday §2 get distinct E values independent of raw API order.
 * Returns null when the session is not in the list.
 */
export function episodeIndexForSession(
  sessions: SessionOrderProps[],
  sessionId: string | number,
): number | null {
  const want = String(sessionId);
  const sorted = [...sessions].sort((a, b) => {
    const w = (a.week_number ?? 0) - (b.week_number ?? 0);
    if (w !== 0) return w;
    const d = (a.day ?? 0) - (b.day ?? 0);
    if (d !== 0) return d;
    const sa = a.started_at || '';
    const sb = b.started_at || '';
    if (sa !== sb) return sa < sb ? -1 : 1;
    return String(a.session_id).localeCompare(String(b.session_id));
  });
  const idx = sorted.findIndex((s) => String(s.session_id) === want);
  return idx >= 0 ? idx + 1 : null;
}

/** Format semester number as S01 / S02. Returns '' when unknown. */
export function formatSemesterToken(semester: string | number | null | undefined): string {
  if (semester == null || semester === '') return '';
  const n = Number(semester);
  if (!Number.isFinite(n) || n <= 0) return '';
  return `S${String(Math.trunc(n)).padStart(2, '0')}`;
}

/** Format 1-based episode as E01, E02, … Returns '' when null. */
export function formatEpisodeToken(episode: number | null | undefined): string {
  if (episode == null || episode <= 0) return '';
  return `E${String(Math.trunc(episode)).padStart(2, '0')}`;
}

export interface RenameStemOptions {
  courseTitle: string;
  sessionTitle?: string;
  semester?: string | number | null;
  episode?: number | null;
  instructor?: string;
  schoolYear?: string;
  college?: string;
  classrooms?: string[];
  includeInstructor?: boolean;
  includeSchoolYear?: boolean;
  includeCollege?: boolean;
  includeClassrooms?: boolean;
}

/**
 * Human stem for the default flat Emby-ish template:
 *   {CourseTitle}[ ({schoolYear})] - S{sem}E{ep} - {SessionTitle}[ - instructor]…
 * Missing S/E tokens are omitted rather than fabricated from week numbers.
 */
export function buildDefaultRenameStem(options: RenameStemOptions): string {
  const titleParts: string[] = [options.courseTitle.trim()].filter(Boolean);
  if (options.includeSchoolYear && options.schoolYear) {
    titleParts[0] = `${titleParts[0]} (${options.schoolYear})`.trim();
  }

  const se = [formatSemesterToken(options.semester), formatEpisodeToken(options.episode)]
    .filter(Boolean)
    .join('');

  const chunks: string[] = [];
  if (titleParts[0]) chunks.push(titleParts[0]);
  if (se) chunks.push(se);
  if (options.sessionTitle?.trim()) chunks.push(options.sessionTitle.trim());

  let stem = chunks.join(' - ');

  const extras: string[] = [];
  if (options.includeInstructor && options.instructor?.trim()) {
    extras.push(options.instructor.trim());
  }
  if (options.includeCollege && options.college?.trim()) {
    extras.push(options.college.trim());
  }
  if (options.includeClassrooms && options.classrooms?.length) {
    extras.push(options.classrooms.filter(Boolean).join(', '));
  }
  if (extras.length) {
    stem = `${stem} - ${extras.join(' - ')}`;
  }

  return sanitizeLectureVideoStem(stem);
}

/**
 * Pick a non-colliding target name in `existingNames` (basename set, lowercased
 * comparison). Appends ` (2)`, ` (3)`, … before tags would be awkward; we append
 * before the extension but keep tags on the stem by re-building when needed.
 * For simplicity the collision marker goes immediately before the extension
 * only when tags are already on `desiredName`.
 */
export function allocateUniqueFileName(
  desiredName: string,
  existingNames: Set<string>,
  sourceName?: string,
): string {
  const lowerExisting = new Set([...existingNames].map((n) => n.toLowerCase()));
  const sourceLower = sourceName?.toLowerCase();

  const isFree = (name: string) => {
    const low = name.toLowerCase();
    if (sourceLower && low === sourceLower) return true;
    return !lowerExisting.has(low);
  };

  if (isFree(desiredName)) return desiredName;

  const extMatch = desiredName.match(/(\.[^.]+)$/);
  const ext = extMatch ? extMatch[1] : '';
  const stem = ext ? desiredName.slice(0, -ext.length) : desiredName;

  for (let n = 2; n < 1000; n++) {
    const candidate = `${stem} (${n})${ext}`;
    if (isFree(candidate)) return candidate;
  }
  return `${stem} (${Date.now()})${ext}`;
}
