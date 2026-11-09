/**
 * Ready-made Yanhe 2.0 (aita.yanhekt.cn) requests for Developer → API, from
 * docs/aita-yanhekt.md. Every call needs the account's Yanhe 2.0 token (an
 * anonymous call is a bare 403). Ids are left blank; the hints use the doc's
 * fictional example ids. Notes are developer-facing and stay English in every
 * locale.
 *
 * On aita a GET can change the account (§5.16), so `write` is set by effect,
 * not by method.
 */
import { YANHE2_ORIGIN } from '@common/yanhe2';
import type { ApiPreset, PresetGroup } from './yanhektApiPresets';

export const YANHE2 = YANHE2_ORIGIN;

export const YANHE2_PRESET_GROUPS: readonly PresetGroup[] = [
  'account', 'catalog', 'course', 'calendar', 'personal', 'playback', 'serverContent',
];

const COURSE_HINT = 'course id, e.g. 200101';
const SUB_HINT = 'session (sub) id, e.g. 3000101';
const USER_ID_HINT = 'aita user id (infosimple params.id)';

export const YANHE2_API_PRESETS: readonly ApiPreset[] = [
  // Account
  {
    id: 'y2-infosimple',
    group: 'account',
    method: 'GET',
    path: '/userapi/v1/infosimple',
    params: [],
    auth: 'auth',
    note: 'Profile of the token\'s account; the token check. params.id / tenant_id / phone sign /play/. Envelope {code:200, params}.',
  },
  {
    id: 'y2-group-user',
    group: 'account',
    method: 'GET',
    path: '/consoleapi/v2/user/group-user',
    params: [],
    auth: 'auth',
    note: 'CMC bootstrap. user_info.id is not the infosimple id and cannot sign /play/. Envelope {code:10000, data}.',
  },

  // Catalog
  {
    id: 'y2-course-list',
    group: 'catalog',
    method: 'GET',
    path: '/courseapi/v3/multi-search/get-course-list',
    params: [
      { key: 'title', value: '', hint: 'title or teacher substring; not kcwybm' },
      { key: 'tenant', value: '21' },
      { key: 'page', value: '1' },
      { key: 'per_page', value: '16' },
      { key: 'term', value: '', hint: 'one bare term id, e.g. 42' },
    ],
    auth: 'auth',
    note: 'Catalog search, the one the app uses. No date filter. data.total and row ids are strings.',
  },
  {
    id: 'y2-search-term',
    group: 'catalog',
    method: 'GET',
    path: '/courseapi/v2/schedule/search-term',
    params: [{ key: 'tenant', value: '21' }],
    auth: 'auth',
    note: 'Terms. id (a number) is what term= takes; current: true is the default term. Flat {code:0, total, list}.',
  },
  {
    id: 'y2-search-xy-list',
    group: 'catalog',
    method: 'GET',
    path: '/courseapi/v2/schedule/search-xy-list',
    params: [{ key: 'tenant', value: '21' }],
    auth: 'auth',
    note: 'Schools: kkxy_code / kkxy_name. The first rows (00000, 0001, 00011) are not schools.',
  },
  {
    id: 'y2-searchlist',
    group: 'catalog',
    method: 'GET',
    path: '/pptnote/v1/searchlist',
    params: [
      { key: 'tenant_id', value: '21' },
      { key: 'user_id', value: '', hint: USER_ID_HINT },
      { key: 'user_name', value: '', hint: 'student number' },
      { key: 'title', value: '' },
      { key: 'page', value: '1' },
      { key: 'per_page', value: '16' },
    ],
    auth: 'auth',
    write: true,
    note: 'The site\'s top-bar search. Every call appends to the search history. No hits is HTTP 200 {code:-1}; total is an object.',
  },
  {
    id: 'y2-searchhistory',
    group: 'catalog',
    method: 'GET',
    path: '/pptnote/v1/searchhistory',
    params: [
      { key: 'tenant_id', value: '21' },
      { key: 'user_id', value: '', hint: USER_ID_HINT },
      { key: 'user_name', value: '', hint: 'student number' },
      { key: 'source', value: '1' },
    ],
    auth: 'auth',
    note: 'The search-history chips. total is not list.length.',
  },

  // Course and session
  {
    id: 'y2-course-detail',
    group: 'course',
    method: 'GET',
    path: '/courseapi/v3/multi-search/get-course-detail',
    params: [
      { key: 'course_id', value: '', hint: COURSE_HINT },
      { key: 'student', value: '', hint: 'student number, for finished 0/1' },
    ],
    auth: 'auth',
    note: 'One course with its sessions and kcwybm (= cbiz course.number). Without student, finished is always 0.',
  },
  {
    id: 'y2-catalogue',
    group: 'course',
    method: 'GET',
    path: '/courseapi/v2/course/catalogue',
    params: [{ key: 'course_id', value: '', hint: COURSE_HINT }],
    auth: 'auth',
    note: 'A course\'s sessions as a flat list. Envelope {success, result:{code:200, data}}.',
  },
  {
    id: 'y2-teacher-others',
    group: 'course',
    method: 'GET',
    path: '/courseapi/v3/multi-search/get-course-teacher-others',
    params: [
      { key: 'course_id', value: '', hint: COURSE_HINT },
      { key: 'per_page', value: '10' },
    ],
    auth: 'auth',
    note: 'The same teacher\'s other courses. data is a bare array; no kcwybm.',
  },

  // Calendar
  {
    id: 'y2-day-list',
    group: 'calendar',
    method: 'GET',
    path: '/courseapi/v3/course-live-role/search-role-course-list',
    params: [
      { key: 'search_time', value: '', hint: 'Y-M-D, not zero-padded, e.g. 2026-9-28' },
      { key: 'tenant', value: '21' },
      { key: 'need_time_quantum', value: '1' },
      { key: 'unique_course', value: '1' },
      { key: 'with_sub_duration', value: '1' },
      { key: 'with_sub_data', value: '1' },
      { key: 'has_frame', value: '1' },
      { key: 'nteacher', value: '0' },
      { key: 'like_title', value: '' },
      { key: 'quantum_id', value: '', hint: 'one period id from list[].id' },
    ],
    auth: 'auth',
    note: 'Calendar → All Courses: one school day, list = periods, total = sessions. search_time is required.',
  },
  {
    id: 'y2-week',
    group: 'calendar',
    method: 'GET',
    path: '/courseapi/v2/schedule/get-week-schedules',
    params: [
      { key: 'user_id', value: '', hint: USER_ID_HINT },
      { key: 'tenant_id', value: '21' },
      { key: 'start_at', value: '', hint: 'YYYY-MM-DD' },
      { key: 'end_at', value: '', hint: 'YYYY-MM-DD' },
    ],
    auth: 'auth',
    note: 'Calendar → My Courses: one element per day. A week with no classes is result.code 400 (课表为空), no list.',
  },

  // My courses
  {
    id: 'y2-my-courses',
    group: 'personal',
    method: 'GET',
    path: '/vlabpassportapi/v1/account-profile/course',
    params: [
      { key: 'nowpage', value: '1' },
      { key: 'per-page', value: '20' },
      { key: 'force_mycourse', value: '1' },
    ],
    auth: 'auth',
    note: 'Enrolled courses, past terms included. per-page has a hyphen; drop force_mycourse to mix in opened ones. {code:1000}.',
  },
  {
    id: 'y2-study',
    group: 'personal',
    method: 'GET',
    path: '/vlabpassportapi/v1/account-profile/study',
    params: [
      { key: 'nowpage', value: '1' },
      { key: 'per-page', value: '5' },
    ],
    auth: 'auth',
    note: 'Recently studied, with course_subject_id (the session). Rows are under params.result.models.',
  },
  {
    id: 'y2-bookmarks',
    group: 'personal',
    method: 'GET',
    path: '/courseapi/v3/course-collect/lists',
    params: [
      { key: 'course_title', value: '' },
      { key: 'page', value: '1' },
      { key: 'per-page', value: '50' },
    ],
    auth: 'auth',
    note: '「我的收藏」, every term. id is the bookmark row, not the course. Envelope result.err 200.',
  },
  {
    id: 'y2-bookmark-add',
    group: 'personal',
    method: 'GET',
    path: '/courseapi/v3/course-collect/down',
    params: [{ key: 'course_id', value: '', hint: COURSE_HINT }],
    auth: 'auth',
    write: true,
    note: 'Bookmarks a course (a GET that writes). err 201 = already bookmarked, nothing changed.',
  },
  {
    id: 'y2-bookmark-remove',
    group: 'personal',
    method: 'GET',
    path: '/courseapi/v3/course-collect/down',
    params: [
      { key: 'course_id', value: '', hint: COURSE_HINT },
      { key: 'cancel', value: '1' },
    ],
    auth: 'auth',
    write: true,
    note: 'Removes a bookmark. Answers 200 已取消收藏 even when it was not bookmarked.',
  },

  // Playback
  {
    id: 'y2-sub-info',
    group: 'playback',
    method: 'GET',
    path: '/courseapi/v3/portal-home-setting/get-sub-info',
    params: [
      { key: 'course_id', value: '', hint: COURSE_HINT },
      { key: 'sub_id', value: '', hint: SUB_HINT },
    ],
    auth: 'auth',
    note: 'One session\'s streams. Recorded and live differ in shape; /play/ URLs need a t= signature to fetch.',
  },
  {
    id: 'y2-play-config',
    group: 'playback',
    method: 'GET',
    path: '/courseapi/v2/play-template/get-config',
    params: [
      { key: 'tenant_id', value: '21' },
      { key: 'course_id', value: '', hint: COURSE_HINT },
      { key: 'sub_id', value: '', hint: SUB_HINT },
    ],
    auth: 'auth',
    note: 'The player\'s module list. Payload is data.data. A listed module does not mean the session has it.',
  },

  // Slides and transcript
  {
    id: 'y2-slides',
    group: 'serverContent',
    method: 'GET',
    path: '/pptnote/v1/schedule/search-ppt',
    params: [
      { key: 'sub_id', value: '', hint: SUB_HINT },
      { key: 'course_id', value: '' },
    ],
    auth: 'auth',
    note: 'Server slides in time order; paging is ignored, one call is all. content is a JSON string (pptimgurl).',
  },
  {
    id: 'y2-transcript',
    group: 'serverContent',
    method: 'GET',
    path: '/courseapi/v3/web-socket/search-trans-result',
    params: [
      { key: 'sub_id', value: '', hint: SUB_HINT },
      { key: 'format', value: 'json' },
    ],
    auth: 'auth',
    note: 'Speech-recognition transcript; read list[0].all_content. No transcript is HTTP 200 {code:10002}.',
  },
];

/** Meanings of the aita envelope codes the doc lists (§3.2, §5.16, §8.1). */
export const YANHE2_CODES: Readonly<Record<string, string>> = {
  '0': 'OK',
  '200': 'OK',
  '1000': 'OK',
  '10000': 'OK',
  '201': 'Already bookmarked (重复收藏); nothing changed',
  '400': 'Empty (课表为空 on the week schedule)',
  '10002': 'No transcript (未查询到语音数据)',
  '-1': 'No data (没有数据), or tenant_id / user_id + user_name missing',
};

/** The codes that mean success, whichever envelope carries them. */
const YANHE2_OK_CODES = new Set(['0', '200', '201', '1000', '10000']);

export function isYanhe2OkCode(code: string): boolean {
  return YANHE2_OK_CODES.has(code);
}
