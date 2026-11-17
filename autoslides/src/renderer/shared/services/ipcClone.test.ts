// Recurring #1, characterised: Electron structured-clones every IPC argument
// and throws DataCloneError on a Vue proxy, which these best-effort clients
// would swallow as a write that silently did nothing. The fake bridge here
// clones like Electron does, and every client is fed reactive state.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reactive } from 'vue';

vi.mock('@shared/utils/logger', () => ({ createLogger: () => ({ debug() {}, info() {}, warn() {}, error() {} }) }));

import { recordPostProcessing, recordRecordedExtraction } from './slideMetadataClient';
import { recordCaptureConfirmed, recordGapBoundary } from './slideTimelineClient';

const sent: Array<{ method: string; args: unknown[] }> = [];

/** Every method of a namespace: clone the arguments as IPC would, then record them. */
const bridge = () =>
  new Proxy(
    {},
    {
      get: (_target, method: string) => async (...args: unknown[]) => {
        sent.push({ method, args: structuredClone(args) });
        return null;
      },
    },
  );

beforeEach(() => {
  sent.length = 0;
  vi.stubGlobal('window', { electronAPI: { slideMetadata: bridge(), slideTimeline: bridge() } });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('IPC clients and Vue state', () => {
  it('a reactive object cannot cross structured clone (what the clients guard against)', () => {
    expect(() => structuredClone(reactive({ a: 1 }))).toThrow();
  });

  it('metadata from a reactive course and session is written', async () => {
    const state = reactive({ source: { courseId: '70101', sessionId: '850101', courseTitle: '课程' } });
    await recordRecordedExtraction({ folderPath: '/out/slides_x', extractor: 'builtin', source: state.source });
    expect(sent.map((s) => s.method)).toEqual(['writeExtraction']);
  });

  it('post-processing results held in reactive state are written', async () => {
    const state = reactive({ pp: { completedAt: '2026-11-17T00:00:00.000Z', removed: { duplicate: 2 } } });
    await recordPostProcessing('/out/slides_x', state.pp as never);
    expect(sent.map((s) => s.method)).toEqual(['updatePostProcessing']);
  });

  it('timeline events built from reactive state are written', async () => {
    const state = reactive({ capture: { file: 'Slide_1.png', changeAt: 1, confirmedAt: 2 } });
    await recordCaptureConfirmed('/out/slides_x', state.capture as never);
    await recordGapBoundary('/out/slides_x', reactive({ at: 3, reason: 'unstable' }) as never);
    expect(sent.map((s) => s.method)).toEqual(['recordCaptureConfirmed', 'recordGapBoundary']);
  });
});
