/**
 * Yanhe 2.0 transcript — the speech recognition aita runs on a lecture after
 * class. Sentence-sized lines, Chinese, with many misheard words; a lecture
 * may have none.
 */

export interface Yanhe2TranscriptLine {
  /** Whole seconds into the recording. `end` is always after `begin`. */
  begin: number;
  end: number;
  text: string;
}

/**
 * The index of the last line that has begun by `seconds`, or -1 before the
 * first. `lines` is in time order (the parser sorts it). It stays on a line
 * through the pause after it, which is what a reader following along wants.
 */
export function transcriptIndexAt(lines: Yanhe2TranscriptLine[], seconds: number): number {
  let low = 0;
  let high = lines.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lines[mid].begin <= seconds) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}

/**
 * The line being spoken at `seconds`, or null between lines. When two
 * overlap, the later one wins.
 */
export function transcriptLineAt(lines: Yanhe2TranscriptLine[], seconds: number): Yanhe2TranscriptLine | null {
  const found = transcriptIndexAt(lines, seconds);
  if (found < 0) return null;
  return seconds < lines[found].end ? lines[found] : null;
}

/** `3725.4` → `01:02:05,400`, the SubRip clock. */
function srtClock(seconds: number): string {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const pad = (value: number, width = 2) => String(value).padStart(width, '0');
  return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor(ms / 60_000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
}

/**
 * The transcript as a SubRip (`.srt`) file, each line held back by `shift`
 * seconds (negative brings them forward). A line is cut short where the next
 * one begins, so two never sit on screen together; a line shifted to before
 * the start of the recording is dropped.
 */
export function transcriptToSrt(lines: Yanhe2TranscriptLine[], shift = 0): string {
  const cues: string[] = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const text = line.text.replace(/\s*[\r\n]+\s*/g, ' ').trim();
    if (!text) continue;
    const next = lines[index + 1];
    const begin = Math.max(0, line.begin + shift);
    const end = Math.min(line.end, next && next.begin > line.begin ? next.begin : line.end) + shift;
    if (end <= begin) continue;
    cues.push(`${cues.length + 1}\n${srtClock(begin)} --> ${srtClock(end)}\n${text}\n`);
  }
  return cues.join('\n');
}
