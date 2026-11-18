import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PassThrough } from 'stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  userData: '',
  get: vi.fn(),
  openPath: vi.fn(async () => ''),
}));

vi.mock('electron', () => ({ app: { getPath: () => h.userData }, shell: { openPath: h.openPath } }));
vi.mock('./http', () => ({ httpClient: { get: h.get }, isHttpError: () => false }));

import { FileDownloadService, checkDownloadHop } from './fileDownloadService';

let root: string;
let service: FileDownloadService;

const answer = (body: string, status = 200) => {
  const data = new PassThrough();
  setTimeout(() => data.end(body), 5);
  return { status, data, headers: { 'content-length': String(body.length) } };
};

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'file-download-'));
  h.userData = root;
  h.get.mockReset();
  h.openPath.mockReset();
  h.openPath.mockResolvedValue('');
  service = new FileDownloadService({ userAgent: 'test' });
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('downloading a file into the updates folder', () => {
  it('refuses a name that is not a bare file name', async () => {
    for (const name of ['../evil.exe', 'a/b.exe', 'a\\b.exe', '..', '', path.join(root, 'abs.exe')]) {
      await expect(service.downloadFile('https://github.com/x', name, () => {})).rejects.toThrow(/file name/);
    }
    expect(h.get).not.toHaveBeenCalled();
  });

  it('refuses an address that is not https, or that names this machine or a private network', async () => {
    for (const url of ['http://github.com/x', 'https://127.0.0.1/x', 'https://localhost/x', 'https://10.0.0.5/x', 'https://192.168.1.2/x', 'file:///etc/passwd']) {
      await expect(service.downloadFile(url, 'a.exe', () => {})).rejects.toThrow(/address/);
    }
    expect(() => checkDownloadHop(new URL('https://objects.githubusercontent.com/a'))).not.toThrow();
  });

  it('checks every redirect hop the same way', async () => {
    h.get.mockImplementation(async (_url: string, config: { beforeRedirect: (o: unknown) => void }) => {
      config.beforeRedirect({ protocol: 'http:', hostname: 'github.com', href: 'http://github.com/x' });
      return answer('never');
    });
    await expect(service.downloadFile('https://github.com/x', 'a.exe', () => {})).rejects.toThrow(/address/);
  });

  it('writes to a partial file and publishes the finished one under its name', async () => {
    h.get.mockResolvedValue(answer('installer'));
    const file = await service.downloadFile('https://github.com/x', 'a.exe', () => {});
    expect(fs.readFileSync(file, 'utf8')).toBe('installer');
    expect(fs.readdirSync(service.getUpdatesPath())).toEqual(['a.exe']);
  });

  it('runs one download at a time, and a cancelled old one cannot delete a newer file', async () => {
    let release!: () => void;
    h.get.mockImplementationOnce(async () => {
      const data = new PassThrough();
      release = () => data.end('first');
      return { status: 200, data, headers: {} };
    });
    const first = service.downloadFile('https://github.com/x', 'a.exe', () => {});
    await new Promise((r) => setTimeout(r, 5));
    await expect(service.downloadFile('https://github.com/y', 'b.exe', () => {})).rejects.toThrow(/already/);
    expect(service.cancelDownload()).toBe(true);
    release();
    await expect(first).rejects.toThrow();

    fs.writeFileSync(path.join(service.getUpdatesPath(), 'a.exe'), 'kept');
    h.get.mockResolvedValue(answer('second'));
    await service.downloadFile('https://github.com/x', 'b.exe', () => {});
    expect(fs.readFileSync(path.join(service.getUpdatesPath(), 'a.exe'), 'utf8')).toBe('kept');
  });

  it('reports an installer the system could not open as a failure', async () => {
    fs.writeFileSync(path.join(service.getUpdatesPath(), 'a.exe'), 'x');
    h.openPath.mockResolvedValue('No application knows how to open this file');
    await expect(service.installFile('a.exe')).rejects.toThrow(/No application/);
  });
});
