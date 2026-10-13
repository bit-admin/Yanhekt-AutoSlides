// "Find this course on the other site", from either sessions page. Main does
// the lookup by the registrar's course number both sites keep; this opens the
// answer, or says why there is none in a message box.
//
// It lives beside the pages because it touches both course domains, which do
// not import each other.
import type { Yanhe2CourseTwinMiss } from '@common/yanhe2CourseTwin'
import { openCourse } from '@features/course/courseSelection'
import { navigationStore } from '@features/course/navigationStore'
import { transformCourseDataToCourse } from '@features/course/useCourseList'
import { requestYanhe2CourseOpen } from '@features/yanhe2/useYanhe2Curriculum'
import { i18n } from '@shared/i18n'
import { createLogger } from '@shared/utils/logger'

const log = createLogger('CourseTwin')

type Site = 'yanhekt' | 'yanhe2'

function explain(miss: Yanhe2CourseTwinMiss, target: Site): void {
  const t = i18n.global.t
  const message =
    miss === 'no_match'
      ? t(target === 'yanhe2' ? 'courseTwin.notOnYanhe2' : 'courseTwin.notOnYanhekt')
      : miss === 'signed_out'
        ? t('courseTwin.yanhe2SignedOut')
        : miss === 'yanhekt_signed_out'
          ? t('courseTwin.yanhektSignedOut')
          : miss === 'network'
            ? t('courseTwin.network')
            : t('courseTwin.failed')
  void window.electronAPI.dialog?.showMessageBox?.({ type: 'info', message })
}

/** A Yanhe 2.0 course (its aita id) → the same course's sessions on Recorded. */
export async function openYanhektTwin(account: string, courseId: string): Promise<void> {
  try {
    const found = await window.electronAPI.yanhe2.findYanhektCourse(account, { courseId: String(courseId) })
    if (found.kind !== 'ok') return explain(found.kind, 'yanhekt')
    openCourse('recorded', transformCourseDataToCourse(found.data))
  } catch (error) {
    log.warn('Yanhekt course lookup failed:', error)
    explain('failed', 'yanhekt')
  }
}

/** A Yanhekt course (its id) → the same course's sessions on Curriculum. */
export async function openYanhe2Twin(account: string, courseId: string): Promise<void> {
  // No account badge means no Yanhe 2.0 session to ask with.
  if (!account) return explain('signed_out', 'yanhe2')
  try {
    const found = await window.electronAPI.yanhe2.findYanhe2Course(account, { courseId: String(courseId) })
    if (found.kind !== 'ok') return explain(found.kind, 'yanhe2')
    requestYanhe2CourseOpen(found.data)
    navigationStore.navigate('yanhe2-curriculum')
  } catch (error) {
    log.warn('Yanhe 2.0 course lookup failed:', error)
    explain('failed', 'yanhe2')
  }
}
