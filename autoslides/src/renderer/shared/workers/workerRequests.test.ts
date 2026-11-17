import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorkerRequests, WorkerRequestError, type WorkerLike } from './workerRequests';

type Listener = (event: { data?: unknown }) => void;

class FakeWorker implements WorkerLike {
  sent: Array<Record<string, unknown>> = [];
  terminated = false;
  throwOnSend: Error | null = null;
  private listeners = new Map<string, Listener[]>();
  postMessage(message: unknown): void {
    if (this.throwOnSend) throw this.throwOnSend;
    this.sent.push(message as Record<string, unknown>);
  }
  terminate(): void {
    this.terminated = true;
  }
  addEventListener(type: string, listener: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  emit(type: string, data?: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) listener({ data });
  }
  answer(index: number, extra: Record<string, unknown> = {}): void {
    this.emit('message', { id: this.sent[index].id, success: true, ...extra });
  }
}

let workers: FakeWorker[];
const problems: string[] = [];
const build = (timeoutMs?: number) =>
  createWorkerRequests<{ id: string; success: boolean; value?: number }>({
    createWorker: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
    name: 'test',
    timeoutMs,
    onProblem: (message) => void problems.push(message),
  });
const reasonOf = (promise: Promise<unknown>) =>
  promise.then(
    () => 'resolved',
    (error: unknown) => (error instanceof WorkerRequestError ? error.reason : `other: ${String(error)}`),
  );

beforeEach(() => {
  workers = [];
  problems.length = 0;
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('requests to a worker always end', () => {
  it('resolves each request with its own answer, in any order', async () => {
    const client = build();
    const first = client.request({ type: 'a' });
    const second = client.request({ type: 'b' });
    workers[0].answer(1, { value: 2 });
    workers[0].answer(0, { value: 1 });
    expect((await first).value).toBe(1);
    expect((await second).value).toBe(2);
    expect(workers).toHaveLength(1);
  });

  it('ignores log frames and answers nobody is waiting for', async () => {
    const client = build();
    const pending = client.request({ type: 'a' });
    workers[0].emit('message', { id: workers[0].sent[0].id, type: 'log' });
    workers[0].emit('message', { id: 'unknown', success: true });
    workers[0].answer(0, { value: 5 });
    expect((await pending).value).toBe(5);
  });

  it.each(['error', 'messageerror'])('rejects everything open on %s and starts a fresh worker next time', async (event) => {
    const client = build();
    const first = reasonOf(client.request({ type: 'a' }));
    const second = reasonOf(client.request({ type: 'b' }));
    workers[0].emit(event);
    expect(await first).toBe('worker-error');
    expect(await second).toBe('worker-error');
    expect(workers[0].terminated).toBe(true);
    expect(problems).toHaveLength(1);

    const again = client.request({ type: 'c' });
    expect(workers).toHaveLength(2);
    workers[1].answer(0, { value: 9 });
    expect((await again).value).toBe(9);
  });

  it('rejects a request whose message cannot be sent, and keeps the worker', async () => {
    const client = build();
    const ok = client.request({ type: 'a' });
    workers[0].throwOnSend = new Error('DataCloneError');
    expect(await reasonOf(client.request({ type: 'b' }))).toBe('send-failed');
    workers[0].throwOnSend = null;
    workers[0].answer(0, { value: 1 });
    expect((await ok).value).toBe(1);
    expect(workers[0].terminated).toBe(false);
  });

  it('rejects on destroy, and a late answer from the stopped worker settles nothing', async () => {
    const client = build();
    const pending = reasonOf(client.request({ type: 'a' }));
    client.destroy();
    expect(await pending).toBe('destroyed');
    expect(workers[0].terminated).toBe(true);

    const next = client.request({ type: 'b' });
    // The old worker answers with an id the new request does not share.
    workers[0].emit('message', { id: workers[1].sent[0].id, success: true, value: 666 });
    workers[1].answer(0, { value: 1 });
    expect((await next).value).toBe(1);
  });

  it('times a request out, restarts the worker and fails the others with it', async () => {
    const client = build(1000);
    const slow = reasonOf(client.request({ type: 'a' }));
    await vi.advanceTimersByTimeAsync(600);
    const other = reasonOf(client.request({ type: 'b' }, undefined, { timeoutMs: 60_000 }));
    await vi.advanceTimersByTimeAsync(400);
    expect(await slow).toBe('timeout');
    expect(await other).toBe('worker-error');
    expect(workers[0].terminated).toBe(true);
  });

  it('does not time out a request that was answered', async () => {
    const client = build(1000);
    const pending = client.request({ type: 'a' });
    workers[0].answer(0);
    await pending;
    await vi.advanceTimersByTimeAsync(5000);
    expect(workers[0].terminated).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects when the worker cannot be created', async () => {
    const client = createWorkerRequests({
      createWorker: () => {
        throw new Error('no worker here');
      },
      name: 'test',
    });
    expect(await reasonOf(client.request({ type: 'a' }))).toBe('worker-error');
  });
});
