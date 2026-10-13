/**
 * Yanhe 2.0 caption sync — finding how far a lecture's transcript is off the
 * recording, without recognising any speech.
 *
 * aita's transcript times are off by a constant that differs per lecture
 * (measured 2026-10-13 on nineteen lectures: from 23 s late to 45 s early,
 * whether or not the classroom mic was on), and nothing in its data gives the
 * number. But the transcript still says *when* somebody was speaking, and the
 * recording's loudness says the same thing on the recording's clock. Sliding
 * one over the other and taking the best fit gives the constant, to about a
 * second (line times are whole seconds).
 *
 * Everything here is pure: main fetches the audio and feeds it in.
 */
import type { Yanhe2ReadResult } from './yanhe2Calendar';
import type { Yanhe2TranscriptLine } from './yanhe2Transcript';

/**
 * `ok`: hold every line back by `delay` seconds (negative brings them
 * forward). `unknown`: the lecture was measured and gave no clear answer.
 */
export type Yanhe2CaptionSyncResult =
  | { kind: 'ok'; delay: number }
  | { kind: 'unknown' }
  | { kind: 'no_transcript' }
  | { kind: Exclude<Yanhe2ReadResult<never>['kind'], 'ok'> };

/** Envelope and speaking-signal samples per second. */
export const SYNC_HZ = 10;
/** The PCM rate the envelope is cut from. */
export const SYNC_PCM_RATE = 8000;
/** Seconds of audio in one window. */
export const SYNC_WINDOW_SECONDS = 300;
/** How far either way a transcript is looked for. */
export const SYNC_MAX_LAG_SECONDS = 180;

/** A pause between two lines long enough to show in the loudness. */
const PAUSE_SECONDS = 2;
/** A window with fewer pauses than this has nothing to line up on. */
const MIN_PAUSES = 3;
/** Windows are taken this far apart, so two that agree are two measurements. */
const WINDOW_SPACING_SECONDS = 600;
const WINDOW_STEP_SECONDS = 30;

export interface HlsSegment {
  /** Seconds from the start of the recording. */
  start: number;
  duration: number;
  uri: string;
}

/** The segments of a media playlist, each with the time it starts at. */
export function parseHlsSegments(playlist: string): HlsSegment[] {
  const segments: HlsSegment[] = [];
  let start = 0;
  let duration = 0;
  for (const raw of playlist.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('#EXTINF:')) {
      const seconds = Number.parseFloat(line.slice(8));
      duration = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
    } else if (line && !line.startsWith('#')) {
      segments.push({ start, duration, uri: line });
      start += duration;
      duration = 0;
    }
  }
  return segments;
}

/**
 * Where to listen: up to `count` window starts (seconds), best first, each
 * `SYNC_WINDOW_SECONDS` long and inside the recording. A window is as good as
 * the number of pauses the transcript has in it; stretches the transcript
 * skips, or where the teacher never stops, are no use.
 */
export function pickSyncWindows(lines: Yanhe2TranscriptLine[], durationSeconds: number, count = 3): number[] {
  const pauses: number[] = [];
  for (let index = 1; index < lines.length; index++) {
    const gap = lines[index].begin - lines[index - 1].end;
    // A gap of minutes is the transcript missing, not a pause: only its two edges would match.
    if (gap >= PAUSE_SECONDS && gap <= 60) pauses.push(lines[index - 1].end);
  }
  const candidates: { start: number; score: number }[] = [];
  for (let start = 0; start + SYNC_WINDOW_SECONDS <= durationSeconds; start += WINDOW_STEP_SECONDS) {
    const score = pauses.filter((at) => at >= start && at < start + SYNC_WINDOW_SECONDS).length;
    if (score >= MIN_PAUSES) candidates.push({ start, score });
  }
  candidates.sort((a, b) => b.score - a.score || a.start - b.start);

  const picked: number[] = [];
  for (const spacing of [WINDOW_SPACING_SECONDS, SYNC_WINDOW_SECONDS]) {
    for (const candidate of candidates) {
      if (picked.length >= count) return picked;
      if (picked.every((start) => Math.abs(start - candidate.start) >= spacing)) picked.push(candidate.start);
    }
  }
  return picked;
}

/** Loudness in dB of each 1/`SYNC_HZ` s of 16-bit mono PCM at `SYNC_PCM_RATE`. */
export function loudnessEnvelope(pcm: Int16Array): Float32Array {
  const step = SYNC_PCM_RATE / SYNC_HZ;
  const out = new Float32Array(Math.floor(pcm.length / step));
  for (let index = 0; index < out.length; index++) {
    let sum = 0;
    for (let k = index * step, end = k + step; k < end; k++) {
      const sample = pcm[k] / 32768;
      sum += sample * sample;
    }
    out[index] = 10 * Math.log10(sum / step + 1e-12);
  }
  return out;
}

function percentile(values: Float32Array, fraction: number): number {
  const sorted = Float32Array.from(values).sort();
  return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))];
}

/**
 * The envelope as "how speech-like", zero mean and unit variance: the level
 * above the window's own quiet floor, capped at its loud end, so one cough or
 * a slammed door counts no more than a sentence. Null for a flat window.
 */
function activity(envelope: Float32Array): Float32Array | null {
  const floor = percentile(envelope, 0.1);
  const top = percentile(envelope, 0.95);
  if (top - floor < 1) return null;
  const out = new Float32Array(envelope.length);
  let mean = 0;
  for (let index = 0; index < out.length; index++) {
    out[index] = Math.min(1, Math.max(0, (envelope[index] - floor) / (top - floor)));
    mean += out[index];
  }
  mean /= out.length;
  let variance = 0;
  for (let index = 0; index < out.length; index++) {
    out[index] -= mean;
    variance += out[index] * out[index];
  }
  const deviation = Math.sqrt(variance / out.length);
  if (deviation < 1e-6) return null;
  for (let index = 0; index < out.length; index++) out[index] /= deviation;
  return out;
}

export interface SyncWindowFit {
  /** Seconds the transcript must be held back by to fit this window best. */
  lag: number;
  /** Correlation at `lag`. */
  peak: number;
  /** The best correlation more than three seconds away from `lag`. */
  runnerUp: number;
}

/**
 * Fit the transcript to one window of audio: `envelope` is the loudness from
 * `windowStart` seconds into the recording. Null when the window is flat.
 */
export function fitSyncWindow(
  lines: Yanhe2TranscriptLine[],
  windowStart: number,
  envelope: Float32Array,
): SyncWindowFit | null {
  const act = activity(envelope);
  if (!act) return null;
  const length = act.length;
  const maxLag = SYNC_MAX_LAG_SECONDS * SYNC_HZ;
  const origin = Math.round(windowStart * SYNC_HZ);

  // 1 while a line is being spoken, over everything any lag can reach.
  const base = origin - maxLag;
  const speaking = new Uint8Array(length + 2 * maxLag);
  for (const line of lines) {
    const from = Math.max(0, Math.round(line.begin * SYNC_HZ) - base);
    const to = Math.min(speaking.length, Math.round(line.end * SYNC_HZ) - base);
    for (let index = from; index < to; index++) speaking[index] = 1;
  }
  const spoken = new Uint32Array(speaking.length + 1);
  for (let index = 0; index < speaking.length; index++) spoken[index + 1] = spoken[index] + speaking[index];

  // Pearson correlation at each lag. `act` is already normalised, so only the
  // transcript slice's own spread is left to divide by.
  const scores = new Float32Array(2 * maxLag + 1);
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    const at = maxLag - lag;
    const share = (spoken[at + length] - spoken[at]) / length;
    const deviation = Math.sqrt(share * (1 - share));
    if (deviation < 0.05) continue;
    let sum = 0;
    for (let index = 0; index < length; index++) {
      if (speaking[at + index]) sum += act[index];
    }
    scores[lag + maxLag] = sum / length / deviation;
  }

  let best = 0;
  for (let index = 1; index < scores.length; index++) {
    if (scores[index] > scores[best]) best = index;
  }
  let runnerUp = 0;
  for (let index = 0; index < scores.length; index++) {
    if (Math.abs(index - best) > 3 * SYNC_HZ && scores[index] > runnerUp) runnerUp = scores[index];
  }
  return { lag: (best - maxLag) / SYNC_HZ, peak: scores[best], runnerUp };
}

/** Below this a peak is noise. */
const MIN_PEAK = 0.12;
/** Two windows that land this close found the same thing. */
const AGREE_SECONDS = 1;
/** A window trusted on its own: a strong peak, well clear of anything else. */
const STRONG_PEAK = 0.3;
const STRONG_RATIO = 1.8;

const isStrong = (fit: SyncWindowFit): boolean =>
  fit.peak >= STRONG_PEAK && fit.peak >= STRONG_RATIO * Math.max(fit.runnerUp, 0.05);

/**
 * The lecture's delay from its windows' fits, to a tenth of a second, or null
 * when they do not say. Two windows that agree are an answer (the chance of
 * two wrong peaks landing within a second of each other is under one in a
 * hundred); one window is an answer only when it is strong and no other
 * strong window contradicts it.
 */
export function judgeCaptionSync(fits: SyncWindowFit[]): number | null {
  // A peak at the very edge of the search is the search running out, not a fit.
  const usable = fits.filter((fit) => fit.peak >= MIN_PEAK && Math.abs(fit.lag) < SYNC_MAX_LAG_SECONDS - 5);
  const round = (seconds: number) => Math.round(seconds * 10) / 10 || 0;

  let pair: { delay: number; weight: number } | null = null;
  for (let a = 0; a < usable.length; a++) {
    for (let b = a + 1; b < usable.length; b++) {
      if (Math.abs(usable[a].lag - usable[b].lag) > AGREE_SECONDS) continue;
      const weight = usable[a].peak + usable[b].peak;
      if (!pair || weight > pair.weight) {
        pair = { delay: (usable[a].lag * usable[a].peak + usable[b].lag * usable[b].peak) / weight, weight };
      }
    }
  }
  if (pair) return round(pair.delay);

  const strong = usable.filter(isStrong);
  return strong.length === 1 ? round(strong[0].lag) : null;
}
