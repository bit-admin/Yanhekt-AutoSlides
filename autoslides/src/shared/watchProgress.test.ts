import { describe, it, expect } from 'vitest';
import {
  parseUserProgress,
  progressBucket,
  resumePositionFor,
  END_MARGIN_SECONDS,
  MIN_RESUME_SECONDS,
} from './watchProgress';

describe('parseUserProgress', () => {
  it('treats the unwatched [] as no history', () => {
    expect(parseUserProgress([])).toBeNull();
  });

  it('treats a missing or non-object field as no history', () => {
    expect(parseUserProgress(undefined)).toBeNull();
    expect(parseUserProgress(null)).toBeNull();
    expect(parseUserProgress('2300')).toBeNull();
  });

  it('parses the decimal strings the API actually sends', () => {
    expect(parseUserProgress({
      id: '1', badge: '6120120125', session_id: 751843,
      progress_overall: '5936', progress_current: '2300', status: 0,
    })).toEqual({ current: 2300, overall: 5936 });
  });

  it('accepts numbers as well as strings', () => {
    expect(parseUserProgress({ progress_current: 2300, progress_overall: 5936 }))
      .toEqual({ current: 2300, overall: 5936 });
  });

  it('rejects rows whose playhead does not parse', () => {
    expect(parseUserProgress({ progress_current: 'n/a', progress_overall: '5936' })).toBeNull();
    expect(parseUserProgress({ progress_overall: '5936' })).toBeNull();
    expect(parseUserProgress({ progress_current: '-5' })).toBeNull();
  });

  it('keeps the playhead when only the duration is missing', () => {
    expect(parseUserProgress({ progress_current: '2300' })).toEqual({ current: 2300, overall: 0 });
    expect(parseUserProgress({ progress_current: '2300', progress_overall: '0' }))
      .toEqual({ current: 2300, overall: 0 });
  });
});

describe('resumePositionFor', () => {
  it('resumes a genuine mid-lecture position', () => {
    expect(resumePositionFor({ current: 2300, overall: 5936 })).toBe(2300);
  });

  it('starts over when the lecture was watched to the end', () => {
    expect(resumePositionFor({ current: 5930, overall: 5936 })).toBeNull();
    expect(resumePositionFor({ current: 5936 - END_MARGIN_SECONDS, overall: 5936 })).toBeNull();
    expect(resumePositionFor({ current: 5936 - END_MARGIN_SECONDS - 1, overall: 5936 }))
      .toBe(5936 - END_MARGIN_SECONDS - 1);
  });

  it('starts over for a position in the opening seconds', () => {
    expect(resumePositionFor({ current: 2, overall: 5936 })).toBeNull();
    expect(resumePositionFor({ current: MIN_RESUME_SECONDS, overall: 5936 })).toBe(MIN_RESUME_SECONDS);
  });

  it('only applies the low bound when the duration is unknown', () => {
    expect(resumePositionFor({ current: 2300, overall: 0 })).toBe(2300);
    expect(resumePositionFor({ current: 5, overall: 0 })).toBeNull();
  });

  it('passes null through', () => {
    expect(resumePositionFor(null)).toBeNull();
  });
});

describe('progressBucket', () => {
  it('floors onto the 5-second grid the official player uses', () => {
    expect(progressBucket(0)).toBe(0);
    expect(progressBucket(4.9)).toBe(0);
    expect(progressBucket(5)).toBe(5);
    expect(progressBucket(2304.6)).toBe(2300);
  });

  it('is 0 for nonsense input', () => {
    expect(progressBucket(-12)).toBe(0);
    expect(progressBucket(NaN)).toBe(0);
    expect(progressBucket(Infinity)).toBe(0);
  });
});
