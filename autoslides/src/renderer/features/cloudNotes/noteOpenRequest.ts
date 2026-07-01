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

/**
 * Cross-page "reload the note list" signal. Cloud Index imports a share link
 * through its OWN `useCloudNotes()` instance, so the Cloud Notes page (a separate
 * instance) won't see the new note until it reloads. Bumping this tick lets the
 * Cloud Notes page re-fetch when it's mounted; a monotonic counter so repeated
 * imports each fire the watcher.
 */
const refreshTick = ref(0)

function requestNotesRefresh(): void {
  refreshTick.value += 1
}

export const notesRefreshStore = { refreshTick, requestNotesRefresh }
