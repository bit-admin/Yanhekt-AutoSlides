// Why a recorded session could not be resolved from its id, as a
// cross-process signal. IPC drops custom error fields, so the main-process
// handler rethrows `YanhektLookupError` with a stable marker in the message
// (same idea as `outputDirAccess.ts`), and the renderer parses it back.
//
// - `not_found`     — Yanhekt has no session with that id.
// - `no_recording`  — the session exists but has no recording yet.
// - `expired`       — an earlier term's session: Yanhekt no longer serves it by
//                     id, and neither the course index on this computer nor its
//                     course's session list could stand in.
// - `auth_required` — it could, but that list needs a sign-in.

export type SessionLookupProblemKind = 'not_found' | 'no_recording' | 'expired' | 'auth_required'

const MARKER = 'AUTOSLIDES_SESSION_LOOKUP'
const KINDS: readonly SessionLookupProblemKind[] = ['not_found', 'no_recording', 'expired', 'auth_required']

export function formatSessionLookupProblem(kind: SessionLookupProblemKind, message: string): string {
  return `${MARKER}:${kind}: ${message}`
}

/** The kind when the error (raw or IPC-wrapped) carries the marker, else null. */
export function parseSessionLookupProblem(error: unknown): SessionLookupProblemKind | null {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  const match = new RegExp(`${MARKER}:([a-z_]+):`).exec(message)
  const kind = match?.[1] as SessionLookupProblemKind | undefined
  return kind && KINDS.includes(kind) ? kind : null
}
