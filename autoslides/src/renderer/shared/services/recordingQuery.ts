import type { CourseInfoResponse, SessionData } from './apiClient'

export type RecordingVideoType = 'camera' | 'screen'

export interface ParsedRecordingQuery {
  raw: string
  normalized: string
  courseKeyword: string
  weekNumber?: number
  day?: number
  sectionNumber?: number
  videoType?: RecordingVideoType
}

export interface RecordingSessionMatch {
  course: CourseInfoResponse
  session: SessionData
  score: number
  reasons: string[]
  videoType?: RecordingVideoType
}

export interface RecordingSessionMatchResult {
  query: ParsedRecordingQuery
  matches: RecordingSessionMatch[]
  bestMatch?: RecordingSessionMatch
  isAmbiguous: boolean
}

const NUMBER_PATTERN = String.raw`\d{1,3}|[零〇一二两三四五六七八九十]{1,4}`
const WEEK_PATTERN = new RegExp(String.raw`(?:第\s*)?(${NUMBER_PATTERN})\s*(?:周|週)`, 'i')
const ENGLISH_WEEK_PATTERN = /\bweek\s*(\d{1,3})\b/i
const SECTION_PATTERN = new RegExp(String.raw`(?:第\s*)?(${NUMBER_PATTERN})\s*(?:大节|小节|节|讲|lecture)`, 'i')
const CHINESE_DAY_PATTERN = /(?:星期|周|週|礼拜)\s*([一二三四五六日天1-7])/i
const ENGLISH_DAY_PATTERN = /\b(mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/i
const SCREEN_PATTERN = /(?:屏幕录制|屏幕|屏录|课件|ppt|vga|screen|slides?)/i
const CAMERA_PATTERN = /(?:摄像头|摄像|教师|老师|教室|主画面|主摄|camera|cam|main)/i
const GENERIC_QUERY_WORDS = /(?:帮我|我要|想要|下载|找到?|查找|录播|视频|课程|课堂|回放|生成|详细|复习|笔记|字幕|转写|转录|asr|一下|哪个|那个|的)/gi

const CHINESE_DIGITS: Record<string, number> = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9
}

const WEEKDAY_NUMBER: Record<string, number> = {
  一: 1,
  '1': 1,
  二: 2,
  '2': 2,
  三: 3,
  '3': 3,
  四: 4,
  '4': 4,
  五: 5,
  '5': 5,
  六: 6,
  '6': 6,
  日: 7,
  天: 7,
  '7': 7
}

const ENGLISH_WEEKDAY_NUMBER: Record<string, number> = {
  mon: 1,
  monday: 1,
  tue: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
  sun: 7,
  sunday: 7
}

export function parseRecordingQuery(input: string): ParsedRecordingQuery {
  const normalized = normalizeText(input)
  const weekNumber = firstParsedNumber(normalized.match(WEEK_PATTERN)?.[1] ?? normalized.match(ENGLISH_WEEK_PATTERN)?.[1])
  const day = parseDay(normalized)
  const sectionNumber = firstParsedNumber(normalized.match(SECTION_PATTERN)?.[1])
  const videoType = parseVideoType(normalized)
  const courseKeyword = extractCourseKeyword(normalized)

  return {
    raw: input,
    normalized,
    courseKeyword,
    weekNumber,
    day,
    sectionNumber,
    videoType
  }
}

export function matchRecordingQuery(
  input: string | ParsedRecordingQuery,
  courses: CourseInfoResponse[]
): RecordingSessionMatchResult {
  const query = typeof input === 'string' ? parseRecordingQuery(input) : input
  const matches: RecordingSessionMatch[] = []

  for (const course of courses) {
    const courseMatch = scoreCourse(course, query.courseKeyword)
    if (query.courseKeyword && !courseMatch) {
      continue
    }

    for (const session of course.videos) {
      const sessionMatch = scoreSession(session, query)
      if (!sessionMatch) {
        continue
      }

      matches.push({
        course,
        session,
        score: (courseMatch?.score ?? 0) + sessionMatch.score,
        reasons: [...(courseMatch?.reasons ?? []), ...sessionMatch.reasons],
        videoType: query.videoType
      })
    }
  }

  matches.sort(compareMatches)

  const bestMatch = findBestMatch(matches)
  return {
    query,
    matches,
    bestMatch,
    isAmbiguous: matches.length > 1 && matches[0].score === matches[1].score
  }
}

export function formatRecordingSessionLabel(session: SessionData): string {
  const weekday = formatWeekday(session.day)
  return `第${session.week_number}周 ${weekday} ${session.title}`.trim()
}

function normalizeText(input: string): string {
  return input
    .normalize('NFKC')
    .replace(/[，。！？、；：,.!?;:()[\]{}"'`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeComparable(input: string): string {
  return normalizeText(input)
    .toLocaleLowerCase()
    .replace(/[\s_\-—/\\]+/g, '')
}

function firstParsedNumber(value?: string): number | undefined {
  if (!value) return undefined
  return parseNaturalNumber(value)
}

function parseNaturalNumber(value: string): number | undefined {
  const trimmed = value.trim()
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10)
  }

  if (trimmed === '十') return 10
  const tenIndex = trimmed.indexOf('十')
  if (tenIndex !== -1) {
    const tensText = trimmed.slice(0, tenIndex)
    const onesText = trimmed.slice(tenIndex + 1)
    const tens = tensText ? CHINESE_DIGITS[tensText] : 1
    const ones = onesText ? CHINESE_DIGITS[onesText] : 0
    if (tens === undefined || ones === undefined) return undefined
    return tens * 10 + ones
  }

  if (trimmed.length === 1) {
    return CHINESE_DIGITS[trimmed]
  }

  return undefined
}

function parseDay(input: string): number | undefined {
  const chineseDay = input.match(CHINESE_DAY_PATTERN)?.[1]
  if (chineseDay) {
    return WEEKDAY_NUMBER[chineseDay]
  }

  const englishDay = input.match(ENGLISH_DAY_PATTERN)?.[1]?.toLocaleLowerCase()
  if (englishDay) {
    return ENGLISH_WEEKDAY_NUMBER[englishDay]
  }

  return undefined
}

function parseVideoType(input: string): RecordingVideoType | undefined {
  const screenMatch = input.match(SCREEN_PATTERN)
  const cameraMatch = input.match(CAMERA_PATTERN)
  if (!screenMatch && !cameraMatch) return undefined
  if (screenMatch && !cameraMatch) return 'screen'
  if (!screenMatch && cameraMatch) return 'camera'
  return (screenMatch!.index ?? 0) <= (cameraMatch!.index ?? 0) ? 'screen' : 'camera'
}

function extractCourseKeyword(input: string): string {
  return input
    .replace(WEEK_PATTERN, ' ')
    .replace(ENGLISH_WEEK_PATTERN, ' ')
    .replace(SECTION_PATTERN, ' ')
    .replace(CHINESE_DAY_PATTERN, ' ')
    .replace(ENGLISH_DAY_PATTERN, ' ')
    .replace(SCREEN_PATTERN, ' ')
    .replace(CAMERA_PATTERN, ' ')
    .replace(GENERIC_QUERY_WORDS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function scoreCourse(
  course: CourseInfoResponse,
  courseKeyword: string
): { score: number; reasons: string[] } | null {
  if (!courseKeyword) {
    return { score: 0, reasons: [] }
  }

  const normalizedTitle = normalizeComparable(course.title)
  const normalizedProfessor = normalizeComparable(course.professor)
  const normalizedKeyword = normalizeComparable(courseKeyword)

  if (!normalizedKeyword) {
    return { score: 0, reasons: [] }
  }

  if (normalizedTitle.includes(normalizedKeyword)) {
    return { score: 80, reasons: ['course-title-contains-keyword'] }
  }

  if (normalizedKeyword.includes(normalizedTitle)) {
    return { score: 70, reasons: ['keyword-contains-course-title'] }
  }

  const tokens = tokenizeKeyword(courseKeyword)
  let score = 0
  const reasons: string[] = []
  for (const token of tokens) {
    const normalizedToken = normalizeComparable(token)
    if (!normalizedToken) continue

    if (normalizedTitle.includes(normalizedToken)) {
      score += 20
      reasons.push('course-title-token-match')
    } else if (normalizedProfessor.includes(normalizedToken)) {
      score += 10
      reasons.push('course-professor-token-match')
    }
  }

  return score > 0 ? { score, reasons } : null
}

function tokenizeKeyword(keyword: string): string[] {
  const splitTokens = keyword.split(/\s+/).filter(Boolean)
  return splitTokens.length > 0 ? splitTokens : [keyword]
}

function scoreSession(
  session: SessionData,
  query: ParsedRecordingQuery
): { score: number; reasons: string[] } | null {
  let score = 0
  const reasons: string[] = []

  if (query.weekNumber !== undefined) {
    if (session.week_number !== query.weekNumber) return null
    score += 40
    reasons.push('week-match')
  }

  if (query.day !== undefined) {
    if (session.day !== query.day) return null
    score += 25
    reasons.push('day-match')
  }

  if (query.sectionNumber !== undefined) {
    const sessionSection = parseSessionSection(session.title)
    if (sessionSection !== query.sectionNumber) return null
    score += 15
    reasons.push('section-match')
  }

  if (query.videoType === 'screen') {
    if (!session.vga_url) return null
    score += 10
    reasons.push('screen-url-available')
  } else if (query.videoType === 'camera') {
    if (!session.main_url) return null
    score += 10
    reasons.push('camera-url-available')
  }

  if (!query.courseKeyword && score === 0) {
    score += 1
  }

  return { score, reasons }
}

function parseSessionSection(title: string): number | undefined {
  return firstParsedNumber(title.match(SECTION_PATTERN)?.[1])
}

function compareMatches(a: RecordingSessionMatch, b: RecordingSessionMatch): number {
  if (a.score !== b.score) return b.score - a.score
  const courseCompare = a.course.title.localeCompare(b.course.title, 'zh')
  if (courseCompare !== 0) return courseCompare
  if (a.session.week_number !== b.session.week_number) return a.session.week_number - b.session.week_number
  if (a.session.day !== b.session.day) return a.session.day - b.session.day
  return a.session.title.localeCompare(b.session.title, 'zh')
}

function findBestMatch(matches: RecordingSessionMatch[]): RecordingSessionMatch | undefined {
  if (matches.length === 0) return undefined
  if (matches.length === 1) return matches[0]
  return matches[0].score > matches[1].score ? matches[0] : undefined
}

function formatWeekday(day: number): string {
  const label = ['一', '二', '三', '四', '五', '六', '日'][day - 1]
  return label ? `星期${label}` : `星期${day}`
}
