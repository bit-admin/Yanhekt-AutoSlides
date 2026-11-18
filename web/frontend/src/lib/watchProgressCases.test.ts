// Runs the shared behaviour cases (watchProgress.cases.json, the same bytes in
// desktop and web) against this package's copy of the watch-progress rules.
import { describe, expect, it } from 'vitest';
import { parseUserProgress, progressBucket, resumePositionFor } from './watchProgress';
import sharedCases from './watchProgress.cases.json';

interface Cases {
  version: number;
  parseUserProgress: Array<{ name: string; raw: unknown; expected: unknown }>;
  resumePositionFor: Array<{ name: string; progress: { current: number; overall: number } | null; expected: number | null }>;
  progressBucket: Array<{ seconds: number | 'NaN' | 'Infinity'; expected: number }>;
}

const cases = sharedCases as unknown as Cases;
const number = (value: number | 'NaN' | 'Infinity'): number => (typeof value === 'number' ? value : Number(value));

describe(`watch progress, shared cases v${cases.version}`, () => {
  it.each(cases.parseUserProgress.map((c) => [c.name, c] as const))('parseUserProgress: %s', (_name, c) => {
    expect(parseUserProgress(c.raw)).toEqual(c.expected);
  });
  it.each(cases.resumePositionFor.map((c) => [c.name, c] as const))('resumePositionFor: %s', (_name, c) => {
    expect(resumePositionFor(c.progress)).toBe(c.expected);
  });
  it.each(cases.progressBucket.map((c) => [String(c.seconds), c] as const))('progressBucket(%s)', (_name, c) => {
    expect(progressBucket(number(c.seconds))).toBe(c.expected);
  });
});
