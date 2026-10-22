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
  placeholder: '课程名、教师、课程 ID、课程号或课程链接',
  searchButton: '索引搜索',
  luckyButton: '手气不错',
  searchIn: '搜索范围',
  clear: '清除',
  search: '搜索',
  footerUpdated: (when: string) => `索引更新于 ${when}`,
  footerTotals: (terms: number) => `${terms} 个学期`,
  footerAbout: '仅收录延河课堂公开可见的课程；时间、标题与录像请在延河课堂或 AutoSlides Web 查看。',
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
  suggestId: '粘贴课程链接、课程 ID 或课程号（如 kcwybm），不需要选学期。',
  suggestCoverage: '索引还在补全往年的课程，较早的学期可能暂缺。',
  termNotIndexed: (term: string) => `索引中还没有 ${term} 的课程。`,
  indexedTerms: '已收录的学期：',
  matchId: '课程 ID 匹配',
  matchNumber: '课程号匹配',
  teachers: '教师',
  colon: '：',
  noTeachers: '教师未知',
  sessions: (n: number) => `${n} 个课次`,
  number: '课程号',
  courseId: '课程 ID',
  term: '学期',
  sessionsLabel: '课次',
  viewSessions: '查看课次 ID',
  openOnYanhekt: '在延河课堂打开',
  openOnWeb: '在 AutoSlides Web 打开',
  copy: '复制',
  copied: '已复制',
  copyAllSessions: '复制全部课次 ID',
  previous: '上一页',
  next: '下一页',
  sessionsHeading: '课次',
  sessionsNote: '按课次 ID 升序。上课时间、标题与录像不在索引中，请在延河课堂或 AutoSlides Web 打开查看。',
  sessionNo: (n: number) => `第 ${n} 个`,
  sessionId: '课次 ID',
  noSessions: '索引中还没有这门课的课次。',
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
    'bad-param': '无法搜索这个内容。课次链接不能搜索，请粘贴课程链接或搜索课程名。',
    'not-found': '没有找到。',
  } as Record<string, string>,
  termLabel: (year: string, n: number) => `${year} 学年 ${['', '第一学期', '第二学期', '第三学期'][n] ?? `第 ${n} 学期`}`,
  termShort: (year: string, n: number) => `${year.slice(2, 4)}-${year.slice(7, 9)} ${['', '秋', '春', '夏'][n] ?? n}`,
  title: (q: string) => `${q} - Index 搜索`,
  homeTitle: 'Index · 延河课堂课程索引',
};

const en: typeof zh = {
  brandSub: 'AutoSlides',
  placeholder: 'Course name, teacher, course id, registrar code or link',
  searchButton: 'Index Search',
  luckyButton: "I'm Feeling Lucky",
  searchIn: 'Search in',
  clear: 'Clear',
  search: 'Search',
  footerUpdated: (when) => `Index updated ${when}`,
  footerTotals: (terms) => `${terms} terms`,
  footerAbout: 'Lists Yanhekt courses that are publicly visible; open Yanhekt or AutoSlides Web for times, titles and recordings.',
  api: 'API',
  identifierTab: 'By id',
  stats: (n, secs) => `About ${n} courses (${secs} seconds)`,
  statsTop: (shown) => `, showing the best ${shown}`,
  statsTruncated: '. Too many matches: only the newest 5,000 were compared; try a more specific word',
  noResults: (q, term) => `Your search - ${q} - did not match any courses in ${term}.`,
  noResultsId: (q) => `No course with the id or code "${q}" is in the index.`,
  suggestions: 'Suggestions:',
  suggestOtherTerm: 'Try another term: ',
  suggestShorter: 'Try fewer or more common words, such as part of the course name or a teacher’s name.',
  suggestId: 'Paste a course link, course id or registrar code (kcwybm); no term needed.',
  suggestCoverage: 'Earlier terms are still being filled in and may be incomplete.',
  termNotIndexed: (term) => `${term} is not in the index yet.`,
  indexedTerms: 'Terms in the index: ',
  matchId: 'Course id match',
  matchNumber: 'Registrar code match',
  teachers: 'Teachers',
  colon: ': ',
  noTeachers: 'Teacher unknown',
  sessions: (n) => `${n} ${n === 1 ? 'session' : 'sessions'}`,
  number: 'Registrar code',
  courseId: 'Course id',
  term: 'Term',
  sessionsLabel: 'Sessions',
  viewSessions: 'Session ids',
  openOnYanhekt: 'Open on Yanhekt',
  openOnWeb: 'Open in AutoSlides Web',
  copy: 'Copy',
  copied: 'Copied',
  copyAllSessions: 'Copy All Session Ids',
  previous: 'Previous',
  next: 'Next',
  sessionsHeading: 'Sessions',
  sessionsNote: 'By session id, ascending. Times, titles and recordings are not in the index; open a session on Yanhekt or in AutoSlides Web to see them.',
  sessionNo: (n) => `#${n}`,
  sessionId: 'Session id',
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
