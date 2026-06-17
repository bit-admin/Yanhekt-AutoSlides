import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { VideoStream } from './useVideoPlayer'

export interface UsePlaybackStreamUrlOptions {
  mode: 'live' | 'recorded'
  currentStreamData: Ref<VideoStream | null>
  isDualStreamSelected: Ref<boolean>
}

export interface UsePlaybackStreamUrlReturn {
  canCopyStreamUrl: ComputedRef<boolean>
  streamUrlCopied: Ref<boolean>
  copyStreamUrl: () => Promise<void>
}

// Copy the original (non-proxy, non-internal-IP) URL of the live stream shown in
// a playback tab, so it can be opened elsewhere (e.g. a media player). Uses
// `original_url` rather than the proxy `url`. Only meaningful for a single live
// stream — dual ("Both Streams") view has no single URL to copy.
export function usePlaybackStreamUrl(options: UsePlaybackStreamUrlOptions): UsePlaybackStreamUrlReturn {
  const { mode, currentStreamData, isDualStreamSelected } = options

  const streamUrlCopied = ref(false)
  let resetTimer: ReturnType<typeof setTimeout> | null = null

  const canCopyStreamUrl = computed(() =>
    mode === 'live' && !isDualStreamSelected.value && !!currentStreamData.value?.original_url
  )

  const copyStreamUrl = async (): Promise<void> => {
    const url = currentStreamData.value?.original_url
    if (!canCopyStreamUrl.value || !url) return

    try {
      await navigator.clipboard.writeText(url)
      streamUrlCopied.value = true
      if (resetTimer) clearTimeout(resetTimer)
      resetTimer = setTimeout(() => { streamUrlCopied.value = false }, 2000)
    } catch (error) {
      console.error('Failed to copy stream URL:', error)
    }
  }

  return { canCopyStreamUrl, streamUrlCopied, copyStreamUrl }
}
