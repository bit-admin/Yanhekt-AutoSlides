// Opening a pin from the sidebar or Home. A pin Yanhekt has opens its Recorded
// sessions page; a pin only Yanhe 2.0 has (a lab or practice course without
// recordings) opens its Curriculum page. Lives beside the pages because it
// imports both course domains, like `components/yanhe2/openCourseTwin.ts`.
import { yanhektIdOf } from '@common/pins'
import type { PinnedCourse } from '@common/types'
import { navigationStore } from '@features/course/navigationStore'
import { openPinnedCourse } from '@features/course/pinnedCourses'
import { requestYanhe2CourseOpen } from '@features/yanhe2/useYanhe2Curriculum'

export function openPin(pin: PinnedCourse): void {
  if (yanhektIdOf(pin) || !pin.yanhe2Id) {
    openPinnedCourse(pin)
    return
  }
  requestYanhe2CourseOpen({
    courseId: pin.yanhe2Id,
    title: pin.title,
    teacher: pin.instructor ?? '',
    college: pin.college_name ?? '',
    term: pin.school_year && pin.semester ? `${pin.school_year}-${pin.semester}` : '',
    schoolYear: pin.school_year ?? '',
    semester: pin.semester ?? '',
    courseCode: pin.number ?? '',
  })
  navigationStore.navigate('yanhe2-curriculum')
  navigationStore.setActivePinned(pin.id)
}

/** Whether a pin opens on Yanhe 2.0 (no Yanhekt course). */
export const isYanhe2OnlyPin = (pin: PinnedCourse): boolean => !yanhektIdOf(pin) && !!pin.yanhe2Id
