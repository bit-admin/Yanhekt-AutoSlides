import { describe, expect, it } from 'vitest'
import type { CourseInfoResponse } from '@common/apiTypes'
import { courseForSession } from './courseForSession'
import type { Course } from './useCourseList'

// Fabricated values only.
const base = { id: '12', title: '示例课程', school_year: '2024', semester: 2 }

const info: CourseInfoResponse = {
  course_id: '12',
  title: '示例课程',
  title_en: 'Sample Course',
  professor: '张三',
  professors: ['张三'],
  college_name: '示例学院',
  school_year: '2025',
  semester: 1,
  videos: [],
}

const list: Course = {
  id: '12',
  title: '示例课程',
  instructor: '张三, 李四',
  time: '2025 Fall',
  classrooms: [{ name: '示例楼 101' }] as Course['classrooms'],
  participant_count: 30,
  semester: '1',
  school_year: '2025',
}

describe('courseForSession', () => {
  it('takes teachers and term from the course detail and classrooms from the list', () => {
    expect(courseForSession(base, info, list)).toMatchObject({
      id: '12',
      title: '示例课程',
      titleEn: 'Sample Course',
      instructor: '张三',
      time: '2025 Fall',
      school_year: '2025',
      semester: '1',
      classrooms: [{ name: '示例楼 101' }],
      participant_count: 30,
    })
  })

  it("falls back to the session's nested course when both lookups fail", () => {
    expect(courseForSession(base, null, null)).toMatchObject({
      id: '12',
      title: '示例课程',
      instructor: '',
      time: '2024 Spring',
      semester: '2',
    })
  })
})
