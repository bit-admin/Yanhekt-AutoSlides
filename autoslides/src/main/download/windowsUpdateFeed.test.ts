import { describe, it, expect } from 'vitest';
import { Provider } from 'electron-updater/out/providers/Provider';
import {
  releaseDownloadBase,
  signatureCodeOf,
  sourceOfUrl,
  windowsInstallerName,
} from './windowsUpdateFeed';

describe('windowsUpdateFeed', () => {
  it('builds the release folder on GitHub and through the proxy', () => {
    expect(releaseDownloadBase('5.3.0', 'github'))
      .toBe('https://github.com/bit-admin/Yanhekt-AutoSlides/releases/download/v5.3.0/');
    expect(releaseDownloadBase('5.3.0', 'proxy'))
      .toBe('https://gh-proxy.org/https://github.com/bit-admin/Yanhekt-AutoSlides/releases/download/v5.3.0/');
  });

  it('tells the proxy from GitHub by URL', () => {
    expect(sourceOfUrl('https://gh-proxy.org/https://github.com/x/y.exe')).toBe('proxy');
    expect(sourceOfUrl('https://github.com/x/y.exe')).toBe('github');
  });

  it('finds the old release blockmap for a differential download', async () => {
    // electron-updater derives the old blockmap URL by swapping versions in
    // the new file's path; it must land in the old release's folder.
    for (const source of ['github', 'proxy'] as const) {
      const url = new URL(windowsInstallerName('5.3.0'), releaseDownloadBase('5.3.0', source));
      const [oldMap, newMap] = await Provider.prototype.getBlockMapFiles.call(null, url, '5.2.0', '5.3.0');
      expect(newMap.href).toBe(url.href + '.blockmap');
      expect(oldMap.href).toBe(
        new URL(windowsInstallerName('5.2.0'), releaseDownloadBase('5.2.0', source)).href + '.blockmap'
      );
    }
  });

  it('extracts the signature code from electron-updater\'s wrapped error', () => {
    const wrapped = 'New version 5.3.0 is not signed by the application owner: update-signature:mismatch';
    expect(signatureCodeOf(wrapped)).toBe('update-signature:mismatch');
    expect(signatureCodeOf('net::ERR_CONNECTION_RESET')).toBeNull();
  });
});
