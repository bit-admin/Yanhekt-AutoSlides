import { OWNED_NOTE_METHODS, type NotesResult, type UploadedImage } from '@common/notesTypes'
import { overrides, type CloudNotesProvider } from '@shared/overrideRegistry'

/** The provider's calls plus the upload of a file on disk (note import). */
export interface OwnedNotesApi extends CloudNotesProvider {
  uploadImageFromPath(filePath: string): Promise<NotesResult<UploadedImage>>
}

/**
 * The note calls of one account.
 *
 * With a badge, every call names that account and main sends it only while
 * the account is still the active one; after a switch it answers
 * `account-changed` and nothing goes out (`cloudNotes.asOwner`). That is what
 * stops an operation of several calls, started for one account, from
 * finishing under another's token: the renderer hears of a switch after main
 * has made it, so a check here alone would come too late.
 *
 * Without a badge (signed out, or a window that does not know the account,
 * such as the Tools window) these are the plain calls.
 *
 * Demo mode keeps its fabricated provider.
 */
export function ownedNotesApi(badge: string | null): OwnedNotesApi {
  if (overrides.cloudNotesProvider) {
    return {
      ...overrides.cloudNotesProvider,
      uploadImageFromPath: (path) => window.electronAPI.cloudNotes.uploadImageFromPath(path),
    }
  }
  const plain = window.electronAPI.cloudNotes
  if (!badge) return plain

  const owned: Record<string, (...args: unknown[]) => Promise<NotesResult<unknown>>> = {}
  for (const method of OWNED_NOTE_METHODS) {
    // The arguments are the callers' own plain values (ids, strings, a literal
    // params object, image bytes): nothing reactive is passed through here.
    owned[method] = (...args) => plain.asOwner(badge, method, args)
  }
  return { ...owned, shortenShareUrl: plain.shortenShareUrl } as unknown as OwnedNotesApi
}
