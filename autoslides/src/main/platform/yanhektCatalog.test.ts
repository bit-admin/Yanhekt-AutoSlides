import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createCatalogState,
  observeYanhektResponse,
  serializeCatalog,
  YanhektCatalogStore,
  YANHEKT_CATALOG_FILE_NAME,
  type CatalogState,
} from './yanhektCatalog';

const COURSE = 'https://cbiz.yanhekt.cn/v2/course/list?page=1';
const DETAIL = 'https://cbiz.yanhekt.cn/v1/course?id=70101&with_professor_badges=true';
const SESSIONS = 'https://cbiz.yanhekt.cn/v2/course/session/list?course_id=70101';
const SESSION = 'https://cbiz.yanhekt.cn/v1/course/session?session_id=850101&with_video=true';
const LIVES = 'https://cbiz.yanhekt.cn/v2/live/list?page=1&page_size=16&user_relationship_type=0';
const VIDEO = 'https://cbiz.yanhekt.cn/v1/video?id=450101';

function ok(data: unknown): { code: number; data: unknown } {
  return { code: 0, data };
}

function catalog(): CatalogState {
  return createCatalogState();
}

function recorded(state: CatalogState): unknown {
  return JSON.parse(serializeCatalog(state.doc));
}

describe('observeYanhektResponse', () => {
  it('lets a later course response replace fields and keeps ones it does not send', () => {
    const state = catalog();
    observeYanhektResponse(state, COURSE, ok({
      data: [{
        id: 70101,
        name_zh: '泛函分析',
        name_en: 'Functional Analysis',
        code: '100990101',
        number: '20252026110099010101',
        school_year: '2025-2026',
        semester: '1',
        college_name: '数学与统计学院',
        college_code: '217',
        participant_count: 61,
        professors: ['沈墨白', '旧名'],
        classrooms: [{ id: 201, name: '明理楼A302', number: '9901A3002X' }],
        image_url: 'https://coss.yanhekt.cn/images/colleges/shuxue.png',
      }],
    }));
    observeYanhektResponse(state, DETAIL, ok({
      name_zh: '泛函分析',
      name_en: 'Functional Analysis',
      semester: 1,
      professors: [{ name: '沈墨白', badge: '6100000002' }],
      image_url: '',
      college: { image_url: 'https://coss.yanhekt.cn/images/colleges/shuxue.png' },
    }));

    expect(recorded(state)).toMatchObject({
      courses: {
        '70101': {
          courseId: '70101',
          nameZh: '泛函分析',
          code: '100990101',
          number: '20252026110099010101',
          semester: '1',
          collegeCode: '217',
          participantCount: 61,
          professors: ['沈墨白'],
          classrooms: [{ id: '201', name: '明理楼A302', number: '9901A3002X' }],
          imageUrl: 'https://coss.yanhekt.cn/images/colleges/shuxue.png',
        },
      },
    });
  });

  it('keeps a live broadcast off the course record, including a null course.id', () => {
    const state = catalog();
    observeYanhektResponse(state, COURSE, ok({
      data: [{ id: 73001, name_zh: '概率论实验', professors: ['沈墨白'] }],
    }));
    observeYanhektResponse(state, LIVES, ok({
      data: [{
        id: 760101,
        title: '直播标题',
        subtitle: '博学楼403',
        status: 1,
        schedule_started_at: '2026-03-11 15:15:00',
        schedule_ended_at: '2026-03-11 17:40:00',
        target: 'https://clive10.yanhekt.cn/live/10001_Video1.m3u8',
        target_vga: 'https://clive10.yanhekt.cn/live/10001_VGA.m3u8',
        target_room: 'https://clive10.yanhekt.cn/live/10001_Video2.m3u8',
        course: { id: null, image_url: '' },
        session: { course_id: 73001, professor: { name: '另一个老师' } },
      }, {
        id: 760102,
        title: '没有课程号',
        course: { id: null },
      }],
    }));

    const doc = recorded(state) as {
      courses: Record<string, { nameZh?: string; professors?: string[]; lives?: Record<string, { title?: string; target?: string }> }>;
      unlinked?: { lives?: Record<string, unknown> };
    };
    expect(doc.courses['73001'].nameZh).toBe('概率论实验');
    expect(doc.courses['73001'].professors).toEqual(['沈墨白']);
    expect(doc.courses['73001'].lives?.['760101']).toMatchObject({
      liveId: '760101',
      title: '直播标题',
      target: 'https://clive10.yanhekt.cn/live/10001_Video1.m3u8',
      targetVga: 'https://clive10.yanhekt.cn/live/10001_VGA.m3u8',
      targetRoom: 'https://clive10.yanhekt.cn/live/10001_Video2.m3u8',
    });
    expect(doc.courses['73001'].lives?.['760101']).not.toHaveProperty('sessionId');
    expect(doc.unlinked?.lives?.['760102']).toMatchObject({ liveId: '760102', title: '没有课程号' });
    expect(doc.courses).not.toHaveProperty('null');
  });

  it('records the session id, not the video id, and lets /v1/video fill the mic without clearing a url', () => {
    const state = catalog();
    observeYanhektResponse(state, SESSIONS, ok([{
      id: 850101,
      title: '第1周 星期三 第2大节',
      week_number: 4,
      day: '3',
      started_at: '2025-09-17 09:55:00',
      ended_at: '2025-09-17 11:30:00',
      location: '9901A3002X',
      videos: [{
        id: 450101,
        main: 'https://cvideo.yanhekt.cn/vod/2025/09/17/41234567/0/Video1/Video1.m3u8',
        vga: 'https://cvideo.yanhekt.cn/vod/2025/09/17/41234567/0/VGA/VGA.m3u8',
      }],
    }]));
    observeYanhektResponse(state, VIDEO, ok({
      id: 450101,
      main: 'https://cvideo.yanhekt.cn/vod/2025/09/17/41234567/0/Video1/Video1.m3u8',
      vga: '',
      audio: 'https://cvideo.yanhekt.cn/vod/2025/09/17/41234567/0/Audio/Audio.aac',
    }));
    observeYanhektResponse(state, VIDEO, ok({ id: 450101, audio: '' }));

    expect(recorded(state)).toMatchObject({
      courses: {
        '70101': {
          sessions: {
            '850101': {
              sessionId: '850101',
              title: '第1周 星期三 第2大节',
              day: '3',
              videos: {
                '450101': {
                  videoId: '450101',
                  main: 'https://cvideo.yanhekt.cn/vod/2025/09/17/41234567/0/Video1/Video1.m3u8',
                  vga: 'https://cvideo.yanhekt.cn/vod/2025/09/17/41234567/0/VGA/VGA.m3u8',
                  audio: 'https://cvideo.yanhekt.cn/vod/2025/09/17/41234567/0/Audio/Audio.aac',
                },
              },
            },
          },
        },
      },
    });
  });

  it('holds a video that arrives before its session, then moves it onto the session', () => {
    const state = catalog();
    observeYanhektResponse(state, VIDEO, ok({
      id: 450101,
      main: 'https://cvideo.yanhekt.cn/vod/old/Video1.m3u8',
      audio: 'https://cvideo.yanhekt.cn/vod/old/Audio.aac',
    }));
    expect(recorded(state)).toMatchObject({
      courses: {},
      unlinked: {
        videos: {
          '450101': {
            main: 'https://cvideo.yanhekt.cn/vod/old/Video1.m3u8',
            audio: 'https://cvideo.yanhekt.cn/vod/old/Audio.aac',
          },
        },
      },
    });

    observeYanhektResponse(state, SESSIONS, ok([{
      id: 850101,
      title: '第1周',
      videos: [{ id: 450101, main: 'https://cvideo.yanhekt.cn/vod/new/Video1.m3u8', vga: 'https://cvideo.yanhekt.cn/vod/new/VGA.m3u8' }],
    }]));
    const doc = recorded(state) as { unlinked?: unknown; courses: Record<string, { sessions: Record<string, { videos: Record<string, { main?: string; audio?: string; vga?: string }> }> }> };
    expect(doc.unlinked).toBeUndefined();
    expect(doc.courses['70101'].sessions['850101'].videos['450101']).toEqual({
      videoId: '450101',
      main: 'https://cvideo.yanhekt.cn/vod/new/Video1.m3u8',
      vga: 'https://cvideo.yanhekt.cn/vod/new/VGA.m3u8',
      audio: 'https://cvideo.yanhekt.cn/vod/old/Audio.aac',
    });
  });

  it('links a session and its live from session detail without clearing a missing course name', () => {
    const state = catalog();
    observeYanhektResponse(state, COURSE, ok({
      data: [{ id: 70101, name_zh: '泛函分析', professors: ['沈墨白'] }],
    }));
    observeYanhektResponse(state, SESSION, ok({
      id: 850101,
      course_id: 70101,
      title: '第1周 星期三 第2大节',
      video_ids: [450101],
      course: { id: 70101, name_zh: '', name_en: 'Functional Analysis', semester: 1 },
      live: {
        id: 650101,
        status: 3,
        title: '泛函分析',
        subtitle: '明理楼A302',
        target: 'https://clive13.yanhekt.cn/live/23375_Video1.m3u8',
        target_vga: 'https://clive13.yanhekt.cn/live/23375_VGA.m3u8',
        target_room: 'https://clive13.yanhekt.cn/live/23375_Video2.m3u8',
      },
    }));

    const course = (recorded(state) as { courses: Record<string, { nameZh?: string; nameEn?: string; sessions: Record<string, { liveId?: string; videos?: Record<string, { main?: string }> }>; lives: Record<string, { sessionId?: string; target?: string }> }> }).courses['70101'];
    expect(course.nameZh).toBe('泛函分析');
    expect(course.nameEn).toBe('Functional Analysis');
    expect(course.sessions['850101'].liveId).toBe('650101');
    expect(course.sessions['850101'].videos?.['450101']).toEqual({ videoId: '450101' });
    expect(course.lives['650101']).toMatchObject({
      liveId: '650101',
      sessionId: '850101',
      status: 3,
      target: 'https://clive13.yanhekt.cn/live/23375_Video1.m3u8',
    });
  });

  it('ignores a failed envelope and anything that is not a catalog response', () => {
    const state = catalog();
    expect(observeYanhektResponse(state, COURSE, { code: 12111010, message: 'missing', data: [] })).toBe(false);
    expect(observeYanhektResponse(state, 'https://cbiz.yanhekt.cn/v1/user', ok({ badge: 'secret' }))).toBe(false);
    expect(observeYanhektResponse(state, 'https://cbiz.yanhekt.cn/v1/auth/video/token?id=0', ok({ token: 'abcdefghijklmnop' }))).toBe(false);
    expect(recorded(state)).toEqual({ courses: {} });
  });
});

describe('YanhektCatalogStore', () => {
  const dirs: string[] = [];

  afterEach(() => {
    vi.useRealTimers();
    for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
    dirs.length = 0;
  });

  function tempDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yanhekt-catalog-'));
    dirs.push(dir);
    return dir;
  }

  it('loads an existing file and replaces a field on the next response', () => {
    const dir = tempDir();
    const file = path.join(dir, YANHEKT_CATALOG_FILE_NAME);
    fs.writeFileSync(file, `${JSON.stringify({
      courses: { '70101': { courseId: '70101', nameZh: '旧名', classrooms: [{ name: '明理楼A302' }] } },
    })}\n`);
    const store = new YanhektCatalogStore(() => dir, { flushMs: 60_000 });
    store.setEnabled(true);
    store.observe(DETAIL, ok({ name_zh: '泛函分析', professors: [{ name: '沈墨白' }] }));
    store.flushSync();
    const written = JSON.parse(fs.readFileSync(file, 'utf8')) as { courses: Record<string, { nameZh?: string; professors?: string[]; classrooms?: unknown }> };
    expect(written.courses['70101'].nameZh).toBe('泛函分析');
    expect(written.courses['70101'].professors).toEqual(['沈墨白']);
    expect(written.courses['70101'].classrooms).toEqual([{ name: '明理楼A302' }]);
  });

  it('renames an unreadable file aside and does not record while disabled', () => {
    const dir = tempDir();
    const file = path.join(dir, YANHEKT_CATALOG_FILE_NAME);
    fs.writeFileSync(file, '{');
    const store = new YanhektCatalogStore(() => dir, { flushMs: 60_000 });
    store.setEnabled(true);
    expect(fs.existsSync(file)).toBe(false);
    expect(fs.existsSync(`${file}.bak`)).toBe(true);

    store.setEnabled(false);
    store.observe(COURSE, ok({ data: [{ id: 70101, name_zh: '泛函分析' }] }));
    store.flushSync();
    expect(fs.existsSync(file)).toBe(false);
  });

  it('writes one page of responses once, and Clear Cache cancels a pending write', () => {
    vi.useFakeTimers();
    const dir = tempDir();
    const file = path.join(dir, YANHEKT_CATALOG_FILE_NAME);
    const store = new YanhektCatalogStore(() => dir, { flushMs: 1000 });
    store.setEnabled(true);
    store.observe(COURSE, ok({ data: [{ id: 70101, name_zh: '泛函分析' }] }));
    store.observe(DETAIL, ok({ name_zh: '泛函分析', name_en: 'Functional Analysis' }));
    expect(fs.existsSync(file)).toBe(false);
    vi.advanceTimersByTime(1000);
    const written = JSON.parse(fs.readFileSync(file, 'utf8')) as { courses: Record<string, { nameEn?: string }> };
    expect(written.courses['70101'].nameEn).toBe('Functional Analysis');

    store.observe(SESSIONS, ok([{ id: 850101, title: '第1周' }]));
    store.reset();
    vi.advanceTimersByTime(1000);
    expect(fs.existsSync(file)).toBe(false);
  });

  it('reset deletes the file', () => {
    const dir = tempDir();
    const store = new YanhektCatalogStore(() => dir, { flushMs: 60_000 });
    store.setEnabled(true);
    store.observe(COURSE, ok({ data: [{ id: 70101, name_zh: '泛函分析' }] }));
    store.flushSync();
    expect(fs.existsSync(path.join(dir, YANHEKT_CATALOG_FILE_NAME))).toBe(true);
    store.reset();
    expect(fs.existsSync(path.join(dir, YANHEKT_CATALOG_FILE_NAME))).toBe(false);
    expect(fs.existsSync(path.join(dir, `${YANHEKT_CATALOG_FILE_NAME}.bak`))).toBe(false);
  });
});
