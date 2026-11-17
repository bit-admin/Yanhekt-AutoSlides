import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface Deferred<T> { promise: Promise<T>; resolve: (value: T) => void }
const defer = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
};

const h = vi.hoisted(() => ({
  decisions: [] as Array<{ resolve: (value: unknown) => void }>,
  saves: [] as Array<{ resolve: (value: unknown) => void; options: { outputPath: string | null } }>,
  resets: 0,
  config: (): Promise<unknown> => Promise.resolve(),
}));

vi.mock('./changeDetection', () => ({
  ChangeDetector: class {
    process() {
      return new Promise((resolve) => { h.decisions.push({ resolve }); });
    }
    reset() { h.resets += 1; }
    clear() {}
    setWorkerConfig() {}
    updateConfig() {}
    getState() { return { verificationState: 'none', currentVerification: 0 }; }
  },
}));
vi.mock('./slideWriter', () => ({
  saveSlide: (_image: unknown, options: { outputPath: string | null }) =>
    new Promise((resolve) => { h.saves.push({ resolve, options }); }),
}));
vi.mock('./frameSource', () => ({
  buildVideoSelector: () => 'video',
  captureFrame: () => ({ width: 1, height: 1 }),
  getVideoElement: () => null,
  isVideoAccessible: () => true,
  validateImageData: () => true,
}));
vi.mock('./workerHelpers', () => ({ slideProcessorService: { updateConfig: () => h.config() } }));
vi.mock('../logger', () => ({ createLogger: () => ({ debug() {}, info() {}, warn() {}, error() {} }) }));

import { SlideExtractionPipeline } from './pipeline';
import type { ExtractedSlide, SlideExtractionAdapter } from './types';

let config: Deferred<unknown>;
const video = { currentTime: 12 } as HTMLVideoElement;
const input = (outputPath = '/out/a') => ({
  mode: 'recorded' as const,
  outputPath,
  videoElementProvider: () => video,
});
const slide = (title: string) => ({ slide: { title } as unknown as ExtractedSlide, fileWritten: true });
const flush = async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); };
const tick = async (ms = 2000) => { await vi.advanceTimersByTimeAsync(ms); };

beforeEach(() => {
  h.decisions.length = 0;
  h.saves.length = 0;
  h.resets = 0;
  config = defer();
  vi.useFakeTimers();
  h.config = () => config.promise;
});
afterEach(() => vi.useRealTimers());

async function started(adapter: SlideExtractionAdapter = {}, outputPath?: string) {
  const pipeline = new SlideExtractionPipeline('recorded', 'tab-1');
  const run = pipeline.run(input(outputPath), adapter);
  config.resolve({ checkInterval: 2000 });
  expect(await run).toBe(true);
  return pipeline;
}

describe('starting an extraction run', () => {
  it('does not start when stopped while the worker is being configured', async () => {
    const pipeline = new SlideExtractionPipeline('recorded', 'tab-1');
    const onStopped = vi.fn();
    const run = pipeline.run(input(), { onStopped });
    pipeline.stop();
    config.resolve({ checkInterval: 2000 });
    expect(await run).toBe(false);
    expect(pipeline.getStatus().isRunning).toBe(false);
    await tick(10_000);
    expect(h.decisions).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(onStopped).not.toHaveBeenCalled();
  });

  it('does not start when destroyed while starting, or with a signal already aborted', async () => {
    const pipeline = new SlideExtractionPipeline('recorded', 'tab-1');
    const run = pipeline.run(input());
    pipeline.destroy();
    config.resolve({});
    expect(await run).toBe(false);
    expect(vi.getTimerCount()).toBe(0);

    const aborted = new AbortController();
    aborted.abort();
    expect(await new SlideExtractionPipeline('recorded', 'tab-2').run(input(), { signal: aborted.signal })).toBe(false);
  });

  it('stops a start in progress when its signal aborts', async () => {
    const controller = new AbortController();
    const pipeline = new SlideExtractionPipeline('recorded', 'tab-1');
    const run = pipeline.run(input(), { signal: controller.signal });
    controller.abort();
    config.resolve({});
    expect(await run).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('refuses a second start while the first is still starting', async () => {
    const pipeline = new SlideExtractionPipeline('recorded', 'tab-1');
    const first = pipeline.run(input());
    expect(await pipeline.run(input())).toBe(false);
    config.resolve({});
    expect(await first).toBe(true);
    pipeline.stop();
  });
});

describe('frames in flight', () => {
  it('compares one frame at a time, however many ticks pass', async () => {
    const pipeline = await started();
    await tick();
    await tick();
    await tick();
    expect(h.decisions).toHaveLength(1);
    h.decisions[0].resolve({});
    await flush();
    await tick();
    expect(h.decisions).toHaveLength(2);
    pipeline.stop();
  });

  it('drops a frame still being compared when the run stops', async () => {
    const onStopped = vi.fn();
    const onSlideExtracted = vi.fn();
    const pipeline = await started({ onStopped, onSlideExtracted });
    await tick();
    pipeline.stop();
    expect(onStopped).not.toHaveBeenCalled();
    h.decisions[0].resolve({ acceptedImage: {} });
    await pipeline.settled();
    expect(h.saves).toHaveLength(0);
    expect(onSlideExtracted).not.toHaveBeenCalled();
    expect(onStopped).toHaveBeenCalledWith([]);
  });

  it('keeps a slide whose file is being written when the run stops, and reports it before onStopped', async () => {
    const order: string[] = [];
    const pipeline = await started({
      onSlideExtracted: (s) => void order.push(`slide:${s.title}`),
      onStopped: (slides) => void order.push(`stopped:${slides.map((s) => s.title).join(',')}`),
    });
    await tick();
    h.decisions[0].resolve({ acceptedImage: {}, changeAt: 10, confirmedAt: 12 });
    await flush();
    expect(h.saves).toHaveLength(1);
    pipeline.stop();
    expect(order).toEqual([]);
    h.saves[0].resolve(slide('Slide_1'));
    await pipeline.settled();
    expect(order).toEqual(['slide:Slide_1', 'stopped:Slide_1']);
    expect(pipeline.getExtractedSlides().map((s) => s.title)).toEqual(['Slide_1']);
  });

  it('gives a late slide of a destroyed run to nobody', async () => {
    const onSlideExtracted = vi.fn();
    const onStopped = vi.fn();
    const pipeline = await started({ onSlideExtracted, onStopped });
    await tick();
    h.decisions[0].resolve({ acceptedImage: {} });
    await flush();
    pipeline.destroy();
    expect(onStopped).toHaveBeenCalledTimes(1);
    h.saves[0].resolve(slide('Slide_1'));
    await pipeline.settled();
    expect(onSlideExtracted).not.toHaveBeenCalled();
    expect(pipeline.getExtractedSlides()).toEqual([]);
  });

  it('lets the old run finish before a new run on the same pipeline starts, each with its own folder', async () => {
    const first: string[] = [];
    const second: string[] = [];
    const pipeline = await started({ onSlideExtracted: (s) => void first.push(s.title) }, '/out/a');
    await tick();
    h.decisions[0].resolve({ acceptedImage: {}, changeAt: 1, confirmedAt: 2 });
    await flush();
    pipeline.stop();

    const again = pipeline.run(input('/out/b'), { onSlideExtracted: (s) => void second.push(s.title) });
    await flush();
    h.saves[0].resolve(slide('Slide_1'));
    expect(await again).toBe(true);
    expect(h.saves[0].options.outputPath).toBe('/out/a');
    expect(first).toEqual(['Slide_1']);
    expect(second).toEqual([]);
    pipeline.stop();
  });
});
