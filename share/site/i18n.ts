/** Two languages: Chinese (default for zh browsers) and English. */

import { useSyncExternalStore } from 'react';

export type Lang = 'zh' | 'en';

const KEY = 'index.lang';

function initial(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'zh' || saved === 'en') return saved;
  } catch {
    /* storage blocked */
  }
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

let lang: Lang = initial();
const listeners = new Set<() => void>();

export function setLang(next: Lang): void {
  lang = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* storage blocked */
  }
  document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en';
  listeners.forEach((l) => l());
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => lang,
  );
}

document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';

const zh = {
  brandSub: 'AutoSlides',
  placeholder: '课程名、教师、课程 ID、课程唯一编码或课程链接',
  searchButton: '索引搜索',
  luckyButton: '手气不错',
  searchIn: '搜索范围',
  clear: '清除',
  search: '搜索',
  footerUpdated: (when: string) => `索引更新于 ${when}`,
  footerTotals: (terms: number) => `${terms} 个学期`,
  footerAbout: '仅收录延河课堂公开可见的课程。课程页的上课时间、教室与录像信息实时读取自延河课堂。',
  api: 'API',
  identifierTab: '按编号查找',
  stats: (n: string, secs: string) => `找到 ${n} 门课程（用时 ${secs} 秒）`,
  statsTop: (shown: number) => `，显示最相关的 ${shown} 门`,
  statsTruncated: '。匹配过多，只比较了最新的 5000 门，请换用更具体的词',
  noResults: (q: string, term: string) => `在 ${term} 中找不到和“${q}”相符的课程。`,
  noResultsId: (q: string) => `索引中没有编号为“${q}”的课程。`,
  suggestions: '建议：',
  suggestOtherTerm: '换个学期：',
  suggestShorter: '用更短或更常见的词，例如只输入课程名的一部分或教师姓名。',
  suggestId: '粘贴课程链接、课程 ID 或课程唯一编码（如 kcwybm），不需要选学期。',
  suggestCoverage: '索引还在补全往年的课程，较早的学期可能暂缺。',
  termNotIndexed: (term: string) => `索引中还没有 ${term} 的课程。`,
  indexedTerms: '已收录的学期：',
  matchId: '课程 ID 匹配',
  matchNumber: '课程唯一编码匹配',
  teachers: '教师',
  colon: '：',
  noTeachers: '教师未知',
  sessions: (n: number) => `${n} 个课时`,
  number: '课程唯一编码',
  courseId: '课程 ID',
  term: '学期',
  sessionsLabel: '课时',
  viewSessions: '查看课时 ID',
  openOnYanhekt: '在延河课堂打开',
  openOnWeb: '在 AutoSlides 网页版打开',
  copy: '复制',
  copied: '已复制',
  openInApp: '在 AutoSlides 桌面版打开',
  rowWeb: 'AutoSlides 网页版',
  rowApp: 'AutoSlides 桌面版',
  appMissing: '没有反应？需要在这台电脑上安装 AutoSlides 5.2.0 或更高版本。',
  getApp: '下载 AutoSlides',
  previous: '上一页',
  next: '下一页',
  sessionsHeading: '课时',
  sessionId: '课时 ID',
  aboutCourse: '课程信息',
  college: '学院',
  courseCode: '课程代码',
  level: '层次',
  levelName: (raw: string) => raw,
  sessionsSummary: (n: string, recorded: string | null) => (recorded === null ? `${n} 个课时` : `${n} 个课时，其中 ${recorded} 个可回放`),
  recorded: '可回放',
  liveNow: '直播中',
  upcoming: '即将开始',
  noRecording: '暂无录像',
  sessionFallback: (id: number) => `课时 ${id}`,
  sessionGone: '延河课堂已没有这个课时。',
  sessionUnavailable: '暂时读不到这个课时的信息。',
  yanhektFailed: '暂时无法从延河课堂读取上课时间与录像信息，下面只列出课时 ID。',
  dateFormat: (d: Date) => new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short', timeZone: 'Asia/Shanghai' }).format(d),
  noSessions: '索引中还没有这门课的课时。',
  courseNotFound: (id: string) => `索引中没有课程 ${id}。`,
  backToSearch: '返回搜索',
  loading: '正在加载…',
  errors: {
    network: '连不上索引。索引只对校园网开放；不在校内时请先通过验证或连接校园网。',
    internal: '索引暂时不可用，请稍后再试。',
    'query-too-short': '请至少输入 2 个字。',
    'query-too-long': '搜索词太长了（最多 64 个字符、6 个词）。',
    'query-required': '请输入要搜索的内容。',
    'term-required': '请选择学期。',
    'term-not-indexed': '索引中还没有这个学期。',
    'bad-param': '无法搜索这个内容。课时链接不能搜索，请粘贴课程链接或搜索课程名。',
    'not-found': '没有找到。',
  } as Record<string, string>,
  termLabel: (year: string, n: number) => `${year} 学年 ${['', '第一学期', '第二学期', '第三学期'][n] ?? `第 ${n} 学期`}`,
  termShort: (year: string, n: number) => `${year.slice(2, 4)}-${year.slice(7, 9)} ${['', '秋', '春', '夏'][n] ?? n}`,
  title: (q: string) => `${q} - Index 搜索`,
  homeTitle: 'Index · 延河课堂课程索引',
};

const en: typeof zh = {
  brandSub: 'AutoSlides',
  placeholder: 'Course name, instructor, course ID, registrar code or link',
  searchButton: 'Index Search',
  luckyButton: "I'm Feeling Lucky",
  searchIn: 'Search in',
  clear: 'Clear',
  search: 'Search',
  footerUpdated: (when) => `Index updated ${when}`,
  footerTotals: (terms) => `${terms} terms`,
  footerAbout: 'Lists Yanhekt courses that are publicly visible. Times, rooms and recordings on a course page are read live from Yanhekt.',
  api: 'API',
  identifierTab: 'By ID',
  stats: (n, secs) => `About ${n} courses (${secs} seconds)`,
  statsTop: (shown) => `, showing the best ${shown}`,
  statsTruncated: '. Too many matches: only the newest 5,000 were compared; try a more specific word',
  noResults: (q, term) => `Your search - ${q} - did not match any courses in ${term}.`,
  noResultsId: (q) => `No course with the ID or code "${q}" is in the index.`,
  suggestions: 'Suggestions:',
  suggestOtherTerm: 'Try another term: ',
  suggestShorter: 'Try fewer or more common words, such as part of the course name or an instructor’s name.',
  suggestId: 'Paste a course link, course ID or registrar code (kcwybm); no term needed.',
  suggestCoverage: 'Earlier terms are still being filled in and may be incomplete.',
  termNotIndexed: (term) => `${term} is not in the index yet.`,
  indexedTerms: 'Terms in the index: ',
  matchId: 'Course ID match',
  matchNumber: 'Registrar code match',
  teachers: 'Instructors',
  colon: ': ',
  noTeachers: 'Instructor unknown',
  sessions: (n) => `${n} ${n === 1 ? 'session' : 'sessions'}`,
  number: 'Registrar Code',
  courseId: 'Course ID',
  term: 'Term',
  sessionsLabel: 'Sessions',
  viewSessions: 'Session IDs',
  openOnYanhekt: 'Open on Yanhekt',
  openOnWeb: 'Open in AutoSlides Web',
  copy: 'Copy',
  copied: 'Copied',
  openInApp: 'Open in AutoSlides Desktop',
  rowWeb: 'AutoSlides Web',
  rowApp: 'AutoSlides Desktop',
  appMissing: 'Nothing opened? This needs AutoSlides 5.2.0 or later on this computer.',
  getApp: 'Get AutoSlides',
  previous: 'Previous',
  next: 'Next',
  sessionsHeading: 'Sessions',
  sessionId: 'Session ID',
  aboutCourse: 'About This Course',
  college: 'College',
  courseCode: 'Course Code',
  level: 'Level',
  levelName: (raw) => ({ 本科: 'Undergraduate', 研究生: 'Graduate' })[raw] ?? raw,
  sessionsSummary: (n, recorded) => (recorded === null ? `${n} sessions` : `${n} sessions, ${recorded} recorded`),
  recorded: 'Recorded',
  liveNow: 'Live',
  upcoming: 'Upcoming',
  noRecording: 'No recording',
  sessionFallback: (id) => `Session ${id}`,
  sessionGone: 'Yanhekt no longer has this session.',
  sessionUnavailable: 'Could not read this session right now.',
  yanhektFailed: 'Could not read times and recordings from Yanhekt right now; only session IDs are listed below.',
  dateFormat: (d) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', weekday: 'short', timeZone: 'Asia/Shanghai' }).format(d),
  noSessions: 'The index has no sessions for this course yet.',
  courseNotFound: (id) => `Course ${id} is not in the index.`,
  backToSearch: 'Back to search',
  loading: 'Loading…',
  errors: {
    network: 'Could not reach the index. It is open to the campus network only; off campus, pass the check or connect to the campus network first.',
    internal: 'The index is unavailable right now. Try again later.',
    'query-too-short': 'Type at least 2 characters.',
    'query-too-long': 'That search is too long (at most 64 characters and 6 words).',
    'query-required': 'Type something to search for.',
    'term-required': 'Choose a term.',
    'term-not-indexed': 'That term is not in the index yet.',
    'bad-param': 'This cannot be searched. Session links are not searchable; paste the course link or search the course name.',
    'not-found': 'Not found.',
  },
  termLabel: (year, n) => `${year} ${['', 'Fall', 'Spring', 'Summer'][n] ?? `Term ${n}`}`,
  termShort: (year, n) => `${year.slice(2, 4)}–${year.slice(7, 9)} ${['', 'Fall', 'Spring', 'Summer'][n] ?? n}`,
  title: (q) => `${q} - Index Search`,
  homeTitle: 'Index · Yanhekt course index',
};

export type Strings = typeof zh;

export function useT(): Strings {
  return useLang() === 'zh' ? zh : en;
}

/** `2026-2027-1` → "2026-2027 学年 第一学期" / "2026-2027 Fall". */
export function termLabel(t: Strings, key: string | null, short = false): string {
  const m = key ? /^(\d{4}-\d{4})-(\d)$/.exec(key) : null;
  if (!m) return key ?? '—';
  return short ? t.termShort(m[1], Number(m[2])) : t.termLabel(m[1], Number(m[2]));
}

export function useNumber(): (n: number) => string {
  const l = useLang();
  return (n) => n.toLocaleString(l === 'zh' ? 'zh-CN' : 'en-US');
}
