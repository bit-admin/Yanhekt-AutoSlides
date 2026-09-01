/**
 * Share-link image resolver — ported from CANONICAL
 * `autoslides/src/shared/shareResolve.ts` plus the browser folder lister in
 * `share/src/resolver.ts`. The web player must resolve slides against public
 * COSS from the browser (no share Worker, no learn Worker).
 *
 * Keep in sync with the desktop module: listing URL, basename prefix-match,
 * and `https://coss.yanhekt.cn/images/${key}` URL shape.
 */

import { shareImageRefs, type SharePayload } from './shareLink';

/** Public host of the anonymously-listable coss `images` bucket. */
export const COSS_HOST = 'https://coss.yanhekt.cn';

export interface ResolvedShareImage {
  index: number;
  prefix: string;
  short: string;
  /** Full CDN URL, or null if the short hash couldn't be resolved. */
  url: string | null;
}

/** Lists one `YYYY/M` folder → map of `<basename>` → bucket-relative `<key>`. */
export type FolderLister = (prefix: string) => Promise<Map<string, string>>;

/** Build the S3 ListObjectsV2 URL for one page of a folder listing. */
export function buildCossListUrl(prefix: string, token: string | null): string {
  const normalized = prefix.endsWith('/') ? prefix : `${prefix}/`;
  const u = new URL(`${COSS_HOST}/images`);
  u.searchParams.set('list-type', '2');
  u.searchParams.set('prefix', normalized);
  u.searchParams.set('max-keys', '1000');
  if (token) u.searchParams.set('continuation-token', token);
  return u.toString();
}

/**
 * Browser folder lister: fetch each ListObjectsV2 page and pull the keys out
 * with DOMParser. The bucket is anonymously listable; credentials omitted.
 */
export async function listCossFolder(prefix: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let token: string | null = null;

  do {
    const res = await fetch(buildCossListUrl(prefix, token), { credentials: 'omit' });
    if (!res.ok) break;
    const doc = new DOMParser().parseFromString(await res.text(), 'application/xml');

    for (const node of Array.from(doc.querySelectorAll('Contents'))) {
      const key = node.querySelector('Key')?.textContent ?? '';
      if (!key) continue;
      const base = key.split('/').pop() ?? '';
      if (base) map.set(base, key);
    }

    const truncated = doc.querySelector('IsTruncated')?.textContent === 'true';
    token = truncated ? (doc.querySelector('NextContinuationToken')?.textContent ?? null) : null;
  } while (token);

  return map;
}

/**
 * Resolve every short-hash image reference in a payload to a full CDN URL by
 * listing each referenced folder once and matching basenames by short-hash prefix.
 */
export async function resolveShareImages(
  payload: SharePayload,
  listFolder: FolderLister = listCossFolder,
): Promise<ResolvedShareImage[]> {
  const refs = shareImageRefs(payload);
  const prefixes = [...new Set(refs.map((r) => r.prefix))];

  const folders = new Map<string, Map<string, string>>();
  await Promise.all(
    prefixes.map(async (prefix) => {
      folders.set(prefix, await listFolder(prefix));
    }),
  );

  return refs.map((ref) => {
    const folder = folders.get(ref.prefix);
    let url: string | null = null;
    if (folder) {
      for (const [base, key] of folder) {
        if (base.startsWith(ref.short)) {
          url = `${COSS_HOST}/images/${key}`;
          break;
        }
      }
    }
    return { index: ref.index, prefix: ref.prefix, short: ref.short, url };
  });
}

export type ShareFragmentError = 'not-found' | 'unavailable' | 'failed';

/**
 * Resolve a short-link id to its payload fragment via this origin's Worker
 * (`GET /api/share/get`), which service-binds the sibling share Worker. The
 * browser never talks to share.ruc.edu.kg.
 */
export async function fetchShareFragment(
  shortId: string,
): Promise<{ fragment: string } | { error: ShareFragmentError }> {
  try {
    const res = await fetch(`/api/share/get?id=${encodeURIComponent(shortId)}`);
    if (res.status === 404) return { error: 'not-found' };
    if (res.status === 503) return { error: 'unavailable' };
    if (!res.ok) return { error: 'failed' };
    const data = (await res.json()) as { fragment?: unknown };
    if (typeof data.fragment !== 'string' || data.fragment.length === 0) {
      return { error: 'failed' };
    }
    return { fragment: data.fragment };
  } catch {
    return { error: 'failed' };
  }
}
