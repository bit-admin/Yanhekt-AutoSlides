// Opening a Yanhe 2.0 session in a playback tab, from wherever it is listed
// (a Calendar card, a Curriculum session row).
import type { Yanhe2CalendarSession } from '@common/yanhe2Calendar'
import { isYanhe2Playable } from '@common/yanhe2Playback'
import { notifyManualTabLimit } from '@features/course/courseSelection'
import { openPlaybackTab, yanhe2TabKey } from '@features/course/tabStore'
import { yanhe2ActiveBadge } from '@features/platform/yanhe2AccountUi'

/** Only a live or recorded session has something to play; anything else is left alone. */
export function openYanhe2Session(row: Yanhe2CalendarSession): void {
  const account = yanhe2ActiveBadge.value
  if (!isYanhe2Playable(row.status) || !account) return
  // A plain copy: the row is reactive, and the tab outlives the list's next refresh.
  const session: Yanhe2CalendarSession = { ...row }
  const key = yanhe2TabKey(session.subId)
  const result = openPlaybackTab({
    mode: session.status === 'live' ? 'live' : 'recorded',
    course: { id: key, title: session.title, instructor: session.teacher, time: '' },
    streamId: key,
    sessionId: key,
    title: session.title,
    origin: 'manual',
    yanhe2: { account, session },
  })
  if (!result.ok) notifyManualTabLimit()
}
