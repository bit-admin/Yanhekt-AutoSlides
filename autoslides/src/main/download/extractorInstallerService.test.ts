import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dirs = vi.hoisted(() => ({ userData: '', home: '' }));

vi.mock('electron', () => ({
  app: { getPath: () => dirs.userData },
  shell: { openPath: vi.fn(async () => ''), showItemInFolder: vi.fn() },
}));
vi.mock('os', async (importOriginal) => {
  const real = await importOriginal<typeof import('os')>();
  return { ...real, homedir: () => dirs.home };
});

import { shell } from 'electron';
import { ExtractorInstallerService } from './extractorInstallerService';

const realPlatform = process.platform;
const asPlatform = (platform: string) => Object.defineProperty(process, 'platform', { value: platform });

const RELEASE_ASSETS = [
  'AutoSlides.Extractor-2.1.0-Linux-x86_64-Portable.tar.gz',
  'AutoSlides.Extractor-2.1.0-Linux-x86_64.AppImage',
  'AutoSlides.Extractor-2.1.0-Linux-x86_64.deb',
  'AutoSlides.Extractor-2.1.0-macOS-arm64.dmg',
  'AutoSlides.Extractor-2.1.0-Windows-x64-Portable.zip',
  'AutoSlides.Extractor-2.1.0-Windows-x64-Setup.exe',
].map((name) => ({ name, browser_download_url: `https://example.invalid/${name}`, size: 1 }));

describe('ExtractorInstallerService', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'extractor-installer-'));
    dirs.userData = path.join(root, 'userData');
    dirs.home = path.join(root, 'home');
  });

  afterEach(() => {
    asPlatform(realPlatform);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('offers the .deb, then the AppImage, on Linux', () => {
    asPlatform('linux');
    const names = new ExtractorInstallerService().getAssetsForPlatform(RELEASE_ASSETS).map((a) => a.name);
    expect(names).toEqual([
      'AutoSlides.Extractor-2.1.0-Linux-x86_64.deb',
      'AutoSlides.Extractor-2.1.0-Linux-x86_64.AppImage',
    ]);
  });

  it('keeps one installer per platform on macOS and Windows', () => {
    asPlatform('darwin');
    expect(new ExtractorInstallerService().getAssetsForPlatform(RELEASE_ASSETS).map((a) => a.name))
      .toEqual(['AutoSlides.Extractor-2.1.0-macOS-arm64.dmg']);
    asPlatform('win32');
    expect(new ExtractorInstallerService().getAssetsForPlatform(RELEASE_ASSETS).map((a) => a.name))
      .toEqual(['AutoSlides.Extractor-2.1.0-Windows-x64-Setup.exe']);
  });

  it('copies the AppImage into ~/Applications as an executable, replacing the old one', async () => {
    const service = new ExtractorInstallerService();
    const name = 'AutoSlides.Extractor-2.1.0-Linux-x86_64.AppImage';
    fs.writeFileSync(path.join(service.getUpdatesPath(), name), 'new');
    const target = path.join(dirs.home, 'Applications', 'AutoSlides-Extractor.AppImage');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, 'old');

    const result = await service.installInstaller(name);

    expect(result).toMatchObject({ kind: 'appImage', installedPath: target });
    expect(fs.readFileSync(target, 'utf8')).toBe('new');
    expect(fs.statSync(target).mode & 0o111).toBe(0o111);
    expect(fs.existsSync(`${target}.download`)).toBe(false);
    expect(shell.openPath).not.toHaveBeenCalled();
  });

  it('opens a .deb with the system', async () => {
    const service = new ExtractorInstallerService();
    const name = 'AutoSlides.Extractor-2.1.0-Linux-x86_64.deb';
    fs.writeFileSync(path.join(service.getUpdatesPath(), name), 'deb');

    const result = await service.installInstaller(name);

    expect(result).toEqual({ kind: 'opened', filePath: path.join(service.getUpdatesPath(), name) });
    expect(shell.openPath).toHaveBeenCalledWith(path.join(service.getUpdatesPath(), name));
  });

  it('refuses names that are not an Extractor installer', async () => {
    const service = new ExtractorInstallerService();
    await expect(service.installInstaller('../evil.AppImage')).rejects.toThrow(/Not an AutoSlides Extractor installer/);
    await expect(service.installInstaller('AutoSlides.Extractor-2.1.0-Linux-x86_64-Portable.tar.gz')).rejects.toThrow();
  });

  it('downloads only an offered installer, from its own address or the proxy copy', async () => {
    asPlatform('darwin');
    const service = new ExtractorInstallerService();
    const download = vi.spyOn(service, 'downloadFile').mockImplementation(async (_url, name) => {
      const file = path.join(service.getUpdatesPath(), name);
      fs.writeFileSync(file, 'x');
      return file;
    });
    const name = 'AutoSlides.Extractor-2.1.0-macOS-arm64.dmg';
    await expect(service.downloadInstaller(`https://example.invalid/${name}`, name, () => {})).rejects.toThrow(/offered/);

    service.rememberOffered(service.getAssetsForPlatform(RELEASE_ASSETS));
    await expect(service.downloadInstaller('https://elsewhere.invalid/x.dmg', name, () => {})).rejects.toThrow(/does not belong/);
    await expect(service.downloadInstaller(`https://example.invalid/${name}`, '../x.dmg', () => {})).rejects.toThrow(/offered/);
    await service.downloadInstaller(`https://gh-proxy.org/https://example.invalid/${name}`, name, () => {});
    expect(download).toHaveBeenCalledTimes(1);
  });

  it('throws away a download whose size differs from the release', async () => {
    asPlatform('darwin');
    const service = new ExtractorInstallerService();
    const name = 'AutoSlides.Extractor-2.1.0-macOS-arm64.dmg';
    service.rememberOffered([{ name, browser_download_url: `https://example.invalid/${name}`, size: 5 }]);
    vi.spyOn(service, 'downloadFile').mockImplementation(async (_url, file) => {
      const target = path.join(service.getUpdatesPath(), file);
      fs.writeFileSync(target, 'too long a file');
      return target;
    });
    await expect(service.downloadInstaller(`https://example.invalid/${name}`, name, () => {})).rejects.toThrow(/release lists 5/);
    expect(fs.existsSync(path.join(service.getUpdatesPath(), name))).toBe(false);
  });

  it('reports an installer the system would not open as a failure', async () => {
    const service = new ExtractorInstallerService();
    const name = 'AutoSlides.Extractor-2.1.0-Linux-x86_64.deb';
    fs.writeFileSync(path.join(service.getUpdatesPath(), name), 'deb');
    vi.mocked(shell.openPath).mockResolvedValueOnce('no handler');
    await expect(service.installInstaller(name)).rejects.toThrow('no handler');
  });
});
