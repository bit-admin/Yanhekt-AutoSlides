import type { SessionData } from './apiClient'

/** The course facts a queued session carries: what task tabs and metadata.json need. */
export interface SessionCourseInfo {
  id: string
  /** Canonical Chinese title — the one that becomes folder and file names. */
  title: string
  /** English course name for display; lets a task tab's header localize. */
  titleEn?: string
  instructor: string
  time: string
  /** Registrar course number (Yanhe 2.0 `kcwybm`); metadata.json keeps it. */
  number?: string
  classrooms?: { name: string }[]
  college_name?: string
  participant_count?: number
  professors?: string[]
  school_year?: string
  semester?: string
}

/**
 * A recorded session as it was when it was queued, carried on the download or
 * task that needs it. Plain data: built through a JSON copy, so it holds no Vue
 * proxy and later edits to the session list do not reach it.
 */
export interface SessionSnapshot {
  session: SessionData
  course?: SessionCourseInfo
}

/** Pick the course fields a snapshot keeps. Takes a `Course` as is. */
export function courseInfoOf(course: SessionCourseInfo): SessionCourseInfo {
  return {
    id: course.id,
    title: course.title,
    titleEn: course.titleEn,
    instructor: course.instructor,
    time: course.time,
    number: course.number,
    classrooms: course.classrooms,
    college_name: course.college_name,
    participant_count: course.participant_count,
    professors: course.professors,
    school_year: course.school_year,
    semester: course.semester,
  }
}

export function snapshotSession(session: SessionData, course?: SessionCourseInfo | null): SessionSnapshot {
  return JSON.parse(JSON.stringify({
    session,
    ...(course ? { course: courseInfoOf(course) } : {}),
  })) as SessionSnapshot
}
