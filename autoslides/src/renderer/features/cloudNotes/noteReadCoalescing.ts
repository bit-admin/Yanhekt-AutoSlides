/**
 * In-flight coalescing for cloud-note reads.
 *
 * The notes sidebar binds a row's click straight to `openNote`, so clicking the
 * same row five times used to issue five `note.get` round-trips (and five
 * Editor.js remounts). This joins them into one.
 *
 * Reads are **coalesced but never memoized** — see the note at the call site in
 * `useCloudNotes`. Everything else on the provider passes through untouched, so
 * this stays a thin decorator over whatever provider it is handed, including
 * the demo one.
 */

import { coalesce } from '@shared/services/requestCache'

/** Read methods worth joining. Writes and uploads pass straight through. */
const READ_METHODS = ['get', 'list', 'groupList'] as const

/**
 * Generic over the provider so it accepts both the full preload namespace and
 * the narrower demo `CloudNotesProvider`, returning the same shape it was given.
 */
export function withNoteReadCoalescing<T extends object>(provider: T): T {
  const source = provider as unknown as Record<string, unknown>
  const wrapped: Record<string, unknown> = { ...source }

  for (const name of READ_METHODS) {
    const fn = source[name]
    if (typeof fn !== 'function') continue
    const call = fn as (...args: unknown[]) => Promise<unknown>
    wrapped[name] = (...args: unknown[]) =>
      coalesce(`notes ${name}|${JSON.stringify(args)}`, () => call.apply(provider, args))
  }

  return wrapped as unknown as T
}
