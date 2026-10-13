import { describe, expect, it, vi } from 'vitest';
import { deriveCues } from '@common/sidecars/timeline';

// The service module reaches for Electron through the logger and sharp.
vi.mock('@main/infra/logger', () => ({ createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));
vi.mock('@main/infra/sharpService', () => ({ sharpService: {} }));

import { buildYanhe2SlideTimeline } from './yanhe2SlideImportService';

describe('buildYanhe2SlideTimeline', () => {
  const timeline = buildYanhe2SlideTimeline([
    { file: 'Slide_1000.png', seconds: 0 },
    { file: 'Slide_1001.png', seconds: 72 },
    { file: 'Slide_1002.png', seconds: 81 },
  ]);

  it('is a recorded timeline of one canonical capture per slide, at the server time', () => {
    expect(timeline.kind).toBe('recorded');
    expect(timeline.extractor).toBe('yanhe2');
    expect(timeline.events.map((e) => [e.initialFile, e.changeAt, e.confirmedAt])).toEqual([
      ['Slide_1000.png', 0, 0],
      ['Slide_1001.png', 72, 72],
      ['Slide_1002.png', 81, 81],
    ]);
    expect(new Set(timeline.events.map((e) => e.id)).size).toBe(3);
    for (const event of timeline.events) {
      expect(timeline.resolutions[event.id]).toEqual({ state: 'canonical', file: event.initialFile });
    }
  });

  it('gives each slide the span up to the next one', () => {
    const cues = deriveCues(timeline, 100).filter((cue) => cue.type === 'slide');
    expect(cues.map((cue) => [cue.file, cue.startTime, cue.endTime])).toEqual([
      ['Slide_1000.png', 0, 72],
      ['Slide_1001.png', 72, 81],
      ['Slide_1002.png', 81, 100],
    ]);
  });
});
