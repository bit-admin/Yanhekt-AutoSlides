import { describe, expect, it } from 'vitest';
import {
  SYNC_HZ,
  SYNC_PCM_RATE,
  SYNC_WINDOW_SECONDS,
  fitSyncWindow,
  judgeCaptionSync,
  loudnessEnvelope,
  parseHlsSegments,
  pickSyncWindows,
} from './yanhe2CaptionSync';
import type { Yanhe2TranscriptLine } from './yanhe2Transcript';

/** A repeatable stand-in for Math.random. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** A lecture's worth of lines: sentences of 3–8 s, most back to back, some after a pause. */
function lecture(seconds: number, random: () => number): Yanhe2TranscriptLine[] {
  const lines: Yanhe2TranscriptLine[] = [];
  let at = 20;
  while (at < seconds - 20) {
    const length = 3 + Math.floor(random() * 6);
    lines.push({ begin: at, end: at + length, text: 'x' });
    at += length + (random() < 0.3 ? 2 + Math.floor(random() * 8) : 0);
  }
  return lines;
}

/** What a microphone would give for those lines when speech is heard `delay` seconds after each line's time. */
function heard(lines: Yanhe2TranscriptLine[], delay: number, start: number, random: () => number): Float32Array {
  const envelope = new Float32Array(SYNC_WINDOW_SECONDS * SYNC_HZ);
  for (let index = 0; index < envelope.length; index++) {
    const t = start + index / SYNC_HZ - delay;
    const speaking = lines.some((line) => t >= line.begin && t < line.end);
    envelope[index] = (speaking ? -25 : -55) + (random() - 0.5) * 12;
  }
  return envelope;
}

describe('parseHlsSegments', () => {
  it('gives each segment the time it starts at', () => {
    const playlist = '#EXTM3U\n#EXT-X-TARGETDURATION:22\n#EXTINF:21.96,\nVideo10.ts\r\n#EXTINF:19.98,\nVideo11.ts\n#EXT-X-ENDLIST\n';
    const segments = parseHlsSegments(playlist);
    expect(segments.map((s) => s.uri)).toEqual(['Video10.ts', 'Video11.ts']);
    expect(segments[0].start).toBe(0);
    expect(segments[1].start).toBeCloseTo(21.96);
    expect(segments[1].duration).toBeCloseTo(19.98);
  });
});

describe('pickSyncWindows', () => {
  it('skips stretches the transcript does not cover', () => {
    // Nothing for the first hour, then a normal lecture.
    const lines = lecture(1800, seeded(1)).map((line) => ({ ...line, begin: line.begin + 3600, end: line.end + 3600 }));
    const windows = pickSyncWindows(lines, 5400);
    expect(windows.length).toBeGreaterThan(0);
    for (const start of windows) expect(start).toBeGreaterThanOrEqual(3600 - SYNC_WINDOW_SECONDS);
  });

  it('keeps windows inside the recording and apart from each other', () => {
    const windows = pickSyncWindows(lecture(5400, seeded(2)), 5400);
    expect(windows).toHaveLength(3);
    for (const start of windows) expect(start + SYNC_WINDOW_SECONDS).toBeLessThanOrEqual(5400);
    expect(Math.abs(windows[0] - windows[1])).toBeGreaterThanOrEqual(600);
  });

  it('passes over a stretch where the transcript caught only scraps', () => {
    // A dense first half-hour, then half an hour of one short line every 20 s: far more "pauses", none of them real.
    const dense = lecture(1800, seeded(4));
    const scraps = Array.from({ length: 90 }, (_, index) => ({ begin: 1800 + index * 20, end: 1802 + index * 20, text: 'x' }));
    const windows = pickSyncWindows([...dense, ...scraps], 3600);
    expect(windows.length).toBeGreaterThan(0);
    for (const start of windows) expect(start + SYNC_WINDOW_SECONDS).toBeLessThanOrEqual(1800 + 60);
  });

  it('still listens to a transcript that is thin everywhere', () => {
    const scraps = Array.from({ length: 180 }, (_, index) => ({ begin: index * 20, end: index * 20 + 2, text: 'x' }));
    expect(pickSyncWindows(scraps, 3600).length).toBeGreaterThan(0);
  });

  it('leaves out the minutes before class settles', () => {
    for (const start of pickSyncWindows(lecture(5400, seeded(5)), 5400)) expect(start).toBeGreaterThanOrEqual(120);
  });

  it('has nowhere to listen when nobody ever pauses', () => {
    const lines = Array.from({ length: 300 }, (_, index) => ({ begin: index * 5, end: index * 5 + 5, text: 'x' }));
    expect(pickSyncWindows(lines, 1500)).toEqual([]);
  });
});

describe('loudnessEnvelope', () => {
  it('reads a loud tenth of a second well above a silent one', () => {
    const step = SYNC_PCM_RATE / SYNC_HZ;
    const pcm = new Int16Array(step * 2);
    for (let index = 0; index < step; index++) pcm[index] = index % 2 ? 8000 : -8000;
    const envelope = loudnessEnvelope(pcm);
    expect(envelope).toHaveLength(2);
    expect(envelope[0]).toBeGreaterThan(-15);
    expect(envelope[1]).toBeLessThan(-100);
  });
});

describe('fitSyncWindow', () => {
  it.each([0, 13.2, -15.9, 45.5])('finds a transcript that is %s s off', (delay) => {
    const random = seeded(7);
    const lines = lecture(3000, random);
    const fit = fitSyncWindow(lines, 900, heard(lines, delay, 900, random));
    expect(fit).not.toBeNull();
    expect(Math.abs(fit!.lag - delay)).toBeLessThanOrEqual(0.5);
    expect(fit!.peak).toBeGreaterThan(2 * fit!.runnerUp);
  });

  it('has nothing to say about a flat window', () => {
    const lines = lecture(3000, seeded(3));
    expect(fitSyncWindow(lines, 900, new Float32Array(SYNC_WINDOW_SECONDS * SYNC_HZ).fill(-50))).toBeNull();
  });
});

describe('judgeCaptionSync', () => {
  it('takes two windows that agree, even weak ones', () => {
    expect(judgeCaptionSync([
      { lag: 45.6, peak: 0.19, runnerUp: 0.08 },
      { lag: 45.5, peak: 0.66, runnerUp: 0.59 },
    ])).toBe(45.5);
  });

  it('does not take two windows that disagree', () => {
    expect(judgeCaptionSync([
      { lag: -133.7, peak: 0.14, runnerUp: 0.13 },
      { lag: 54.8, peak: 0.32, runnerUp: 0.31 },
    ])).toBeNull();
  });

  it('takes one window only when it is strong and clear', () => {
    expect(judgeCaptionSync([{ lag: -23.1, peak: 0.41, runnerUp: 0.15 }])).toBe(-23.1);
    expect(judgeCaptionSync([{ lag: -54.4, peak: 0.26, runnerUp: 0.26 }])).toBeNull();
    expect(judgeCaptionSync([{ lag: 12, peak: 0.5, runnerUp: 0.45 }])).toBeNull();
  });

  it('does not take two strong windows that contradict each other', () => {
    expect(judgeCaptionSync([
      { lag: 10, peak: 0.5, runnerUp: 0.1 },
      { lag: 30, peak: 0.5, runnerUp: 0.1 },
    ])).toBeNull();
  });

  it('ignores a peak at the edge of the search', () => {
    expect(judgeCaptionSync([{ lag: 180, peak: 0.6, runnerUp: 0.1 }])).toBeNull();
  });

  it('answers 0, not -0, for a lecture in sync', () => {
    expect(Object.is(judgeCaptionSync([
      { lag: -0.02, peak: 0.4, runnerUp: 0.1 },
      { lag: 0, peak: 0.5, runnerUp: 0.2 },
    ]), 0)).toBe(true);
  });
});
