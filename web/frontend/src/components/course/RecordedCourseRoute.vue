<template>
  <SessionPage
    :course="course"
    @session-selected="onSessionSelected"
    @back-to-courses="onBackToCourses"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import SessionPage from './SessionPage.vue'
import { router } from '../../router'
import { stashCourse, stashSession, takeCourse } from '../../stores/courseTransfer'
import { getSubscribedCourse } from '../../composables/subscribedCourses'
import type { Course } from '../../composables/useCourseList'
import type { Session, SessionCourse } from '../../composables/useSessionPage'

// Route wrapper for /recorded/:courseId. In-app navigation hands the full
// course over via courseTransfer. On a cold load (deep link/refresh) the
// subscribe-time snapshot is the fallback — it is the ONLY source of
// classrooms/participant_count, which the by-id APIs never return (verified
// against the live API). Last resort is a minimal stub; SessionPage's
// getCourseInfo fetch then fills title/professors/term/college.
defineOptions({ name: 'RecordedCourseRoute' })

const route = useRoute()

const courseId = computed(() => String(route.params.courseId ?? ''))

const course = computed<SessionCourse | null>(() => {
  const id = courseId.value
  if (!id) return null
  return takeCourse(id) ?? getSubscribedCourse(id) ?? { id, title: '', instructor: '', time: '' }
})

const onSessionSelected = (session: Session, enriched: SessionCourse | null) => {
  // Prefer SessionPage's merged details: on a cold load our own course is a
  // bare stub, while the sessions page has already fetched the real fields.
  const c = enriched ?? course.value
  if (!c) return
  stashCourse(c as Course)
  stashSession(c.id, session)
  void router.push({
    name: 'player-recorded',
    params: { courseId: c.id, sessionId: session.session_id },
  })
}

const onBackToCourses = () => {
  void router.push({ name: 'recorded' })
}
</script>
