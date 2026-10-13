// Subtitles for the Lectures player: the `.srt` saved beside a lecture, read
// once per file, as captions over the picture and as a transcript to seek by.

import { computed, ref, watch, type Ref } from 'vue'
import { parseSrt, type SubtitleCue } from '@common/srt'
import { transcriptIndexAt } from '@common/yanhe2Transcript'
import { createLogger } from '@shared/utils/logger'

const log = createLogger('LectureSubtitles')

// One switch each for every lecture opened in the Lectures player: turned on
// once, it stays on for the next episode. Not saved across launches.
const captionsOn = ref(false)
const transcriptOpen = ref(false)

export function useLectureSubtitles(
  /** The session's subtitle file, or undefined when it has none. */
  filePath: Ref<string | undefined>,
  currentTime: Ref<number>,
) {
  const cues = ref<SubtitleCue[]>([])
  let ticket = 0

  const load = async () => {
    const mine = ++ticket
    cues.value = []
    const path = filePath.value
    if (!path) return
    try {
      const text = await window.electronAPI.lectures.readSubtitles(path)
      if (mine !== ticket) return
      // An unreadable or empty file means no subtitles; the player is unaffected.
      if (text) cues.value = parseSrt(text)
    } catch (error) {
      if (mine === ticket) log.warn('Subtitle file load failed', path, error)
    }
  }

  watch(filePath, load, { immediate: true })

  const hasSubtitles = computed(() => cues.value.length > 0)

  /** The last cue that has begun, or -1 before the first: the transcript's marked row. */
  const currentIndex = computed(() => transcriptIndexAt(cues.value, currentTime.value))

  /** What is being said right now; empty in the pause between two cues. */
  const caption = computed(() => {
    if (!captionsOn.value) return ''
    const cue = cues.value[currentIndex.value]
    return cue && currentTime.value < cue.end ? cue.text : ''
  })

  const toggleCaptions = () => { captionsOn.value = !captionsOn.value }
  const toggleTranscript = () => { transcriptOpen.value = !transcriptOpen.value }

  return {
    cues,
    hasSubtitles,
    currentIndex,
    caption,
    captionsOn,
    transcriptOpen,
    toggleCaptions,
    toggleTranscript,
  }
}
