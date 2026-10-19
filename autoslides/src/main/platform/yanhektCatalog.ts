/**
 * Developer-mode catalog of Yanhekt (cbiz) course, session, and live fields.
 *
 * One JSON file in the log folder, rewritten in place. A later response
 * replaces a field it actually carries; a missing, null, or empty value leaves
 * the logged one alone. The raw response is read here — mapped `SessionData.id`
 * is the video id, not the session id.
 *
 * Stream URLs are the unsigned ones from the API (`videos[].main` / `vga`,
 * live `target` / `target_vga` / `target_room`, and `/v1/video` `audio`).
 * The app's signed playback URLs are not recorded.
 */

import fs from 'node:fs';
import path from 'node:path';

export const YANHEKT_CATALOG_FILE_NAME = 'yanhekt-catalog.json';
const CATALOG_TMP_NAME = 'yanhekt-catalog.json.tmp';
const CATALOG_BAK_NAME = 'yanhekt-catalog.json.bak';
const CATALOG_HOST = 'cbiz.yanhekt.cn';
const DEFAULT_FLUSH_MS = 1000;

export interface CatalogClassroom {
  id?: string;
  name?: string;
  number?: string;
}

export interface CatalogVideo {
  videoId: string;
  /** Camera stream (Video1). */
  main?: string;
  /** Screen stream (VGA). */
  vga?: string;
  /** Classroom mic `.aac`, from `GET /v1/video` only. */
  audio?: string;
}

export interface CatalogSession {
  sessionId: string;
  liveId?: string;
  title?: string;
  weekNumber?: number;
  day?: string;
  startedAt?: string;
  endedAt?: string;
  location?: string;
  videos?: Record<string, CatalogVideo>;
}

export interface CatalogLive {
  liveId: string;
  sessionId?: string;
  title?: string;
  subtitle?: string;
  status?: number;
  scheduleStartedAt?: string;
  scheduleEndedAt?: string;
  /** Camera stream (Video1). */
  target?: string;
  /** Screen stream (VGA). */
  targetVga?: string;
  /** Room camera (Video2). */
  targetRoom?: string;
}

export interface CatalogCourse {
  courseId: string;
  nameZh?: string;
  nameEn?: string;
  code?: string;
  number?: string;
  schoolYear?: string;
  semester?: string;
  collegeName?: string;
  collegeCode?: string;
  participantCount?: number;
  professors?: string[];
  classrooms?: CatalogClassroom[];
  imageUrl?: string;
  sessions?: Record<string, CatalogSession>;
  lives?: Record<string, CatalogLive>;
}

export interface CatalogDocument {
  courses: Record<string, CatalogCourse>;
  unlinked?: {
    sessions?: Record<string, CatalogSession>;
    lives?: Record<string, CatalogLive>;
    videos?: Record<string, CatalogVideo>;
  };
}

/** `courseId` null means the session is under `unlinked.sessions`. */
type VideoLoc = { courseId: string | null; sessionId: string };

export interface CatalogState {
  doc: CatalogDocument;
  videos: Map<string, VideoLoc>;
}

export function createCatalogState(): CatalogState {
  return { doc: { courses: {} }, videos: new Map() };
}

export interface YanhektCatalogSink {
  observe(url: string, body: unknown): void;
}

type Row = Record<string, unknown>;

function isRow(value: unknown): value is Row {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asId(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value !== 0) return String(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed && trimmed !== '0') return trimmed;
  }
  return undefined;
}

/** A present value. Empty string and null do not count, so they cannot clear a logged field. */
function asText(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function isOk(body: unknown): body is { data?: unknown } {
  if (!isRow(body)) return false;
  const code = body.code;
  return code === 0 || code === '0';
}

function rowsOf(data: unknown): Row[] {
  const list = Array.isArray(data) ? data : (isRow(data) ? data.data : undefined);
  if (!Array.isArray(list)) return [];
  return list.filter(isRow);
}

function assign(target: object, key: string, value: unknown): boolean {
  if (value === undefined) return false;
  const record = target as Row;
  if (Array.isArray(value)) {
    if (value.length === 0) return false;
    if (JSON.stringify(record[key]) === JSON.stringify(value)) return false;
  } else if (record[key] === value) {
    return false;
  }
  record[key] = value;
  return true;
}

function namesOf(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const names: string[] = [];
  for (const item of value) {
    if (typeof item === 'string') {
      const name = item.trim();
      if (name) names.push(name);
    } else if (isRow(item)) {
      const name = asText(item.name);
      if (name) names.push(name);
    }
  }
  return names.length > 0 ? names : undefined;
}

function professorNames(row: Row): string[] | undefined {
  const preferred = namesOf(row.professor_names);
  if (preferred) return preferred;
  return namesOf(row.professors);
}

function classroomsOf(value: unknown): CatalogClassroom[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const rooms: CatalogClassroom[] = [];
  for (const item of value) {
    if (!isRow(item)) continue;
    const room: CatalogClassroom = {};
    const id = asId(item.id);
    const name = asText(item.name);
    const number = asText(item.number);
    if (id) room.id = id;
    if (name) room.name = name;
    if (number) room.number = number;
    if (id || name || number) rooms.push(room);
  }
  return rooms.length > 0 ? rooms : undefined;
}

function imageUrlOf(row: Row): string | undefined {
  const direct = asText(row.image_url);
  if (direct) return direct;
  return isRow(row.college) ? asText(row.college.image_url) : undefined;
}

function collegeNameOf(row: Row): string | undefined {
  return asText(row.college_name) ?? (isRow(row.college) ? asText(row.college.name) : undefined);
}

function ensureCourse(doc: CatalogDocument, courseId: string): { course: CatalogCourse; created: boolean } {
  const existing = doc.courses[courseId];
  if (existing) return { course: existing, created: false };
  const course: CatalogCourse = { courseId };
  doc.courses[courseId] = course;
  return { course, created: true };
}

function applyCourse(state: CatalogState, courseId: string, row: Row): boolean {
  const { course, created } = ensureCourse(state.doc, courseId);
  let changed = created;
  changed = assign(course, 'nameZh', asText(row.name_zh)) || changed;
  changed = assign(course, 'nameEn', asText(row.name_en)) || changed;
  changed = assign(course, 'code', asText(row.code)) || changed;
  changed = assign(course, 'number', asText(row.number)) || changed;
  changed = assign(course, 'schoolYear', asText(row.school_year)) || changed;
  changed = assign(course, 'semester', asText(row.semester)) || changed;
  changed = assign(course, 'collegeName', collegeNameOf(row)) || changed;
  changed = assign(course, 'collegeCode', asText(row.college_code)) || changed;
  changed = assign(course, 'participantCount', asNumber(row.participant_count)) || changed;
  changed = assign(course, 'professors', professorNames(row)) || changed;
  changed = assign(course, 'classrooms', classroomsOf(row.classrooms)) || changed;
  changed = assign(course, 'imageUrl', imageUrlOf(row)) || changed;
  return changed;
}

function reindexSession(state: CatalogState, courseId: string | null, session: CatalogSession): void {
  for (const videoId of Object.keys(session.videos ?? {})) {
    state.videos.set(videoId, { courseId, sessionId: session.sessionId });
  }
}

function fillVideo(dest: CatalogVideo, src: CatalogVideo): void {
  if (dest.main === undefined && src.main) dest.main = src.main;
  if (dest.vga === undefined && src.vga) dest.vga = src.vga;
  if (dest.audio === undefined && src.audio) dest.audio = src.audio;
}

function fillSession(dest: CatalogSession, src: CatalogSession): void {
  if (dest.liveId === undefined && src.liveId) dest.liveId = src.liveId;
  if (dest.title === undefined && src.title) dest.title = src.title;
  if (dest.weekNumber === undefined && src.weekNumber !== undefined) dest.weekNumber = src.weekNumber;
  if (dest.day === undefined && src.day) dest.day = src.day;
  if (dest.startedAt === undefined && src.startedAt) dest.startedAt = src.startedAt;
  if (dest.endedAt === undefined && src.endedAt) dest.endedAt = src.endedAt;
  if (dest.location === undefined && src.location) dest.location = src.location;
  for (const [videoId, video] of Object.entries(src.videos ?? {})) {
    dest.videos = dest.videos ?? {};
    const existing = dest.videos[videoId];
    if (!existing) dest.videos[videoId] = video;
    else fillVideo(existing, video);
  }
}

function locateSession(doc: CatalogDocument, sessionId: string): { courseId: string | null; session: CatalogSession } | null {
  for (const [courseId, course] of Object.entries(doc.courses)) {
    const session = course.sessions?.[sessionId];
    if (session) return { courseId, session };
  }
  const unlinked = doc.unlinked?.sessions?.[sessionId];
  return unlinked ? { courseId: null, session: unlinked } : null;
}

function detachSession(doc: CatalogDocument, courseId: string | null, sessionId: string): void {
  if (courseId) delete doc.courses[courseId]?.sessions?.[sessionId];
  else delete doc.unlinked?.sessions?.[sessionId];
}

/** The session record for this id, moved under `courseId` when a response has just supplied one. */
function placeSession(state: CatalogState, courseId: string | undefined, sessionId: string): { session: CatalogSession; moved: boolean } {
  const found = locateSession(state.doc, sessionId);
  if (courseId) {
    const { course } = ensureCourse(state.doc, courseId);
    if (found && found.courseId === courseId) return { session: found.session, moved: false };
    course.sessions = course.sessions ?? {};
    if (found) {
      detachSession(state.doc, found.courseId, sessionId);
      const parked = course.sessions[sessionId];
      if (parked && parked !== found.session) fillSession(parked, found.session);
      else course.sessions[sessionId] = found.session;
      const session = course.sessions[sessionId];
      reindexSession(state, courseId, session);
      return { session, moved: true };
    }
    const session: CatalogSession = { sessionId };
    course.sessions[sessionId] = session;
    return { session, moved: true };
  }
  if (found) return { session: found.session, moved: false };
  state.doc.unlinked = state.doc.unlinked ?? {};
  state.doc.unlinked.sessions = state.doc.unlinked.sessions ?? {};
  const session: CatalogSession = { sessionId };
  state.doc.unlinked.sessions[sessionId] = session;
  return { session, moved: true };
}

function locateLive(doc: CatalogDocument, liveId: string): { courseId: string | null; live: CatalogLive } | null {
  for (const [courseId, course] of Object.entries(doc.courses)) {
    const live = course.lives?.[liveId];
    if (live) return { courseId, live };
  }
  const unlinked = doc.unlinked?.lives?.[liveId];
  return unlinked ? { courseId: null, live: unlinked } : null;
}

function detachLive(doc: CatalogDocument, courseId: string | null, liveId: string): void {
  if (courseId) delete doc.courses[courseId]?.lives?.[liveId];
  else delete doc.unlinked?.lives?.[liveId];
}

function fillLive(dest: CatalogLive, src: CatalogLive): void {
  if (dest.sessionId === undefined && src.sessionId) dest.sessionId = src.sessionId;
  if (dest.title === undefined && src.title) dest.title = src.title;
  if (dest.subtitle === undefined && src.subtitle) dest.subtitle = src.subtitle;
  if (dest.status === undefined && src.status !== undefined) dest.status = src.status;
  if (dest.scheduleStartedAt === undefined && src.scheduleStartedAt) dest.scheduleStartedAt = src.scheduleStartedAt;
  if (dest.scheduleEndedAt === undefined && src.scheduleEndedAt) dest.scheduleEndedAt = src.scheduleEndedAt;
  if (dest.target === undefined && src.target) dest.target = src.target;
  if (dest.targetVga === undefined && src.targetVga) dest.targetVga = src.targetVga;
  if (dest.targetRoom === undefined && src.targetRoom) dest.targetRoom = src.targetRoom;
}

function placeLive(state: CatalogState, courseId: string | undefined, liveId: string): { live: CatalogLive; moved: boolean } {
  const found = locateLive(state.doc, liveId);
  if (courseId) {
    const { course } = ensureCourse(state.doc, courseId);
    if (found && found.courseId === courseId) return { live: found.live, moved: false };
    course.lives = course.lives ?? {};
    if (found) {
      detachLive(state.doc, found.courseId, liveId);
      const parked = course.lives[liveId];
      if (parked && parked !== found.live) fillLive(parked, found.live);
      else course.lives[liveId] = found.live;
      return { live: course.lives[liveId], moved: true };
    }
    const live: CatalogLive = { liveId };
    course.lives[liveId] = live;
    return { live, moved: true };
  }
  if (found) return { live: found.live, moved: false };
  state.doc.unlinked = state.doc.unlinked ?? {};
  state.doc.unlinked.lives = state.doc.unlinked.lives ?? {};
  const live: CatalogLive = { liveId };
  state.doc.unlinked.lives[liveId] = live;
  return { live, moved: true };
}

function upsertVideo(state: CatalogState, courseId: string | null, session: CatalogSession, raw: Row): boolean {
  const videoId = asId(raw.id);
  if (!videoId) return false;
  session.videos = session.videos ?? {};
  let changed = false;
  let video = session.videos[videoId];
  const pending = state.doc.unlinked?.videos?.[videoId];
  if (!video) {
    video = { videoId };
    if (pending) fillVideo(video, pending);
    session.videos[videoId] = video;
    changed = true;
  }
  if (pending) {
    fillVideo(video, pending);
    delete state.doc.unlinked?.videos?.[videoId];
    changed = true;
  }
  changed = assign(video, 'main', asText(raw.main)) || changed;
  changed = assign(video, 'vga', asText(raw.vga)) || changed;
  changed = assign(video, 'audio', asText(raw.audio)) || changed;
  state.videos.set(videoId, { courseId, sessionId: session.sessionId });
  return changed;
}

function applySession(state: CatalogState, courseId: string | undefined, row: Row): boolean {
  const sessionId = asId(row.id);
  if (!sessionId) return false;
  const nested = isRow(row.course) ? row.course : undefined;
  const resolvedCourseId = asId(row.course_id) ?? asId(nested?.id) ?? courseId;
  let changed = false;
  if (nested && resolvedCourseId) changed = applyCourse(state, resolvedCourseId, nested) || changed;
  const { session, moved } = placeSession(state, resolvedCourseId, sessionId);
  changed = moved || changed;
  changed = assign(session, 'title', asText(row.title)) || changed;
  changed = assign(session, 'weekNumber', asNumber(row.week_number)) || changed;
  changed = assign(session, 'day', asText(row.day)) || changed;
  changed = assign(session, 'startedAt', asText(row.started_at)) || changed;
  changed = assign(session, 'endedAt', asText(row.ended_at)) || changed;
  changed = assign(session, 'location', asText(row.location)) || changed;
  if (Array.isArray(row.video_ids)) {
    for (const id of row.video_ids) changed = upsertVideo(state, resolvedCourseId ?? null, session, { id }) || changed;
  }
  if (Array.isArray(row.videos)) {
    for (const video of row.videos) {
      if (isRow(video)) changed = upsertVideo(state, resolvedCourseId ?? null, session, video) || changed;
    }
  }
  if (isRow(row.live)) {
    const liveId = asId(row.live.id) ?? asId(row.live.live_id);
    changed = applyLive(state, row.live, { courseId: resolvedCourseId, sessionId }) || changed;
    if (liveId) changed = assign(session, 'liveId', liveId) || changed;
  }
  return changed;
}

/**
 * A live row's `title` is the broadcast title, and its single professor is not
 * the course's professor list. Neither is written onto the course.
 */
function applyLive(state: CatalogState, row: Row, link?: { courseId?: string; sessionId?: string }): boolean {
  const liveId = asId(row.id) ?? asId(row.live_id);
  if (!liveId) return false;
  const session = isRow(row.session) ? row.session : undefined;
  // `course.id` on a list row is often null. Never let that clear a known course.
  const courseId = link?.courseId
    ?? asId(session?.course_id)
    ?? asId(row.source_id)
    ?? (isRow(row.course) ? asId(row.course.id) : undefined);
  const sessionId = link?.sessionId ?? asId(session?.id);
  const { live, moved } = placeLive(state, courseId, liveId);
  let changed = moved;
  if (sessionId) changed = assign(live, 'sessionId', sessionId) || changed;
  changed = assign(live, 'title', asText(row.title)) || changed;
  changed = assign(live, 'subtitle', asText(row.subtitle)) || changed;
  changed = assign(live, 'status', asNumber(row.status)) || changed;
  changed = assign(live, 'scheduleStartedAt', asText(row.schedule_started_at)) || changed;
  changed = assign(live, 'scheduleEndedAt', asText(row.schedule_ended_at)) || changed;
  changed = assign(live, 'target', asText(row.target)) || changed;
  changed = assign(live, 'targetVga', asText(row.target_vga)) || changed;
  changed = assign(live, 'targetRoom', asText(row.target_room)) || changed;
  if (sessionId) {
    const located = locateSession(state.doc, sessionId);
    if (located) changed = assign(located.session, 'liveId', liveId) || changed;
  }
  return changed;
}

function noteVideo(state: CatalogState, videoId: string | undefined, row: Row | undefined): boolean {
  const id = videoId ?? (row ? asId(row.id) : undefined);
  if (!id || !row) return false;
  const loc = state.videos.get(id);
  if (loc) {
    const session = loc.courseId
      ? state.doc.courses[loc.courseId]?.sessions?.[loc.sessionId]
      : state.doc.unlinked?.sessions?.[loc.sessionId];
    if (session) return upsertVideo(state, loc.courseId, session, { ...row, id });
  }
  state.doc.unlinked = state.doc.unlinked ?? {};
  state.doc.unlinked.videos = state.doc.unlinked.videos ?? {};
  let video = state.doc.unlinked.videos[id];
  let changed = false;
  if (!video) {
    video = { videoId: id };
    state.doc.unlinked.videos[id] = video;
    changed = true;
  }
  changed = assign(video, 'main', asText(row.main)) || changed;
  changed = assign(video, 'vga', asText(row.vga)) || changed;
  changed = assign(video, 'audio', asText(row.audio)) || changed;
  return changed;
}

/**
 * Merge one successful cbiz response into the catalog. Returns whether
 * anything changed. Non-success envelopes and every other path are ignored.
 */
export function observeYanhektResponse(state: CatalogState, url: string, body: unknown): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.hostname !== CATALOG_HOST || !isOk(body)) return false;
  const data = body.data;
  switch (parsed.pathname) {
    case '/v2/course/list':
    case '/v2/course/private/list':
    case '/v1/course/subscription/list': {
      let changed = false;
      for (const row of rowsOf(data)) {
        const courseId = asId(row.id);
        if (courseId) changed = applyCourse(state, courseId, row) || changed;
      }
      return changed;
    }
    case '/v1/course': {
      const courseId = asId(parsed.searchParams.get('id'));
      return courseId && isRow(data) ? applyCourse(state, courseId, data) : false;
    }
    case '/v2/course/session/list': {
      let changed = false;
      const courseId = asId(parsed.searchParams.get('course_id'));
      for (const row of rowsOf(data)) changed = applySession(state, courseId, row) || changed;
      return changed;
    }
    case '/v1/course/session':
      return isRow(data) ? applySession(state, undefined, data) : false;
    case '/v2/live/list': {
      let changed = false;
      for (const row of rowsOf(data)) changed = applyLive(state, row) || changed;
      return changed;
    }
    case '/v1/video':
      return noteVideo(state, asId(parsed.searchParams.get('id')), isRow(data) ? data : undefined);
    default:
      return false;
  }
}

function sorted<T>(record: Record<string, T> | undefined): [string, T][] {
  if (!record) return [];
  return Object.entries(record).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
}

function defined(entries: [string, unknown][]): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    if (value === undefined) continue;
    if (isRow(value) && Object.keys(value).length === 0) continue;
    out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function emitVideo(video: CatalogVideo): Record<string, unknown> {
  return defined([
    ['videoId', video.videoId],
    ['main', video.main],
    ['vga', video.vga],
    ['audio', video.audio],
  ]) ?? { videoId: video.videoId };
}

function emitSession(session: CatalogSession): Record<string, unknown> {
  const videos = defined(sorted(session.videos).map(([id, video]) => [id, emitVideo(video)]));
  return defined([
    ['sessionId', session.sessionId],
    ['liveId', session.liveId],
    ['title', session.title],
    ['weekNumber', session.weekNumber],
    ['day', session.day],
    ['startedAt', session.startedAt],
    ['endedAt', session.endedAt],
    ['location', session.location],
    ['videos', videos],
  ]) ?? { sessionId: session.sessionId };
}

function emitLive(live: CatalogLive): Record<string, unknown> {
  return defined([
    ['liveId', live.liveId],
    ['sessionId', live.sessionId],
    ['title', live.title],
    ['subtitle', live.subtitle],
    ['status', live.status],
    ['scheduleStartedAt', live.scheduleStartedAt],
    ['scheduleEndedAt', live.scheduleEndedAt],
    ['target', live.target],
    ['targetVga', live.targetVga],
    ['targetRoom', live.targetRoom],
  ]) ?? { liveId: live.liveId };
}

function emitClassroom(room: CatalogClassroom): Record<string, unknown> {
  return defined([
    ['id', room.id],
    ['name', room.name],
    ['number', room.number],
  ]) ?? {};
}

function emitCourse(course: CatalogCourse): Record<string, unknown> {
  const sessions = defined(sorted(course.sessions).map(([id, session]) => [id, emitSession(session)]));
  const lives = defined(sorted(course.lives).map(([id, live]) => [id, emitLive(live)]));
  return defined([
    ['courseId', course.courseId],
    ['nameZh', course.nameZh],
    ['nameEn', course.nameEn],
    ['code', course.code],
    ['number', course.number],
    ['schoolYear', course.schoolYear],
    ['semester', course.semester],
    ['collegeName', course.collegeName],
    ['collegeCode', course.collegeCode],
    ['participantCount', course.participantCount],
    ['professors', course.professors],
    ['classrooms', course.classrooms?.map(emitClassroom).filter((room) => Object.keys(room).length > 0)],
    ['imageUrl', course.imageUrl],
    ['sessions', sessions],
    ['lives', lives],
  ]) ?? { courseId: course.courseId };
}

/** Pretty JSON, keys in a fixed order, empty buckets omitted. */
export function serializeCatalog(doc: CatalogDocument): string {
  const courses = defined(sorted(doc.courses).map(([id, course]) => [id, emitCourse(course)])) ?? {};
  const unlinked = defined([
    ['sessions', defined(sorted(doc.unlinked?.sessions).map(([id, session]) => [id, emitSession(session)]))],
    ['lives', defined(sorted(doc.unlinked?.lives).map(([id, live]) => [id, emitLive(live)]))],
    ['videos', defined(sorted(doc.unlinked?.videos).map(([id, video]) => [id, emitVideo(video)]))],
  ]);
  const root: Record<string, unknown> = { courses };
  if (unlinked) root.unlinked = unlinked;
  return `${JSON.stringify(root, null, 2)}\n`;
}

function rebuildVideoIndex(doc: CatalogDocument): Map<string, VideoLoc> {
  const videos = new Map<string, VideoLoc>();
  for (const [courseId, course] of Object.entries(doc.courses)) {
    for (const session of Object.values(course.sessions ?? {})) reindex(videos, courseId, session);
  }
  for (const session of Object.values(doc.unlinked?.sessions ?? {})) reindex(videos, null, session);
  return videos;
}

function reindex(videos: Map<string, VideoLoc>, courseId: string | null, session: CatalogSession): void {
  for (const videoId of Object.keys(session.videos ?? {})) {
    videos.set(videoId, { courseId, sessionId: session.sessionId });
  }
}

function isCatalogDocument(value: unknown): value is CatalogDocument {
  return isRow(value) && isRow(value.courses);
}

export interface YanhektCatalogStoreOptions {
  /** Wait before rewriting the file so one page of responses is one write. */
  flushMs?: number;
  warn?: (message: string, error?: unknown) => void;
}

/**
 * In-memory catalog plus the file in the log folder. Disabled until
 * `setEnabled(true)`, which loads the file so a later launch still replaces
 * fields. Clear Cache calls `reset()`, which drops both.
 *
 * Writes are synchronous on purpose. An async write could still be in flight
 * when Clear Cache deletes the file or when quitting flushes, and would then
 * put the file back or race the flush on the same temp file. The file is small
 * and written at most once per `flushMs`.
 */
export class YanhektCatalogStore implements YanhektCatalogSink {
  private state: CatalogState = createCatalogState();
  private enabled = false;
  private dirty = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly flushMs: number;
  private readonly warn: (message: string, error?: unknown) => void;

  constructor(
    private readonly directory: () => string | null,
    options: YanhektCatalogStoreOptions = {},
  ) {
    this.flushMs = options.flushMs ?? DEFAULT_FLUSH_MS;
    this.warn = options.warn ?? (() => {});
  }

  setEnabled(on: boolean): void {
    if (on === this.enabled) return;
    if (!on) {
      this.enabled = false;
      this.flushSync();
      return;
    }
    this.enabled = true;
    this.load();
  }

  observe(url: string, body: unknown): void {
    if (!this.enabled) return;
    try {
      if (!observeYanhektResponse(this.state, url, body)) return;
    } catch (error: unknown) {
      this.warn('Yanhekt catalog update failed', error);
      return;
    }
    this.dirty = true;
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.write();
    }, this.flushMs);
  }

  /** Drop the catalog and delete its files. Used by Clear Cache. */
  reset(): void {
    this.cancelTimer();
    this.dirty = false;
    this.state = createCatalogState();
    this.deleteFiles();
  }

  /** Write now. Called when recording stops and when the app quits. */
  flushSync(): void {
    this.cancelTimer();
    this.write();
  }

  private cancelTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private write(): void {
    if (!this.dirty) return;
    const dir = this.directory();
    if (!dir) return;
    const tmp = path.join(dir, CATALOG_TMP_NAME);
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(tmp, serializeCatalog(this.state.doc), 'utf8');
      // Node's rename replaces an existing file on every platform, Windows included.
      fs.renameSync(tmp, path.join(dir, YANHEKT_CATALOG_FILE_NAME));
      this.dirty = false;
    } catch (error: unknown) {
      this.warn('Failed to write Yanhekt catalog', error);
    }
  }

  private load(): void {
    const dir = this.directory();
    if (!dir) return;
    const file = path.join(dir, YANHEKT_CATALOG_FILE_NAME);
    if (!fs.existsSync(file)) {
      this.state = createCatalogState();
      this.dirty = false;
      return;
    }
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!isCatalogDocument(parsed)) throw new Error('not a catalog');
      this.state = { doc: parsed, videos: rebuildVideoIndex(parsed) };
      this.dirty = false;
    } catch (error: unknown) {
      this.warn('Yanhekt catalog file could not be read; starting empty', error);
      this.state = createCatalogState();
      this.dirty = false;
      try {
        const bak = path.join(dir, CATALOG_BAK_NAME);
        fs.rmSync(bak, { force: true });
        fs.renameSync(file, bak);
      } catch (renameError: unknown) {
        this.warn('Failed to rename the unreadable Yanhekt catalog', renameError);
      }
    }
  }

  private deleteFiles(): void {
    const dir = this.directory();
    if (!dir) return;
    for (const name of [YANHEKT_CATALOG_FILE_NAME, CATALOG_TMP_NAME, CATALOG_BAK_NAME]) {
      try {
        fs.rmSync(path.join(dir, name), { force: true });
      } catch (error: unknown) {
        this.warn('Failed to delete Yanhekt catalog file', error);
      }
    }
  }
}
