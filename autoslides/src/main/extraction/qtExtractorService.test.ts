import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PassThrough } from 'stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const spawned = vi.hoisted(() => [] as Array<{ child: unknown; args: string[] }>);

vi.mock('child_process', () => ({
  spawn: (_binary: string, args: string[]) => {
    const child = new EventEmitter() as EventEmitter & {
      stdout: PassThrough; stderr: PassThrough; kill: (signal: string) => void; killed: string[];
    };
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.killed = [];
    child.kill = (signal) => void child.killed.push(signal);
    spawned.push({ child, args });
    return child;
  },
}));
vi.mock('electron', () => ({ dialog: {} }));
vi.mock('@main/infra/sharpService', () => ({ sharpService: {} }));
vi.mock('@main/infra/logger', () => ({ createLogger: () => ({ debug() {}, info() {}, warn() {}, error() {} }) }));

import { QtExtractorService, type QtExtractorStatus } from './qtExtractorService';
import type { ConfigService } from '@main/platform/configService';

type FakeChild = EventEmitter & { stdout: PassThrough; stderr: PassThrough; killed: string[] };
const childAt = (index: number) => spawned[index].child as FakeChild;
const params = { ssimThreshold: 0.99, enableDownsampling: true, downsampleWidth: 480, downsampleHeight: 270 };
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

let root: string;
let service: QtExtractorService;
let releaseProbe: ((status: QtExtractorStatus) => void) | null;

beforeEach(() => {
  spawned.length = 0;
  releaseProbe = null;
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'qt-extractor-'));
  const binary = path.join(root, 'extractor');
  const video = path.join(root, 'video.mp4');
  fs.writeFileSync(binary, '');
  fs.writeFileSync(video, '');
  const config = {
    getConfig: () => ({ outputDirectory: path.join(root, 'out') }),
    getQtExtractorConfig: () => ({ binaryPath: binary }),
  } as unknown as ConfigService;
  service = new QtExtractorService(config);
  vi.spyOn(service, 'verifyBinary').mockImplementation(
    () => new Promise<QtExtractorStatus>((resolve) => { releaseProbe = resolve; }),
  );
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

const start = (id: string, handlers = {}) =>
  service
    .runExtraction(id, path.join(root, 'video.mp4'), path.join(root, 'out', 'slides_a'), params, handlers)
    .then((result) => ({ result }), (error: Error) => ({ error: error.message }));
// Wait for the run to reach its version probe, then answer it.
const atProbe = () => vi.waitFor(() => expect(releaseProbe).not.toBeNull());
const probed = async () => {
  await atProbe();
  const answer = releaseProbe!;
  releaseProbe = null;
  answer({ ok: true, path: '', resolvedPath: '', version: '2.0.0' });
};
const spawnedCount = (n: number) => vi.waitFor(() => expect(spawned).toHaveLength(n));

describe('cancelling a Qt extraction', () => {
  it('starts no process when cancelled while the version is being read', async () => {
    const onCancelled = vi.fn();
    const run = start('job-1', { onCancelled });
    await atProbe();
    expect(service.isExtractionActive('job-1')).toBe(true);
    expect(service.cancelExtraction('job-1')).toBe(true);
    expect(service.cancelExtraction('job-1')).toBe(true);
    await probed();
    expect(await run).toEqual({ error: 'cancelled' });
    expect(spawned).toHaveLength(0);
    expect(onCancelled).toHaveBeenCalledTimes(1);
    expect(service.isExtractionActive('job-1')).toBe(false);
    expect(service.cancelExtraction('job-1')).toBe(false);
  });

  it('signals a running process, and a process killed outright still counts as cancelled', async () => {
    const run = start('job-2');
    await probed();
    await spawnedCount(1);
    expect(spawned).toHaveLength(1);
    expect(spawned[0].args).toContain('--write-timeline');
    service.cancelExtraction('job-2');
    expect(childAt(0).killed).toEqual(['SIGTERM']);
    childAt(0).emit('close', null);
    expect(await run).toEqual({ error: 'cancelled' });
  });

  it('completes an untouched run and leaves other runs alone when one is cancelled', async () => {
    const first = start('job-3');
    await probed();
    await spawnedCount(1);
    const second = start('job-4');
    await atProbe();
    service.cancelExtraction('job-4');
    await probed();
    expect(await second).toEqual({ error: 'cancelled' });
    expect(spawned).toHaveLength(1);

    childAt(0).stdout.write(`${JSON.stringify({ event: 'done', slidesDir: '/x', slideCount: 3 })}\n`);
    await tick();
    childAt(0).emit('close', 0);
    expect(await first).toEqual({ result: { slidesDir: '/x', slideCount: 3 } });
  });

  it('refuses a second run under an id that is still running', async () => {
    const first = start('job-5');
    await atProbe();
    expect(await start('job-5')).toEqual({ error: 'Extraction job-5 is already running' });
    service.cancelExtraction('job-5');
    await probed();
    await first;
  });
});

describe('finishing a Qt extraction', () => {
  it('counts a "done" line that arrives after the process exited but before its output closed', async () => {
    const run = start('job-6');
    await probed();
    await spawnedCount(1);
    childAt(0).emit('exit', 0);
    childAt(0).stdout.write(`${JSON.stringify({ event: 'done', slidesDir: '/x', slideCount: 2 })}\n`);
    await tick();
    childAt(0).emit('close', 0);
    expect(await run).toEqual({ result: { slidesDir: '/x', slideCount: 2 } });
  });

  it('settles once when the process both fails to run and closes', async () => {
    const run = start('job-7');
    await probed();
    await spawnedCount(1);
    childAt(0).emit('error', new Error('spawn EACCES'));
    childAt(0).emit('close', -2);
    expect(await run).toEqual({ error: 'spawn EACCES' });
    expect(service.isExtractionActive('job-7')).toBe(false);
  });
});

describe('cancelling before the version probe', () => {
  it('stops while the output folder is being checked, without probing', async () => {
    const run = start('job-8');
    service.cancelExtraction('job-8');
    expect(await run).toEqual({ error: 'cancelled' });
    expect(releaseProbe).toBeNull();
    expect(spawned).toHaveLength(0);
  });
});
