import { ref } from 'vue'

/**
 * Cross-page "open this note in Cloud Notes" signal — lets another Workspace
 * page (e.g. Cloud Index's import-conflict row) navigate to Cloud Notes and
 * have it select a specific note, without the two pages sharing a
 * `useCloudNotes()` instance. Same shape as navigationStore's
 * `courseOpenRequest`: a monotonic `requestId` so re-requesting the same note
 * still triggers the watcher.
 */
export interface NoteOpenRequest {
  noteId: number
  requestId: number
}

const pending = ref<NoteOpenRequest | null>(null)
let nextRequestId = 1

function requestOpenNote(noteId: number): void {
  pending.value = { noteId, requestId: nextRequestId++ }
}

export const noteOpenRequestStore = { pending, requestOpenNote }
