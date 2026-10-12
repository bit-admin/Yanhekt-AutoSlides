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
 * The line being spoken at `seconds`, or null between lines. `lines` is in
 * time order (the parser sorts it). When two overlap, the later one wins.
 */
export function transcriptLineAt(lines: Yanhe2TranscriptLine[], seconds: number): Yanhe2TranscriptLine | null {
  let low = 0;
  let high = lines.length - 1;
  let found = -1;
  // The last line that has begun.
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lines[mid].begin <= seconds) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  if (found < 0) return null;
  return seconds < lines[found].end ? lines[found] : null;
}
