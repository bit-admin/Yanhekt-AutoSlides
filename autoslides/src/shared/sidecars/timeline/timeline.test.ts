import { describe, it, expect } from 'vitest';
import {
  clearTimeline,
  appearancesForFile,
  coalesceConsecutiveSlideCues,
  createEmptyTimeline,
  deriveCues,
  ensureRecordedHostFields,
  recordCaptureConfirmed,
  recordGapBoundary,
  relinkDuplicate,
  restoreCanonical,
  unlinkToGap,
} from './index';

describe('slide timeline reducers + deriveCues', () => {
  it('T0 gap + s1 then s2', () => {
    let tl = recordCaptureConfirmed(null, {
      changeAt: 5,
      confirmedAt: 7,
      file: 'Slide_1.png',
    });
    tl = recordCaptureConfirmed(tl, {
      changeAt: 25,
      confirmedAt: 27,
      file: 'Slide_2.png',
    });

    const cues = deriveCues(tl, 100);
    expect(cues).toHaveLength(3);
    expect(cues[0]).toMatchObject({
      id: 'cue_t0_gap',
      startTime: 0,
      endTime: 5,
      type: 'gap',
      gapReason: 'unstable',
    });
    expect(cues[1]).toMatchObject({
      startTime: 5,
      endTime: 25,
      type: 'slide',
      file: 'Slide_1.png',
    });
    expect(cues[2]).toMatchObject({
      startTime: 25,
      endTime: 100,
      type: 'slide',
      file: 'Slide_2.png',
    });
  });

  it('unstable gap between slides', () => {
    let tl = recordCaptureConfirmed(null, {
      changeAt: 0,
      confirmedAt: 2,
      file: 'Slide_1.png',
    });
    tl = recordGapBoundary(tl, {
      changeAt: 10,
      confirmedAt: 14,
      reason: 'unstable',
    });
    tl = recordCaptureConfirmed(tl, {
      changeAt: 20,
      confirmedAt: 22,
      file: 'Slide_2.png',
    });

    const cues = deriveCues(tl, 50);
    expect(cues).toHaveLength(3);
    expect(cues[0]).toMatchObject({ type: 'slide', file: 'Slide_1.png', startTime: 0, endTime: 10 });
    expect(cues[1]).toMatchObject({
      type: 'gap',
      gapReason: 'unstable',
      startTime: 10,
      endTime: 20,
    });
    expect(cues[2]).toMatchObject({ type: 'slide', file: 'Slide_2.png', startTime: 20, endTime: 50 });
  });

  it('s1 → s2 → s1′ dedup keeps third span pointing at first s1', () => {
    let tl = recordCaptureConfirmed(null, {
      changeAt: 0,
      confirmedAt: 1,
      file: 'Slide_1.png',
    });
    tl = recordCaptureConfirmed(tl, {
      changeAt: 15,
      confirmedAt: 16,
      file: 'Slide_2.png',
    });
    tl = recordCaptureConfirmed(tl, {
      changeAt: 30,
      confirmedAt: 31,
      file: 'Slide_3.png',
    });
    tl = relinkDuplicate(tl, {
      duplicateFile: 'Slide_3.png',
      targetFile: 'Slide_1.png',
    });

    const cues = deriveCues(tl, 60);
    expect(cues).toHaveLength(3);
    expect(cues[0]).toMatchObject({ type: 'slide', file: 'Slide_1.png', startTime: 0, endTime: 15 });
    expect(cues[1]).toMatchObject({ type: 'slide', file: 'Slide_2.png', startTime: 15, endTime: 30 });
    expect(cues[2]).toMatchObject({ type: 'slide', file: 'Slide_1.png', startTime: 30, endTime: 60 });

    const e3 = tl.events.find(e => e.initialFile === 'Slide_3.png')!;
    expect(tl.resolutions[e3.id]).toEqual({
      state: 'duplicate',
      duplicateOf: 'Slide_1.png',
    });
  });

  it('AI/exclusion unlink turns a span into an explicit gap', () => {
    let tl = recordCaptureConfirmed(null, {
      changeAt: 0,
      confirmedAt: 1,
      file: 'Slide_1.png',
    });
    tl = recordCaptureConfirmed(tl, {
      changeAt: 15,
      confirmedAt: 16,
      file: 'Slide_2.png',
    });
    tl = recordCaptureConfirmed(tl, {
      changeAt: 30,
      confirmedAt: 31,
      file: 'Slide_3.png',
    });
    tl = unlinkToGap(tl, { file: 'Slide_2.png', reason: 'ai_filtered' });

    const cues = deriveCues(tl, 60);
    expect(cues[0]).toMatchObject({ type: 'slide', file: 'Slide_1.png' });
    expect(cues[1]).toMatchObject({
      type: 'gap',
      gapReason: 'ai_filtered',
      startTime: 15,
      endTime: 30,
    });
    expect(cues[2]).toMatchObject({ type: 'slide', file: 'Slide_3.png' });
  });

  it('manual restore returns a gapped capture to canonical', () => {
    let tl = recordCaptureConfirmed(null, {
      changeAt: 5,
      confirmedAt: 6,
      file: 'Slide_1.png',
    });
    tl = unlinkToGap(tl, { file: 'Slide_1.png', reason: 'manual_trash' });
    expect(deriveCues(tl, 20)[1]).toMatchObject({ type: 'gap', gapReason: 'manual_trash' });

    tl = restoreCanonical(tl, { file: 'Slide_1.png' });
    expect(deriveCues(tl, 20)[1]).toMatchObject({
      type: 'slide',
      file: 'Slide_1.png',
      startTime: 5,
    });
  });

  it('duplicate whose target was unlinked becomes a gap (no throw)', () => {
    let tl = recordCaptureConfirmed(null, {
      changeAt: 0,
      confirmedAt: 1,
      file: 'Slide_1.png',
    });
    tl = recordCaptureConfirmed(tl, {
      changeAt: 10,
      confirmedAt: 11,
      file: 'Slide_2.png',
    });
    tl = relinkDuplicate(tl, {
      duplicateFile: 'Slide_2.png',
      targetFile: 'Slide_1.png',
    });
    tl = unlinkToGap(tl, { file: 'Slide_1.png', reason: 'manual_trash' });

    const cues = deriveCues(tl, 30);
    expect(cues[0]).toMatchObject({ type: 'gap' });
    expect(cues[1]).toMatchObject({ type: 'gap' });
  });

  it('clearTimeline empties events and resolutions', () => {
    let tl = recordCaptureConfirmed(null, {
      changeAt: 1,
      confirmedAt: 2,
      file: 'Slide_1.png',
    });
    tl = clearTimeline(tl);
    expect(tl.events).toEqual([]);
    expect(tl.resolutions).toEqual({});
    expect(deriveCues(tl)).toEqual([]);
  });

  it('createEmptyTimeline is recorded/builtin v1', () => {
    const empty = createEmptyTimeline('2026-01-01T00:00:00.000Z');
    expect(empty).toMatchObject({
      version: 1,
      kind: 'recorded',
      extractor: 'builtin',
      events: [],
      resolutions: {},
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('ensureRecordedHostFields stamps kind on Qt capture-only timeline', () => {
    // Shape as written by AutoSlidesQt --write-timeline (no kind).
    const qtOnly = {
      version: 1 as const,
      extractor: 'qt' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      events: [
        {
          id: 'evt_1',
          changeAt: 0,
          confirmedAt: 1,
          initialFile: 'Slide_001.png',
        },
      ],
      resolutions: {
        evt_1: { state: 'canonical' as const, file: 'Slide_001.png' },
      },
    };
    const stamped = ensureRecordedHostFields(qtOnly);
    expect(stamped.kind).toBe('recorded');
    expect(stamped.extractor).toBe('qt');
    expect(stamped.events).toEqual(qtOnly.events);
    expect(stamped.resolutions).toEqual(qtOnly.resolutions);
    expect(stamped.updatedAt).not.toBe(qtOnly.updatedAt);

    // Already complete → same reference (no churn).
    const again = ensureRecordedHostFields(stamped);
    expect(again).toBe(stamped);
  });

  it('post-process relink works on qt+kind timeline', () => {
    let tl = ensureRecordedHostFields({
      version: 1,
      extractor: 'qt',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      events: [
        {
          id: 'evt_1',
          changeAt: 0,
          confirmedAt: 1,
          initialFile: 'Slide_001.png',
        },
        {
          id: 'evt_2',
          changeAt: 10,
          confirmedAt: 11,
          initialFile: 'Slide_002.png',
        },
      ],
      resolutions: {
        evt_1: { state: 'canonical', file: 'Slide_001.png' },
        evt_2: { state: 'canonical', file: 'Slide_002.png' },
      },
    });
    tl = relinkDuplicate(tl, {
      duplicateFile: 'Slide_002.png',
      targetFile: 'Slide_001.png',
    });
    expect(tl.kind).toBe('recorded');
    expect(tl.extractor).toBe('qt');
    expect(tl.resolutions.evt_2).toEqual({
      state: 'duplicate',
      duplicateOf: 'Slide_001.png',
    });
    const cues = deriveCues(tl, 20);
    expect(cues.find(c => c.id === 'evt_2')).toMatchObject({
      type: 'slide',
      file: 'Slide_001.png',
    });
  });

  it('relinkDuplicate / unlink no-op when file unknown', () => {
    const tl = recordCaptureConfirmed(null, {
      changeAt: 0,
      confirmedAt: 1,
      file: 'Slide_1.png',
    });
    const same1 = relinkDuplicate(tl, {
      duplicateFile: 'missing.png',
      targetFile: 'Slide_1.png',
    });
    const same2 = unlinkToGap(tl, { file: 'missing.png', reason: 'exclusion' });
    expect(same1).toBe(tl);
    expect(same2).toBe(tl);
  });

  it('coalesceConsecutiveSlideCues merges adjacent same-file spans', () => {
    // Capture s1, then a reappearance s1′ that post-process relinks as duplicate.
    let tl = recordCaptureConfirmed(null, {
      changeAt: 0,
      confirmedAt: 1,
      file: 'Slide_1.png',
    });
    tl = recordCaptureConfirmed(tl, {
      changeAt: 96.64,
      confirmedAt: 104.7,
      file: 'Slide_2.png',
    });
    tl = recordCaptureConfirmed(tl, {
      changeAt: 165.12,
      confirmedAt: 173.16,
      file: 'Slide_3.png',
    });
    tl = relinkDuplicate(tl, {
      duplicateFile: 'Slide_2.png',
      targetFile: 'Slide_1.png',
    });

    const raw = deriveCues(tl, 200);
    expect(raw).toHaveLength(3);
    expect(raw[0]).toMatchObject({ type: 'slide', file: 'Slide_1.png', startTime: 0, endTime: 96.64 });
    expect(raw[1]).toMatchObject({ type: 'slide', file: 'Slide_1.png', startTime: 96.64, endTime: 165.12 });
    expect(raw[2]).toMatchObject({ type: 'slide', file: 'Slide_3.png', startTime: 165.12, endTime: 200 });

    const coalesced = coalesceConsecutiveSlideCues(raw);
    expect(coalesced).toHaveLength(2);
    expect(coalesced[0]).toMatchObject({
      type: 'slide',
      file: 'Slide_1.png',
      startTime: 0,
      endTime: 165.12,
    });
    // Keep the first event id as the chapter identity.
    expect(coalesced[0].id).toBe(raw[0].id);
    expect(coalesced[1]).toMatchObject({
      type: 'slide',
      file: 'Slide_3.png',
      startTime: 165.12,
      endTime: 200,
    });
  });

  it('coalesceConsecutiveSlideCues does not merge non-adjacent reappearances', () => {
    let tl = recordCaptureConfirmed(null, {
      changeAt: 0,
      confirmedAt: 1,
      file: 'Slide_1.png',
    });
    tl = recordCaptureConfirmed(tl, {
      changeAt: 15,
      confirmedAt: 16,
      file: 'Slide_2.png',
    });
    tl = recordCaptureConfirmed(tl, {
      changeAt: 30,
      confirmedAt: 31,
      file: 'Slide_3.png',
    });
    tl = relinkDuplicate(tl, {
      duplicateFile: 'Slide_3.png',
      targetFile: 'Slide_1.png',
    });

    const coalesced = coalesceConsecutiveSlideCues(deriveCues(tl, 60));
    // A → B → A stays three cues (reappearance after a different slide).
    expect(coalesced).toHaveLength(3);
    expect(coalesced.map(c => c.file)).toEqual(['Slide_1.png', 'Slide_2.png', 'Slide_1.png']);
  });

  it('coalesceConsecutiveSlideCues does not merge across gaps', () => {
    const cues = [
      { id: 'a', startTime: 0, endTime: 10, type: 'slide' as const, file: 'Slide_1.png' },
      { id: 'g', startTime: 10, endTime: 20, type: 'gap' as const, gapReason: 'unstable' as const },
      { id: 'b', startTime: 20, endTime: 30, type: 'slide' as const, file: 'Slide_1.png' },
    ];
    const coalesced = coalesceConsecutiveSlideCues(cues);
    expect(coalesced).toHaveLength(3);
    expect(coalesced[0].endTime).toBe(10);
    expect(coalesced[2].startTime).toBe(20);
  });

  it('appearancesForFile returns a single resolved span', () => {
    let tl = recordCaptureConfirmed(null, {
      changeAt: 5,
      confirmedAt: 7,
      file: 'Slide_1.png',
    });
    tl = recordCaptureConfirmed(tl, {
      changeAt: 25,
      confirmedAt: 27,
      file: 'Slide_2.png',
    });

    expect(appearancesForFile(tl, 'Slide_1.png', { videoDuration: 100 })).toEqual([
      { id: expect.any(String), startTime: 5, endTime: 25, source: 'resolved' },
    ]);
  });

  it('appearancesForFile absorbs a relinked reappearance into the canonical file', () => {
    let tl = recordCaptureConfirmed(null, {
      changeAt: 0,
      confirmedAt: 1,
      file: 'Slide_1.png',
    });
    tl = recordCaptureConfirmed(tl, {
      changeAt: 15,
      confirmedAt: 16,
      file: 'Slide_2.png',
    });
    tl = recordCaptureConfirmed(tl, {
      changeAt: 30,
      confirmedAt: 31,
      file: 'Slide_3.png',
    });
    tl = relinkDuplicate(tl, {
      duplicateFile: 'Slide_3.png',
      targetFile: 'Slide_1.png',
    });

    expect(appearancesForFile(tl, 'Slide_1.png', { videoDuration: 60 })).toEqual([
      { id: expect.any(String), startTime: 0, endTime: 15, source: 'resolved' },
      { id: expect.any(String), startTime: 30, endTime: 60, source: 'resolved' },
    ]);
    expect(appearancesForFile(tl, 'Slide_3.png', { videoDuration: 60 })).toEqual([
      { id: expect.any(String), startTime: 30, endTime: 60, source: 'capture' },
    ]);
  });

  it('appearancesForFile falls back to capture span for a gapped file', () => {
    let tl = recordCaptureConfirmed(null, {
      changeAt: 0,
      confirmedAt: 1,
      file: 'Slide_1.png',
    });
    tl = recordCaptureConfirmed(tl, {
      changeAt: 15,
      confirmedAt: 16,
      file: 'Slide_2.png',
    });
    tl = recordCaptureConfirmed(tl, {
      changeAt: 30,
      confirmedAt: 31,
      file: 'Slide_3.png',
    });
    tl = unlinkToGap(tl, { file: 'Slide_2.png', reason: 'ai_filtered' });

    expect(appearancesForFile(tl, 'Slide_2.png', { videoDuration: 60 })).toEqual([
      { id: expect.any(String), startTime: 15, endTime: 30, source: 'capture' },
    ]);
    expect(
      appearancesForFile(tl, 'Slide_2.png', {
        videoDuration: 60,
        includeCaptureFallback: false,
      })
    ).toEqual([]);
  });

  it('appearancesForFile returns [] for missing timeline or unknown file', () => {
    expect(appearancesForFile(null, 'Slide_1.png')).toEqual([]);
    const tl = recordCaptureConfirmed(null, {
      changeAt: 0,
      confirmedAt: 1,
      file: 'Slide_1.png',
    });
    expect(appearancesForFile(tl, 'missing.png', { videoDuration: 20 })).toEqual([]);
  });

  it('appearancesForFile matches a full path basename and leaves last end open', () => {
    const tl = recordCaptureConfirmed(null, {
      changeAt: 12,
      confirmedAt: 14,
      file: 'Slide_1.png',
    });
    const spans = appearancesForFile(tl, '/tmp/slides_foo/Slide_1.png');
    expect(spans).toHaveLength(1);
    expect(spans[0]).toMatchObject({
      startTime: 12,
      endTime: Number.POSITIVE_INFINITY,
      source: 'resolved',
    });
  });
});
