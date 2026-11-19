import { parseSessionTitle } from '@common/lectureNaming'

/** What the Library and List views know about a session when ordering it. */
export interface OrderableSession {
  title: string
  /** Episode index from course metadata, or the `SxxExx` token of a renamed file. */
  episode?: number | null
  weekNumber?: number | null
  day?: number | null
  startedAt?: string | null
}

const byTitle = new Intl.Collator('zh', { numeric: true })

function sessionOrderKey(
  session: OrderableSession,
): { week: number; day: number; section: number } | null {
  const parsed = parseSessionTitle(session.title)
  const week = session.weekNumber ?? parsed?.weekNumber
  if (week == null) return null
  return { week, day: session.day ?? parsed?.day ?? 0, section: parsed?.section ?? 0 }
}

/**
 * Episode order within a course: episode index when known, else week/day/section
 * from the fields or from the title itself (`第10周 星期二 第5大节`) — the same
 * rule the Slides folder list uses — instead of a string compare that puts
 * 第10周 before 第1周 and orders 星期X by pinyin. Sessions whose order is
 * unknown go last; the title (numeric zh collation) breaks the remaining ties.
 */
export function compareLectureSessions(a: OrderableSession, b: OrderableSession): number {
  if (a.episode != null && b.episode != null && a.episode !== b.episode) {
    return a.episode - b.episode
  }
  if (a.episode != null && b.episode == null) return -1
  if (a.episode == null && b.episode != null) return 1

  const ka = sessionOrderKey(a)
  const kb = sessionOrderKey(b)
  if (ka && !kb) return -1
  if (!ka && kb) return 1
  if (ka && kb) {
    if (ka.week !== kb.week) return ka.week - kb.week
    if (ka.day !== kb.day) return ka.day - kb.day
    if (ka.section !== kb.section) return ka.section - kb.section
  }

  const sa = a.startedAt || ''
  const sb = b.startedAt || ''
  if (sa !== sb) return sa < sb ? -1 : 1
  return byTitle.compare(a.title, b.title)
}
