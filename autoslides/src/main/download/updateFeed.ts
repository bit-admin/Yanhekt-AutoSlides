// Where the in-place updaters (Windows: electron-updater, macOS: Sparkle) look
// for a release, and how their errors read. No Electron imports, so it is
// unit-tested.
const REPO = 'bit-admin/Yanhekt-AutoSlides';
const PROXY_PREFIX = 'https://gh-proxy.org/';

export type UpdateSource = 'github' | 'proxy';

export function windowsInstallerName(version: string): string {
  return `AutoSlides-Setup-${version}-Windows-x64.exe`;
}

export function macDmgName(version: string): string {
  return `AutoSlides-${version}-macOS-arm64.dmg`;
}

/** Sparkle's feed: one per release, naming its files relative to itself. */
export const MAC_APPCAST_NAME = 'appcast.xml';

/**
 * The release's download folder. electron-updater reads `latest.yml` here and
 * finds the old release's .blockmap by replacing the version in this path
 * (`v5.3.0/…5.3.0…` → `v5.2.0/…5.2.0…`), so the tag must stay `v<version>`.
 * Sparkle reads `appcast.xml` here and resolves its file names against it.
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

// Sparkle's SUSparkleErrorDomain codes for an archive whose EdDSA signature
// or code signature does not check out (SUErrors.h).
const SPARKLE_SIGNATURE_CODES = new Set([3001, 3002]);
const SPARKLE_NO_UPDATE = 1001;

/** Maps a Sparkle error to the message the update dialog shows. */
export function sparkleErrorMessage(error: { domain?: string; code?: number; message?: string }): string {
  if (error.domain === 'SUSparkleErrorDomain') {
    if (error.code !== undefined && SPARKLE_SIGNATURE_CODES.has(error.code)) return 'update-signature:mismatch';
    if (error.code === SPARKLE_NO_UPDATE) return 'The release feed offers no newer version';
  }
  return error.message || `Sparkle error ${error.code ?? ''}`.trim();
}
