import { describe, it, expect, afterEach } from "vitest";
import { setLocale } from "./index";
import {
  courseDisplayTitle,
  academicTermLabel,
  usableEnglishTitle,
  courseTitleSizeClass,
} from "./displayNames";

afterEach(() => setLocale('en'))

describe('courseDisplayTitle', () => {
  const course = { title: '泛函分析', titleEn: 'Functional Analysis' }

  it('prefers the English name in English', () => {
    setLocale('en')
    expect(courseDisplayTitle(course)).toBe('Functional Analysis')
  })

  it("keeps the Chinese name in zh", () => {
    setLocale("zh");
    expect(courseDisplayTitle(course)).toBe("泛函分析");
  })

  it('falls back to Chinese when the API had no English name', () => {
    setLocale('en')
    expect(courseDisplayTitle({ title: '文献检索' })).toBe('文献检索')
    expect(courseDisplayTitle({ title: '文献检索', titleEn: '   ' })).toBe('文献检索')
  })

  it('is empty for a missing course', () => {
    expect(courseDisplayTitle(null)).toBe('')
    expect(courseDisplayTitle(undefined)).toBe('')
  })

  it('falls back to Chinese when name_en is the 待完善 placeholder', () => {
    setLocale('en')
    expect(courseDisplayTitle({ title: '文献检索', titleEn: '待完善' })).toBe('文献检索')
  })

  it('decodes HTML entities in name_en', () => {
    setLocale('en')
    expect(courseDisplayTitle({
      title: 'ROS系统开发与实践（英文）',
      titleEn: 'Development &#97;nd Practice of ROS System',
    })).toBe('Development and Practice of ROS System')
  })
})

describe('usableEnglishTitle', () => {
  it('rejects placeholders and Chinese names', () => {
    // Real Yanhekt data: the literal "to be completed" placeholder.
    expect(usableEnglishTitle('待完善')).toBeUndefined()
    // name_en sometimes just repeats name_zh.
    expect(usableEnglishTitle('文献检索')).toBeUndefined()
    // Mixed strings are still not English.
    expect(usableEnglishTitle('C++程序设计')).toBeUndefined()
    // Even when the placeholder arrives HTML-escaped (decode runs first).
    expect(usableEnglishTitle('&#24453;&#23436;&#21892;')).toBeUndefined()
  })

  it('accepts real English titles, trimmed', () => {
    expect(usableEnglishTitle('  Functional Analysis  ')).toBe('Functional Analysis')
    expect(usableEnglishTitle('C++ Programming Language')).toBe('C++ Programming Language')
  })

  it('keeps full-width punctuation, which is not an ideograph', () => {
    expect(usableEnglishTitle('Literature Retrieval（English）')).toBe('Literature Retrieval（English）')
  })

  it('decodes numeric, hex and named entities', () => {
    expect(usableEnglishTitle('Development &#97;nd Practice')).toBe('Development and Practice')
    expect(usableEnglishTitle('A &#x26; B')).toBe('A & B')
    expect(usableEnglishTitle('Signals &amp; Systems')).toBe('Signals & Systems')
  })

  it('leaves malformed or unknown entities alone', () => {
    expect(usableEnglishTitle('Rock &roll; Music')).toBe('Rock &roll; Music')
    expect(usableEnglishTitle('100 &#; off')).toBe('100 &#; off')
    expect(usableEnglishTitle('Surrogate &#55296; guard')).toBe('Surrogate &#55296; guard')
  })

  it('is undefined for empty input', () => {
    expect(usableEnglishTitle(undefined)).toBeUndefined()
    expect(usableEnglishTitle(null)).toBeUndefined()
    expect(usableEnglishTitle('   ')).toBeUndefined()
  })
})

describe('academicTermLabel', () => {
  it("translates the season and keeps the school-year range", () => {
    setLocale("en")
    expect(academicTermLabel('2026-2027', '1')).toBe('2026-2027 Fall')
    expect(academicTermLabel('2026-2027', '2')).toBe('2026-2027 Spring')
    setLocale("zh")
    expect(academicTermLabel('2026-2027', '1')).toBe('2026-2027 秋季学期')
    expect(academicTermLabel('2026-2027', '2')).toBe('2026-2027 春季学期')
  })

  it('accepts semester as a number (/v1/course) or a string (course list)', () => {
    setLocale('en')
    expect(academicTermLabel('2025-2026', 1)).toBe('2025-2026 Fall')
    expect(academicTermLabel('2025-2026', '2')).toBe('2025-2026 Spring')
  })

  it('returns the fallback when there is no usable term', () => {
    setLocale('zh')
    // Live broadcasts carry a clock range and no term fields.
    expect(academicTermLabel(undefined, undefined, '09:55 - 11:30')).toBe('09:55 - 11:30')
    expect(academicTermLabel('2025-2026', null, 'x')).toBe('x')
    expect(academicTermLabel('2025-2026', 3, 'x')).toBe('x')
    expect(academicTermLabel('', '1', 'x')).toBe('x')
    expect(academicTermLabel(undefined, undefined)).toBe('')
  })
})

describe('courseTitleSizeClass', () => {
  it('leaves Chinese titles at the default size', () => {
    // Real names from the Recorded grid — the width the cards were designed for.
    expect(courseTitleSizeClass('人工智能技术课程设计')).toBe('')
    expect(courseTitleSizeClass('文献检索（全英文）')).toBe('')
    expect(courseTitleSizeClass('ROS系统开发与实践（英文）')).toBe('')
  })

  it('leaves short English titles alone', () => {
    expect(courseTitleSizeClass('Academic Writing')).toBe('')
    expect(courseTitleSizeClass('Basic German Practice')).toBe('')
    expect(courseTitleSizeClass('Advances of Life Science')).toBe('')
  })

  it('steps down the long English titles that were truncating', () => {
    expect(courseTitleSizeClass('Humanistic Investigation and Nature Drawing')).toBe('is-long')
    expect(courseTitleSizeClass('Foundations of Autonomous Mobile Robots')).toBe('')
  })

  it('steps down twice for the longest titles', () => {
    expect(courseTitleSizeClass(
      '（Research Methods and Writing of Financial Management Thesis）',
    )).toBe('is-longer')
  })

  it('counts CJK as double width', () => {
    // 21 Chinese characters = 42 units, past the first threshold.
    expect(courseTitleSizeClass('一'.repeat(21))).toBe('is-long')
    expect(courseTitleSizeClass('一'.repeat(20))).toBe('')
  })

  it('ignores surrounding whitespace', () => {
    expect(courseTitleSizeClass('   Academic Writing   ')).toBe('')
    expect(courseTitleSizeClass('')).toBe('')
  })
})
