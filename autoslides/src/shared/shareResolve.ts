/**
 * Share-link image resolver — the single source of truth for turning a share
 * payload's short md5 hashes back into full public CDN URLs.
 *
 * CANONICAL FILE. Imported by both the Cloudflare Worker viewer (`share/`) and
 * the AutoSlides app (main process, for "Paste from a share link" import), so the
 * matching rule (and the bucket-prefix URL fix) lives in exactly one place. The
 * S3 XML listing differs per platform — DOMParser in the browser/Worker, a small
 * regex in Node — so the lister is injected via `FolderLister`; everything else
 * (which folders to list, how to match, how to build the URL) is shared here.
 *
 * Depends only on `URL` (a global in every target runtime) and `./shareLink`.
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
 * Resolve every short-hash image reference in a payload to a full CDN URL by
 * listing each referenced folder once (via the injected `listFolder`) and
 * matching basenames by their short-hash prefix.
 */
export async function resolveShareImages(
  payload: SharePayload,
  listFolder: FolderLister,
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
          // S3 <Key> is bucket-relative (e.g. "2026/6/<hash>.png"); the public
          // object URL needs the bucket prefix: https://coss…/images/<key>.
          url = `${COSS_HOST}/images/${key}`;
          break;
        }
      }
    }
    return { index: ref.index, prefix: ref.prefix, short: ref.short, url };
  });
}
