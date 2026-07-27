/**
 * Custom progressive-media scheme for local lecture files.
 *
 * Shape: asmedia://local/<encodeURIComponent(absolutePath)>
 * Paths may contain Chinese, spaces, and Emby brackets — keep them fully
 * encoded in a single path segment (never as host).
 */

export const ASMEDIA_SCHEME = 'asmedia';
export const ASMEDIA_HOST = 'local';

/** Build a renderer-safe media URL for an absolute filesystem path. */
export function toAsmediaUrl(absolutePath: string): string {
  const abs = String(absolutePath || '').trim();
  if (!abs) {
    throw new Error('toAsmediaUrl: empty path');
  }
  return `${ASMEDIA_SCHEME}://${ASMEDIA_HOST}/${encodeURIComponent(abs)}`;
}

/**
 * Extract the absolute path from an asmedia URL.
 * Returns null when the URL is not a valid asmedia local URL.
 */
export function fromAsmediaUrl(url: string): string | null {
  const raw = String(url || '').trim();
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== `${ASMEDIA_SCHEME}:`) return null;
    if (parsed.hostname !== ASMEDIA_HOST) return null;

    // Path is "/<encoded>"; strip leading slash(es).
    let encoded = parsed.pathname || '';
    if (encoded.startsWith('/')) encoded = encoded.slice(1);
    // Some stacks leave a trailing slash only — reject empty.
    if (!encoded) return null;

    // pathname may still have percent-encoding; decode once.
    const decoded = decodeURIComponent(encoded);
    return decoded || null;
  } catch {
    // Fallback for environments without full URL parsing of custom schemes.
    const prefix = `${ASMEDIA_SCHEME}://${ASMEDIA_HOST}/`;
    if (!raw.startsWith(prefix)) return null;
    try {
      return decodeURIComponent(raw.slice(prefix.length)) || null;
    } catch {
      return null;
    }
  }
}
