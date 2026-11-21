import { activeDialog } from '@shared/ui/dialog'

export interface VideoKeyboardOptions {
  mode: 'live' | 'recorded'
  /** Seconds per ArrowLeft/ArrowRight step. */
  seekSeconds: number
  /** Volume delta per ArrowUp/ArrowDown step. */
  volumeStep: number
  /** True while this player is the one on screen. Tabs stay mounted, so only one answers. */
  isActive: () => boolean
  /** True while a modal (slide preview) is open — keymap disabled. */
  isModalOpen: () => boolean
  /** True while playback controls are disabled (task mode) — keymap disabled. */
  isDisabled: () => boolean
  /** True when either the single or dual player is fullscreen (Escape branch). */
  isAnyFullscreen: () => boolean
  seekBy: (delta: number) => void
  togglePlayback: () => void
  stepPlaybackRate: (dir: 1 | -1) => void
  toggleMute: () => void
  toggleFullscreen: () => void
  adjustVolume: (delta: number) => void
}

/**
 * Capture-phase keymap for the player. Attached in capture phase so it owns
 * these keys regardless of focus. Seek / play-pause / speed are recorded-only
 * (live can't seek and has no speed control); mute, fullscreen, and volume
 * work in both modes.
 *
 * The caller controls listener lifetime via attach()/detach() from its own
 * mounted/unmounted hooks — deliberately NOT self-registering, so the attach
 * point stays after the page's awaited config loads. Every mounted player
 * has a listener, and `isActive` lets only the one on screen act.
 */
/** A control that Space activates by itself. */
export const isPressable = (target: Element): boolean =>
  !!target.closest('button, a[href], summary, [role="button"], [role="tab"], [role="menuitem"], [role="option"]')

export function useVideoKeyboard(options: VideoKeyboardOptions) {
  const handleVideoKeydown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || !options.isActive()) return
    if (event.ctrlKey || event.metaKey || event.altKey) return

    const target = event.target as HTMLElement | null
    if (target) {
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return
      // Space on a focused control presses that control.
      if (event.key === ' ' && isPressable(target)) return
    }

    if (activeDialog() || options.isModalOpen()) return
    if (options.isDisabled()) return

    const recordedOnly = options.mode === 'recorded'

    switch (event.key) {
      case 'ArrowLeft':
        if (!recordedOnly || event.shiftKey) return
        event.preventDefault()
        options.seekBy(-options.seekSeconds)
        break
      case 'ArrowRight':
        if (!recordedOnly || event.shiftKey) return
        event.preventDefault()
        options.seekBy(options.seekSeconds)
        break
      case ' ':
      case 'k':
      case 'K':
        if (!recordedOnly) return
        event.preventDefault()
        options.togglePlayback()
        break
      case '.':
      case '>':
        if (!recordedOnly) return
        event.preventDefault()
        options.stepPlaybackRate(1)
        break
      case ',':
      case '<':
        if (!recordedOnly) return
        event.preventDefault()
        options.stepPlaybackRate(-1)
        break
      case 'm':
      case 'M':
        event.preventDefault()
        options.toggleMute()
        break
      case 'f':
      case 'F':
        event.preventDefault()
        options.toggleFullscreen()
        break
      case 'Escape':
        if (options.isAnyFullscreen()) {
          event.preventDefault()
          void document.exitFullscreen()
        }
        break
      case 'ArrowUp':
        event.preventDefault()
        options.adjustVolume(options.volumeStep)
        break
      case 'ArrowDown':
        event.preventDefault()
        options.adjustVolume(-options.volumeStep)
        break
      default:
        break
    }
  }

  const attach = () => {
    window.addEventListener('keydown', handleVideoKeydown, { capture: true })
  }

  const detach = () => {
    window.removeEventListener('keydown', handleVideoKeydown, { capture: true })
  }

  return { attach, detach }
}
