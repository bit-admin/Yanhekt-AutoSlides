import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@main/infra/logger', () => ({ createLogger: () => ({ debug() {}, info() {}, warn() {}, error() {} }) }));
import { abortableDelay, isAbortError, pipeToClient, requestLifetime } from './requestLifetime';
import { isYanhektMediaUrl } from './urlHelpers';
import type * as http from 'http';

function fakeRes() {
  const res = new PassThrough() as unknown as http.ServerResponse & EventEmitter & { writableFinished: boolean };
  return res;
}

describe('requestLifetime', () => {
  it('aborts when the player closes early, not after a finished answer', () => {
    const early = fakeRes();
    const signal = requestLifetime(early);
    early.emit('close');
    expect(signal.aborted).toBe(true);

    const done = fakeRes();
    const kept = requestLifetime(done);
    Object.defineProperty(done, 'writableFinished', { value: true });
    done.emit('close');
    expect(kept.aborted).toBe(false);
  });
});

describe('pipeToClient', () => {
  it('destroys the upstream body when the player hangs up', () => {
    const res = fakeRes();
    const body = new PassThrough();
    pipeToClient(res, body);
    res.emit('close');
    expect(body.destroyed).toBe(true);
  });

  it('closes the player connection when the upstream fails mid-way', () => {
    const res = fakeRes();
    const destroy = vi.spyOn(res, 'destroy');
    const body = new PassThrough();
    pipeToClient(res, body);
    body.destroy(new Error('reset'));
    return new Promise<void>((resolve) => setImmediate(() => {
      expect(destroy).toHaveBeenCalled();
      resolve();
    }));
  });
});

describe('abortableDelay', () => {
  it('ends a wait at once when aborted', async () => {
    const controller = new AbortController();
    const wait = abortableDelay(60_000, controller.signal).catch((error: unknown) => isAbortError(error));
    controller.abort();
    expect(await wait).toBe(true);
  });
});

describe('isYanhektMediaUrl', () => {
  it('takes Yanhekt hosts only', () => {
    expect(isYanhektMediaUrl('https://cvideo.yanhekt.cn/vod/a.m3u8')).toBe(true);
    expect(isYanhektMediaUrl('https://clive10.yanhekt.cn/live/x.m3u8')).toBe(true);
    expect(isYanhektMediaUrl('https://yanhekt.cn.evil.example/a')).toBe(false);
    expect(isYanhektMediaUrl('https://evilyanhekt.cn/a')).toBe(false);
    expect(isYanhektMediaUrl('http://127.0.0.1:8080/a')).toBe(false);
    expect(isYanhektMediaUrl('file:///etc/hosts')).toBe(false);
    expect(isYanhektMediaUrl('not a url')).toBe(false);
  });
});

