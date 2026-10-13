/**
 * Finding the same course on the other site: a Yanhe 2.0 course on Yanhekt,
 * or a Yanhekt course on Yanhe 2.0. The two number courses separately; what
 * they share is the registrar's course number (Yanhekt `number`, Yanhe 2.0
 * `kcwybm`). Main does the lookup; the renderer sends one course id.
 */
import type { CourseData } from './apiTypes';
import type { Yanhe2Course } from './yanhe2Curriculum';

/** The course id on the site the request starts from. */
export interface Yanhe2CourseTwinQuery {
  courseId: string;
}

export type Yanhe2CourseTwinMiss =
  /** No live Yanhe 2.0 session for that account. */
  | 'signed_out'
  /** Not signed in to Yanhekt. */
  | 'yanhekt_signed_out'
  /** The other site has no course with that number. */
  | 'no_match'
  | 'network'
  | 'failed';

export type YanhektCourseTwinResult = { kind: 'ok'; data: CourseData } | { kind: Yanhe2CourseTwinMiss };
export type Yanhe2CourseTwinResult = { kind: 'ok'; data: Yanhe2Course } | { kind: Yanhe2CourseTwinMiss };
