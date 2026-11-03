/**
 * Ready-made Yanhekt requests for Developer → API, from docs/architecture.md §9
 * (the API contract). Ids are left blank: the doc's example ids are fictional.
 * Notes are developer-facing and stay English in every locale.
 */
import type { DevApiMethod } from '@common/devApi';

export const CBIZ = 'https://cbiz.yanhekt.cn';

/** `anonymous`: works without a token. `auth`: needs one. */
export type PresetAuth = 'anonymous' | 'auth';

export type PresetGroup = 'catalog' | 'course' | 'live' | 'video' | 'personal' | 'account' | 'notes';

export const PRESET_GROUPS: readonly PresetGroup[] = ['catalog', 'course', 'live', 'video', 'personal', 'account', 'notes'];

export interface ApiPresetParam {
  key: string;
  value: string;
  /** Shown in an empty value box. */
  hint?: string;
}

export interface ApiPreset {
  id: string;
  group: PresetGroup;
  method: DevApiMethod;
  /** Path on cbiz.yanhekt.cn. */
  path: string;
  params: ApiPresetParam[];
  /** JSON body template for writes. */
  body?: string;
  auth: PresetAuth;
  /** Changes data on the account. */
  write?: boolean;
  /** One line from the docs: what it returns, how it fails. */
  note: string;
}

const COURSE_HINT = 'course id, e.g. 70101';
const SESSION_HINT = 'session id, e.g. 850101';

export const YANHEKT_API_PRESETS: readonly ApiPreset[] = [
  // Catalog
  {
    id: 'semester-default',
    group: 'catalog',
    method: 'GET',
    path: '/v1/tag/semester/default',
    params: [],
    auth: 'anonymous',
    note: 'The current term\'s tag row. The only source of terms since /v1/tag/list dropped them.',
  },
  {
    id: 'tag-list',
    group: 'catalog',
    method: 'GET',
    path: '/v1/tag/list',
    params: [{ key: 'with_sub', value: 'true' }],
    auth: 'anonymous',
    note: 'Tag tree (degrees, colleges, attributes). Bare array; no semesters row any more.',
  },
  {
    id: 'course-list-v2',
    group: 'catalog',
    method: 'GET',
    path: '/v2/course/list',
    params: [
      { key: 'page', value: '1' },
      { key: 'page_size', value: '16' },
      { key: 'keyword', value: '', hint: 'name or numeric course id' },
    ],
    auth: 'anonymous',
    note: 'Catalog paginator. Only this list (and the personal lists) carries classrooms[]; professors are strings. Ignores semesters[] today.',
  },
  {
    id: 'course-list-v1',
    group: 'catalog',
    method: 'GET',
    path: '/v1/course/list',
    params: [
      { key: 'page', value: '1' },
      { key: 'page_size', value: '16' },
      { key: 'keyword', value: '' },
    ],
    auth: 'anonymous',
    note: 'v1 twin: a superset of v2 (more rows, plus session_count, visibility, professor_names, …).',
  },
  {
    id: 'course-graph-v1',
    group: 'catalog',
    method: 'GET',
    path: '/v1/course/graph/list',
    params: [],
    auth: 'anonymous',
    note: 'College-grouped catalog. Unused by AutoSlides.',
  },

  // Course and session
  {
    id: 'course-detail',
    group: 'course',
    method: 'GET',
    path: '/v1/course',
    params: [
      { key: 'id', value: '', hint: COURSE_HINT },
      { key: 'with_professor_badges', value: 'true' },
    ],
    auth: 'anonymous',
    note: 'One course. No classrooms; professors are objects. 12111010 = not found, 12121028 = expired.',
  },
  {
    id: 'session-list-v1',
    group: 'course',
    method: 'GET',
    path: '/v1/course/session/list',
    params: [{ key: 'course_id', value: '', hint: COURSE_HINT }],
    auth: 'auth',
    note: 'Sessions with videos[] (main/vga/audio) and user_progress. Silent [] without a token.',
  },
  {
    id: 'session-list-v2',
    group: 'course',
    method: 'GET',
    path: '/v2/course/session/list',
    params: [{ key: 'course_id', value: '', hint: COURSE_HINT }],
    auth: 'auth',
    note: 'Returns [] even signed in since 2026-10-22 (platform regression). Use the v1 twin.',
  },
  {
    id: 'session-detail',
    group: 'course',
    method: 'GET',
    path: '/v1/course/session',
    params: [
      { key: 'session_id', value: '', hint: SESSION_HINT },
      { key: 'with_video', value: 'true' },
    ],
    auth: 'anonymous',
    note: 'Session by id with nested course and live, video_ids only (no videos[]). user_progress needs a token.',
  },
  {
    id: 'session-progress-put',
    group: 'course',
    method: 'PUT',
    path: '/v1/course/session/user/progress',
    params: [],
    body: '{\n  "session_id": "",\n  "seconds": 0\n}',
    auth: 'auth',
    write: true,
    note: 'Watch-progress heartbeat. session_id is a string; seconds is the playhead.',
  },

  // Live
  {
    id: 'live-list-v2',
    group: 'live',
    method: 'GET',
    path: '/v2/live/list',
    params: [
      { key: 'page', value: '1' },
      { key: 'page_size', value: '16' },
      { key: 'keyword', value: '' },
    ],
    auth: 'anonymous',
    note: 'Public live catalog. No name_en; read the course id from session.course_id.',
  },
  {
    id: 'live-list-personal',
    group: 'live',
    method: 'GET',
    path: '/v2/live/list',
    params: [
      { key: 'page', value: '1' },
      { key: 'page_size', value: '16' },
      { key: 'user_relationship_type', value: '1' },
    ],
    auth: 'auth',
    note: 'Personal lives. Silent [] without a token (the v1 twin answers 12131112).',
  },
  {
    id: 'live-list-v1',
    group: 'live',
    method: 'GET',
    path: '/v1/live/list',
    params: [
      { key: 'page', value: '1' },
      { key: 'page_size', value: '16' },
    ],
    auth: 'anonymous',
    note: 'v1 twin: rows carry session_id; lists fewer rows than v2.',
  },
  {
    id: 'live-detail',
    group: 'live',
    method: 'GET',
    path: '/v1/live',
    params: [
      { key: 'id', value: '', hint: 'live id, e.g. 760202' },
      { key: 'with_session', value: 'true' },
      { key: 'with_course', value: 'true' },
    ],
    auth: 'anonymous',
    note: 'Broadcast by id with its session and full course. Both with_* flags are required (61101114 otherwise).',
  },

  // Video
  {
    id: 'video-token',
    group: 'video',
    method: 'GET',
    path: '/v1/auth/video/token',
    params: [{ key: 'id', value: '0' }],
    auth: 'anonymous',
    note: '16-char CDN video token, TTL 600 s.',
  },
  {
    id: 'video-detail',
    group: 'video',
    method: 'GET',
    path: '/v1/video',
    params: [{ key: 'id', value: '', hint: 'video id, e.g. 450101' }],
    auth: 'anonymous',
    note: 'VOD URLs, duration and the classroom mic (audio). course_id/session_id are always 0.',
  },

  // Personal lists
  {
    id: 'private-list-v2',
    group: 'personal',
    method: 'GET',
    path: '/v2/course/private/list',
    params: [
      { key: 'page', value: '1' },
      { key: 'page_size', value: '16' },
      { key: 'user_relationship_type', value: '1' },
      { key: 'with_introduction', value: 'true' },
    ],
    auth: 'auth',
    note: 'Enrolled courses (current term; v2 is a subset). Silent [] without a token.',
  },
  {
    id: 'private-list-v1',
    group: 'personal',
    method: 'GET',
    path: '/v1/course/private/list',
    params: [
      { key: 'page', value: '1' },
      { key: 'page_size', value: '16' },
      { key: 'user_relationship_type', value: '1' },
    ],
    auth: 'auth',
    note: 'v1 twin: all enrolled courses, richer rows. 61101113 without a token.',
  },
  {
    id: 'subscription-list',
    group: 'personal',
    method: 'GET',
    path: '/v1/course/subscription/list',
    params: [
      { key: 'page', value: '1' },
      { key: 'page_size', value: '16' },
    ],
    auth: 'auth',
    note: 'Subscriptions (desktop Pinned). Default page_size upstream is 4, so always pass one.',
  },
  {
    id: 'subscribe',
    group: 'personal',
    method: 'POST',
    path: '/v1/course/subscription',
    params: [],
    body: '{\n  "course_id": ""\n}',
    auth: 'auth',
    write: true,
    note: 'Subscribe to a course.',
  },
  {
    id: 'unsubscribe',
    group: 'personal',
    method: 'DELETE',
    path: '/v1/course/subscription',
    params: [],
    body: '{\n  "course_id": ""\n}',
    auth: 'auth',
    write: true,
    note: 'Unsubscribe. DELETE with a JSON body.',
  },

  // Account
  {
    id: 'user',
    group: 'account',
    method: 'GET',
    path: '/v1/user',
    params: [],
    auth: 'auth',
    note: 'Profile of the token\'s account. 61101113 when the token is missing or revoked.',
  },

  // Notes
  {
    id: 'note-list',
    group: 'notes',
    method: 'GET',
    path: '/v1/note/list',
    params: [
      { key: 'with_brief', value: 'false' },
      { key: 'keyword', value: '' },
      { key: 'page', value: '1' },
      { key: 'page_size', value: '20' },
      { key: 'with_page', value: 'true' },
    ],
    auth: 'auth',
    note: 'Note paginator. content is "" in the list; read one note for it.',
  },
  {
    id: 'note-detail',
    group: 'notes',
    method: 'GET',
    path: '/v1/note',
    params: [{ key: 'id', value: '', hint: 'note id' }],
    auth: 'auth',
    note: 'One note with its Editor.js content (a JSON string).',
  },
  {
    id: 'note-groups',
    group: 'notes',
    method: 'GET',
    path: '/v1/note/group/list',
    params: [{ key: 'with_note', value: 'false' }],
    auth: 'auth',
    note: 'Note groups. Bare array; look managed groups up by name.',
  },
  {
    id: 'note-create',
    group: 'notes',
    method: 'POST',
    path: '/v1/note',
    params: [],
    body: '{\n  "content": "",\n  "version": 2\n}',
    auth: 'auth',
    write: true,
    note: 'Create an empty note. Answers { id }.',
  },
  {
    id: 'note-update',
    group: 'notes',
    method: 'PUT',
    path: '/v1/note',
    params: [],
    body: '{\n  "id": 0,\n  "title": "",\n  "note_group_id": 1\n}',
    auth: 'auth',
    write: true,
    note: 'Rename or regroup a note. note_group_id 0 is rejected.',
  },
  {
    id: 'note-delete',
    group: 'notes',
    method: 'DELETE',
    path: '/v1/note',
    params: [],
    body: '{\n  "id": 0\n}',
    auth: 'auth',
    write: true,
    note: 'Delete a note.',
  },
];

/** Meanings of the cbiz `code` values the docs list (§9.1). */
export const CBIZ_CODES: Readonly<Record<string, string>> = {
  '0': 'OK',
  '61101113': 'Not signed in (用户未登录)',
  '61101114': 'System busy (系统繁忙); also what a route that does not exist answers',
  '61101210': 'Missing parameter',
  '12131112': 'Service runtime exception (personal v1 live list without a token)',
  '12131113': 'Ended-live filter rejected',
  '12131011': 'Live does not exist',
  '12111010': 'Course not found',
  '12121028': 'Course expired (课程已过期)',
  '13001001': 'Auth failed',
  '99151011': 'Gateway could not reach the backend (transient)',
};

/** Full URL of a preset, empty params kept so they show in the table. */
export function presetUrl(preset: ApiPreset): string {
  const query = preset.params.map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
  return `${CBIZ}${preset.path}${query ? `?${query}` : ''}`;
}
