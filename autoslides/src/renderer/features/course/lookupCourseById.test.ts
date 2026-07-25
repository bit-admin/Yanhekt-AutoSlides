import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { CourseData, CourseListResponse } from '@shared/services/apiClient'
import {
  needsListHydration,
  pickCourseFromList,
  lookupCourseById,
  __resetLookupInflightForTests,
} from './lookupCourseById'

const sampleRow = (id: string | number, rooms: string[] = ['理教101']): CourseData => ({
  id: String(id),
  name_zh: '泛函分析',
  professors: ['张三'],
  classrooms: rooms.map((name) => ({ name })),
  school_year: '2025-2026',
  semester: '1',
  college_name: '数学学院',
  participant_count: 42,
})

const listResponse = (rows: CourseData[]): CourseListResponse => ({
  data: rows,
  current_page: 1,
  last_page: 1,
  per_page: 16,
  total: rows.length,
})

describe('needsListHydration', () => {
  it('is true when the course is missing or has no classrooms', () => {
    expect(needsListHydration(null)).toBe(true)
    expect(needsListHydration(undefined)).toBe(true)
    expect(needsListHydration({})).toBe(true)
    expect(needsListHydration({ classrooms: [] })).toBe(true)
    expect(needsListHydration({ classrooms: null })).toBe(true)
  })

  it('is false once at least one classroom is present', () => {
    expect(needsListHydration({ classrooms: [{ name: '理教101' }] })).toBe(false)
  })
})

describe('pickCourseFromList', () => {
  it('returns the transformed course only on an exact id match', () => {
    const rows = [sampleRow(1001), sampleRow(2002, ['综教201'])]
    const hit = pickCourseFromList('2002', rows)
    expect(hit?.id).toBe('2002')
    expect(hit?.classrooms).toEqual([{ name: '综教201' }])
    expect(hit?.participant_count).toBe(42)
    expect(hit?.title).toBe('泛函分析')
  })

  it('string-compares numeric ids from the API', () => {
    // Runtime JSON often delivers numeric ids even though the type says string.
    const rows = [{ ...sampleRow(71736), id: 71736 as unknown as string }]
    expect(pickCourseFromList('71736', rows)?.id).toBe('71736')
  })

  it('returns null when nothing matches (never takes the first fuzzy hit)', () => {
    expect(pickCourseFromList('999', [sampleRow(1001)])).toBeNull()
    expect(pickCourseFromList('1001', [])).toBeNull()
    expect(pickCourseFromList('1001', null)).toBeNull()
  })
})

describe('lookupCourseById', () => {
  beforeEach(() => {
    __resetLookupInflightForTests()
  })

  it('calls getCourseList with the id as keyword and all-semesters (empty array)', async () => {
    const fetchList = vi.fn(async () => listResponse([sampleRow('12345')]))
    const course = await lookupCourseById('tok', '12345', fetchList)
    expect(fetchList).toHaveBeenCalledWith('tok', {
      keyword: '12345',
      semesters: [],
      page: 1,
      pageSize: 16,
    })
    expect(course?.classrooms).toEqual([{ name: '理教101' }])
  })

  it('returns null when the list has no exact id match', async () => {
    const fetchList = vi.fn(async () => listResponse([sampleRow('other')]))
    expect(await lookupCourseById('tok', '12345', fetchList)).toBeNull()
  })

  it('soft-fails to null on fetch errors', async () => {
    const fetchList = vi.fn(async () => {
      throw new Error('network')
    })
    expect(await lookupCourseById('tok', '12345', fetchList)).toBeNull()
  })

  it('returns null for empty token or id without calling the API', async () => {
    const fetchList = vi.fn(async () => listResponse([sampleRow('1')]))
    expect(await lookupCourseById('', '1', fetchList)).toBeNull()
    expect(await lookupCourseById('tok', '', fetchList)).toBeNull()
    expect(await lookupCourseById('tok', null, fetchList)).toBeNull()
    expect(fetchList).not.toHaveBeenCalled()
  })

  it('dedupes concurrent lookups for the same id', async () => {
    let resolve!: (value: CourseListResponse) => void
    const fetchList = vi.fn(
      () =>
        new Promise<CourseListResponse>((r) => {
          resolve = r
        }),
    )

    const a = lookupCourseById('tok', '55', fetchList)
    const b = lookupCourseById('tok', '55', fetchList)
    expect(fetchList).toHaveBeenCalledTimes(1)

    resolve(listResponse([sampleRow('55')]))
    const [ca, cb] = await Promise.all([a, b])
    expect(ca?.id).toBe('55')
    expect(cb?.id).toBe('55')
  })
})
