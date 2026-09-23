/**
 * What the user typed into the Download panel's "session id or URL" box.
 *
 * Accepted as a session: a bare numeric id (`901560`) or a Yanhekt session page
 * URL (`https://www.yanhekt.cn/session/901560`, scheme optional). A course page
 * URL (`/course/64333`) is recognised on purpose so the caller can explain that
 * it needs a *session* link — a course id is not interchangeable, since the
 * course's session list needs a login token while a known session does not.
 */
export type SessionInput =
  | { kind: 'session'; sessionId: string }
  | { kind: 'course'; courseId: string }
  | { kind: 'empty' }
  | { kind: 'invalid' }

const YANHEKT_HOST = /^(?:[a-z0-9-]+\.)*yanhekt\.cn$/i

export function parseSessionInput(raw: string): SessionInput {
  const text = raw.trim()
  if (!text) return { kind: 'empty' }
  if (/^\d+$/.test(text)) return { kind: 'session', sessionId: String(Number(text)) }

  let url: URL
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`)
  } catch {
    return { kind: 'invalid' }
  }
  if (!YANHEKT_HOST.test(url.hostname)) return { kind: 'invalid' }

  // The official site may route through a hash on some pages; check both.
  const path = `${url.pathname}${url.hash.replace(/^#/, '')}`
  const match = path.match(/\/(session|course)\/(\d+)(?:[/?#]|$)/)
  if (!match) return { kind: 'invalid' }
  const id = String(Number(match[2]))
  return match[1] === 'session' ? { kind: 'session', sessionId: id } : { kind: 'course', courseId: id }
}
