import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { parseYanhektIdInput, type YanhektIdKind } from '@common/sessionInput'
import { notifyOpenById, openCourseById, openSessionById } from './openById'

/**
 * The Search page's "open by id" box (Yanhekt recorded). A course id opens
 * that course's sessions page, the same way a pin with only an id does. A
 * session id opens its course's sessions page with the session playing in a
 * tab on top (`openById.ts`, shared with `autoslides://` links).
 */
export function useOpenById() {
  const { t } = useI18n()

  const kind = ref<YanhektIdKind>('course')
  const input = ref('')
  const busy = ref(false)

  const submit = async (): Promise<void> => {
    if (busy.value) return
    const parsed = parseYanhektIdInput(input.value, kind.value)
    if (parsed.kind === 'empty') return
    if (parsed.kind === 'invalid') {
      notifyOpenById(t('searchPage.openById.invalid'))
      return
    }
    if (parsed.kind === 'course') {
      openCourseById(parsed.courseId)
      input.value = ''
      return
    }
    busy.value = true
    try {
      if (await openSessionById(parsed.sessionId)) input.value = ''
    } finally {
      busy.value = false
    }
  }

  return { kind, input, busy, submit }
}
