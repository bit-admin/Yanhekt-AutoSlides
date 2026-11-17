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
let releaseProbe: (status: QtExtractorStatus) => void;

beforeEach(() => {
  spawned.length = 0;
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
const probed = () => releaseProbe({ ok: true, path: '', resolvedPath: '', version: '2.0.0' });

describe('cancelling a Qt extraction', () => {
  it('starts no process when cancelled while the version is being read', async () => {
    const onCancelled = vi.fn();
    const run = start('job-1', { onCancelled });
    await tick();
    expect(service.isExtractionActive('job-1')).toBe(true);
    expect(service.cancelExtraction('job-1')).toBe(true);
    expect(service.cancelExtraction('job-1')).toBe(true);
    probed();
    expect(await run).toEqual({ error: 'cancelled' });
    expect(spawned).toHaveLength(0);
    expect(onCancelled).toHaveBeenCalledTimes(1);
    expect(service.isExtractionActive('job-1')).toBe(false);
    expect(service.cancelExtraction('job-1')).toBe(false);
  });

  it('signals a running process, and a process killed outright still counts as cancelled', async () => {
    const run = start('job-2');
    await tick();
    probed();
    await tick();
    expect(spawned).toHaveLength(1);
    expect(spawned[0].args).toContain('--write-timeline');
    service.cancelExtraction('job-2');
    expect(childAt(0).killed).toEqual(['SIGTERM']);
    childAt(0).emit('exit', null);
    expect(await run).toEqual({ error: 'cancelled' });
  });

  it('completes an untouched run and leaves other runs alone when one is cancelled', async () => {
    const first = start('job-3');
    await tick();
    probed();
    await tick();
    const second = start('job-4');
    await tick();
    service.cancelExtraction('job-4');
    probed();
    expect(await second).toEqual({ error: 'cancelled' });
    expect(spawned).toHaveLength(1);

    childAt(0).stdout.write(`${JSON.stringify({ event: 'done', slidesDir: '/x', slideCount: 3 })}\n`);
    await tick();
    childAt(0).emit('exit', 0);
    expect(await first).toEqual({ result: { slidesDir: '/x', slideCount: 3 } });
  });

  it('refuses a second run under an id that is still running', async () => {
    const first = start('job-5');
    await tick();
    expect(await start('job-5')).toEqual({ error: 'Extraction job-5 is already running' });
    service.cancelExtraction('job-5');
    probed();
    await first;
  });
});
