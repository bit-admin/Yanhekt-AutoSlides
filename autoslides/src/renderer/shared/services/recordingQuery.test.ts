import { describe, expect, it } from 'vitest'
import type { CourseInfoResponse, SessionData } from './apiClient'
import {
  formatRecordingSessionLabel,
  matchRecordingQuery,
  parseRecordingQuery
} from './recordingQuery'

const session = (overrides: Partial<SessionData>): SessionData => ({
  id: overrides.id ?? 'session-id',
  session_id: overrides.session_id ?? overrides.id ?? 'session-id',
  video_id: overrides.video_id ?? 'video-id',
  title: overrides.title ?? '第2大节',
  duration: overrides.duration ?? 3600,
  week_number: overrides.week_number ?? 15,
  day: overrides.day ?? 3,
  started_at: overrides.started_at ?? '2026-06-17T08:00:00+08:00',
  ended_at: overrides.ended_at ?? '2026-06-17T09:40:00+08:00',
  main_url: overrides.main_url,
  vga_url: overrides.vga_url
})

const courses: CourseInfoResponse[] = [
  {
    course_id: 'communication',
    title: '沟通与职业素养',
    professor: '张老师',
    videos: [
      session({
        id: 'communication-week-15',
        title: '第2大节 沟通场景训练',
        main_url: 'https://example.test/camera.m3u8',
        vga_url: 'https://example.test/screen.m3u8'
      }),
      session({
        id: 'communication-week-16',
        title: '第2大节 面试表达',
        week_number: 16,
        main_url: 'https://example.test/camera-16.m3u8',
        vga_url: 'https://example.test/screen-16.m3u8'
      })
    ]
  },
  {
    course_id: 'database',
    title: '数据库系统',
    professor: '李老师',
    videos: [
      session({
        id: 'database-week-15',
        title: '第2大节 查询优化',
        main_url: 'https://example.test/db-camera.m3u8',
        vga_url: 'https://example.test/db-screen.m3u8'
      }),
      session({
        id: 'database-week-15-camera-only',
        title: '第3大节 事务处理',
        main_url: 'https://example.test/db-camera-only.m3u8',
        vga_url: undefined
      })
    ]
  }
]

describe('parseRecordingQuery', () => {
  it('parses a Chinese course recording request', () => {
    expect(parseRecordingQuery('下载 沟通与职业素养 第15周星期三 屏幕录制')).toMatchObject({
      courseKeyword: '沟通与职业素养',
      weekNumber: 15,
      day: 3,
      videoType: 'screen'
    })
  })

  it('parses Chinese numerals and section numbers', () => {
    expect(parseRecordingQuery('数据库 第十五周 周三 第二大节 摄像头')).toMatchObject({
      courseKeyword: '数据库',
      weekNumber: 15,
      day: 3,
      sectionNumber: 2,
      videoType: 'camera'
    })
  })

  it('drops generic action words from the course keyword', () => {
    expect(parseRecordingQuery('帮我生成 沟通 录播视频 复习笔记 第15周 周三').courseKeyword).toBe('沟通')
  })
})

describe('matchRecordingQuery', () => {
  it('finds a unique course session and requested stream type', () => {
    const result = matchRecordingQuery('沟通 第15周 周三 屏幕录制', courses)

    expect(result.isAmbiguous).toBe(false)
    expect(result.bestMatch?.course.course_id).toBe('communication')
    expect(result.bestMatch?.session.id).toBe('communication-week-15')
    expect(result.bestMatch?.videoType).toBe('screen')
    expect(result.bestMatch?.reasons).toContain('screen-url-available')
  })

  it('uses week, day, and section filters together', () => {
    const result = matchRecordingQuery('数据库 第15周 星期三 第3大节 摄像头', courses)

    expect(result.bestMatch?.session.id).toBe('database-week-15-camera-only')
    expect(result.bestMatch?.videoType).toBe('camera')
  })

  it('does not match unavailable stream URLs', () => {
    const result = matchRecordingQuery('数据库 第15周 星期三 第3大节 屏幕录制', courses)

    expect(result.matches).toEqual([])
    expect(result.bestMatch).toBeUndefined()
  })

  it('marks equally scored top matches as ambiguous', () => {
    const result = matchRecordingQuery('第15周 星期三 屏幕录制', courses)

    expect(result.isAmbiguous).toBe(true)
    expect(result.bestMatch).toBeUndefined()
    expect(result.matches.map(match => match.session.id)).toEqual([
      'communication-week-15',
      'database-week-15'
    ])
  })
})

describe('formatRecordingSessionLabel', () => {
  it('formats week and weekday consistently with course folders', () => {
    expect(formatRecordingSessionLabel(courses[0].videos[0])).toBe('第15周 星期三 第2大节 沟通场景训练')
  })
})
