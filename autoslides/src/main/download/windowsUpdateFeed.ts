// Where the Windows in-place updater looks for a release, and how its errors
// read. No Electron imports, so it is unit-tested.
const REPO = 'bit-admin/Yanhekt-AutoSlides';
const PROXY_PREFIX = 'https://gh-proxy.org/';

export type UpdateSource = 'github' | 'proxy';

export function windowsInstallerName(version: string): string {
  return `AutoSlides-Setup-${version}-Windows-x64.exe`;
}

/**
 * The release's download folder. electron-updater reads `latest.yml` here and
 * finds the old release's .blockmap by replacing the version in this path
 * (`v5.3.0/…5.3.0…` → `v5.2.0/…5.2.0…`), so the tag must stay `v<version>`.
 */
export function releaseDownloadBase(version: string, source: UpdateSource): string {
  const base = `https://github.com/${REPO}/releases/download/v${version}/`;
  return source === 'proxy' ? PROXY_PREFIX + base : base;
}

export function sourceOfUrl(url: string): UpdateSource {
  return url.startsWith(PROXY_PREFIX) ? 'proxy' : 'github';
}

/** Pulls the `update-signature:<reason>` code out of an electron-updater error. */
export function signatureCodeOf(message: string): string | null {
  return message.match(/update-signature:[a-z-]+/)?.[0] ?? null;
}
