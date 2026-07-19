import { ref } from 'vue';

// Cross-surface refresh signal: the watch-notes engine bumps this when it
// creates a cloud note, and the Notes page (a separate useCloudNotes instance)
// reloads on its next activation when the counter changed. Ported from the
// desktop notesRefreshStore half of noteOpenRequest.ts.

export const notesRefreshTick = ref(0);

export function requestNotesRefresh(): void {
  notesRefreshTick.value += 1;
}
