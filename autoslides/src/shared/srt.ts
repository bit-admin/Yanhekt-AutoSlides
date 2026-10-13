/**
 * SubRip (`.srt`) reading, for the subtitle files saved beside a lecture.
 */

export interface SubtitleCue {
  /** Seconds into the recording. `end` is always after `begin`. */
  begin: number;
  end: number;
  text: string;
}

const TIMING = /(\d+):(\d{1,2}):(\d{1,2})[,.](\d{1,3})\s*-->\s*(\d+):(\d{1,2}):(\d{1,2})[,.](\d{1,3})/;

function seconds(hours: string, minutes: string, secs: string, fraction: string): number {
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(secs) + Number(fraction.padEnd(3, '0')) / 1000;
}

/**
 * The cues of an `.srt` file in time order. Tolerant of what players are
 * tolerant of: a byte order mark, Windows line ends, a missing counter line,
 * a dot for the decimal comma. Styling tags are dropped and a cue's lines are
 * joined with a space; a block without a timing line or without text is skipped.
 */
export function parseSrt(source: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const blocks = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split('\n');
    const at = lines.findIndex((line) => TIMING.test(line));
    if (at < 0) continue;
    const match = lines[at].match(TIMING)!;
    const begin = seconds(match[1], match[2], match[3], match[4]);
    const end = seconds(match[5], match[6], match[7], match[8]);
    const text = lines
      .slice(at + 1)
      .map((line) => line.replace(/<[^>]*>|\{\\[^}]*\}/g, '').trim())
      .filter(Boolean)
      .join(' ');
    if (!text || end <= begin) continue;
    cues.push({ begin, end, text });
  }
  return cues.sort((a, b) => a.begin - b.begin);
}
