import { computed, ref, type Ref } from 'vue'

/**
 * Shared queue skeleton for the note import/export background queues:
 * item list, cancel flag, running gate, settled-count progress, and the
 * reset/cancel/remove lifecycle. Item processing stays in the consumers —
 * this only owns the state every queue duplicates.
 */
export function useBackgroundQueue<T extends { status: string }>() {
  const queue = ref<T[]>([]) as Ref<T[]>
  const cancelRequested = ref(false)
  const running = ref(false)

  const overall = computed(() => {
    const total = queue.value.length
    // Conflicts are not counted as resolved — they await a user decision.
    const done = queue.value.filter((i) => i.status === 'done' || i.status === 'error').length
    return { done, total }
  })

  function reset(): void {
    if (running.value) return
    queue.value = []
    cancelRequested.value = false
  }

  function cancel(): void {
    cancelRequested.value = true
  }

  /** Drop a row from the queue without processing it. */
  function removeItem(item: T): void {
    queue.value = queue.value.filter((i) => i !== item)
  }

  return { queue, cancelRequested, running, overall, reset, cancel, removeItem }
}
