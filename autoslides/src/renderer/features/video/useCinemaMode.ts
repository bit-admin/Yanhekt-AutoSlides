import { onBeforeUnmount, ref, watch } from 'vue'
import { layoutStore } from '@shared/services/layoutStore'

/**
 * Cinema mode for one playback tab. The side panels are shared by the whole
 * window, so they are collapsed only while the cinema tab is the one on screen,
 * and go back to how they were when it is left, exited or closed.
 */
export function useCinemaMode(isVisible: () => boolean) {
  const isCinemaMode = ref(false)
  let saved: { left: boolean; right: boolean } | null = null

  const hold = () => {
    if (saved) return
    saved = { left: layoutStore.leftCollapsed, right: layoutStore.rightCollapsed }
    layoutStore.leftCollapsed = true
    layoutStore.rightCollapsed = true
  }

  const release = () => {
    if (!saved) return
    layoutStore.leftCollapsed = saved.left
    layoutStore.rightCollapsed = saved.right
    saved = null
  }

  const apply = () => {
    if (isCinemaMode.value && isVisible()) hold()
    else release()
  }

  const toggleCinemaMode = () => {
    isCinemaMode.value = !isCinemaMode.value
    apply()
  }

  watch(isVisible, apply, { flush: 'sync' })
  onBeforeUnmount(release)

  return { isCinemaMode, toggleCinemaMode }
}
