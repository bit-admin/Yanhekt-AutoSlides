import { readNoteMetadata, upsertNoteMetadata, noteImageUrls } from '@common/notesContent'
import { buildSharePayload, encodeSharePayload } from '@common/shareLink'
import type { SlideMetadataSource } from '@common/slideMetadataTypes'
import type { useCloudNotes } from './useCloudNotes'

type CloudNotesApi = ReturnType<typeof useCloudNotes>

/**
 * Outcome of a publish attempt.
 * - `ok`: published (or was already published server-side → `duplicate`). `content`
 *   is the note's write-back content (metadata block updated with the index URL),
 *   present only from `publishNote` after persistence.
 * - `reason`: a non-error early exit — the note isn't a recorded session
 *   (`not-indexable`), has no images (`no-images`), or already carries an index
 *   URL in its metadata (`already`, with that `indexUrl`).
 * - `error`: the publish request failed (server/network).
 */
export type PublishResult =
  | { ok: true; indexUrl: string; duplicate: boolean; content?: string }
  | { ok: false; reason: 'not-indexable' | 'no-images' | 'already'; indexUrl?: string }
  | { ok: false; error: string }

/**
 * Publish a managed note's slides to the AutoSlides Index. The single source of
 * truth for the folder→index flow, shared by the Cloud Notes Share modal and the
 * Slides page "Publish to Index" button.
 *
 * Only recorded-session notes are indexable — the index keys on the course/session
 * identity carried in the note's embedded `slides` metadata. Image URLs are read
 * straight from the note content, so the note must already be imported (its slides
 * uploaded) before it can be published.
 */
export function useNotesPublish(cn: CloudNotesApi) {
  /** Build the payload and publish from a note's stringified content (no persistence). */
  async function publishFromContent(content: string): Promise<PublishResult> {
    const meta = readNoteMetadata(content)
    // Already published — surface the recorded URL rather than minting a new one.
    if (meta?.note.indexUrl) return { ok: false, reason: 'already', indexUrl: meta.note.indexUrl }

    const source = meta?.slides?.source
    if (!source?.courseId || !source?.sessionId) return { ok: false, reason: 'not-indexable' }

    const urls = noteImageUrls(content)
    if (urls.length === 0) return { ok: false, reason: 'no-images' }

    const displayName = meta?.note.displayName ?? ''
    const fragment = encodeSharePayload(buildSharePayload(displayName, urls))

    // source/review came from JSON metadata, but de-proxy defensively so IPC
    // structured-clone never sees a Vue reactive Proxy ("could not be cloned").
    const plainSource: SlideMetadataSource = JSON.parse(JSON.stringify(source))
    const rev = meta?.slides?.review
    const edited = !!(rev?.edited || rev?.cropped)
    // Editing implies reviewing.
    const plainReview = { reviewed: !!rev?.reviewed || edited, edited }

    const r = await window.electronAPI.cloudNotes.publishToIndex(fragment, plainSource, plainReview)
    if (!r.ok) return { ok: false, error: r.error }
    return { ok: true, indexUrl: r.data.indexUrl, duplicate: r.data.duplicate }
  }

  /**
   * Publish a note and, on success, persist the returned index URL back into its
   * managed metadata block so a future Share reuses it. Returns the updated
   * content (`content`) so the caller can refresh a live editor.
   */
  async function publishNote(noteId: number, content: string): Promise<PublishResult> {
    const res = await publishFromContent(content)
    if (!res.ok) return res
    let saved = content
    try {
      saved = upsertNoteMetadata(content, { note: { indexUrl: res.indexUrl } })
      await cn.saveContent(noteId, saved)
    } catch { /* metadata write-back is best-effort */ }
    return { ...res, content: saved }
  }

  return { publishFromContent, publishNote }
}
