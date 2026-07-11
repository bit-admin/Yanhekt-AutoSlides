import { ref, watch, onScopeDispose, type Ref } from 'vue'

export interface UseControlsVisibilityOptions {
  /** Idle time before the overlay hides while playing. */
  idleMs?: number
  isPlaying: Ref<boolean>
  /** Flags that keep the controls pinned while truthy (open popovers). */
  persistSources: Ref<boolean>[]
}

/**
 * Auto-hide state for the player control overlays (single + dual bars share
 * one instance per PlaybackPage). Visible on pointer movement, hidden after a
 * short idle while playing. Stays up when paused, while the pointer is over
 * the controls, or while any persist source (popover) is open.
 *
 * All state is per-call — each mounted PlaybackPage (one per tab) owns its own
 * timer and refs.
 */
export function useControlsVisibility(options: UseControlsVisibilityOptions) {
  const { isPlaying, persistSources } = options
  const idleMs = options.idleMs ?? 2500

  const controlsVisible = ref(true)
  const pointerOverControls = ref(false)
  let controlsHideTimer: ReturnType<typeof setTimeout> | null = null

  const controlsShouldPersist = () =>
    !isPlaying.value ||
    pointerOverControls.value ||
    persistSources.some((source) => source.value)

  const clearControlsTimer = () => {
    if (controlsHideTimer) {
      clearTimeout(controlsHideTimer)
      controlsHideTimer = null
    }
  }

  const scheduleControlsHide = () => {
    clearControlsTimer()
    if (controlsShouldPersist()) return
    controlsHideTimer = setTimeout(() => {
      controlsVisible.value = false
    }, idleMs)
  }

  /** Pointer-movement handler: reveal, then re-arm the hide timer. */
  const showControls = () => {
    controlsVisible.value = true
    scheduleControlsHide()
  }

  const onPlayerPointerLeave = () => {
    if (controlsShouldPersist()) return
    clearControlsTimer()
    controlsVisible.value = false
  }

  watch([isPlaying, pointerOverControls, ...persistSources], () => {
    if (controlsShouldPersist()) {
      clearControlsTimer()
      controlsVisible.value = true
    } else {
      scheduleControlsHide()
    }
  })

  onScopeDispose(clearControlsTimer)

  return {
    controlsVisible,
    pointerOverControls,
    showControls,
    onPlayerPointerLeave,
  }
}
