import { shareImageRefs, type SharePayload } from '../../autoslides/src/shared/shareLink';

const HOST = 'https://coss.yanhekt.cn';

export interface ResolvedImage {
  index: number;
  prefix: string;
  short: string;
  /** Full CDN URL, or null if the short hash couldn't be resolved. */
  url: string | null;
}

/**
 * List every object basename under a `YYYY/M` folder of the public `images`
 * bucket → map of `<basename>` → `<full key>`. Paginates via the S3
 * continuation token (mirrors REFERENCE/coss-browser.html). The bucket is
 * anonymously listable; we read with credentials omitted.
 */
async function listFolder(prefix: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const normalized = prefix.endsWith('/') ? prefix : `${prefix}/`;
  let token: string | null = null;

  do {
    const u = new URL(`${HOST}/images`);
    u.searchParams.set('list-type', '2');
    u.searchParams.set('prefix', normalized);
    u.searchParams.set('max-keys', '1000');
    if (token) u.searchParams.set('continuation-token', token);

    const res = await fetch(u.toString(), { credentials: 'omit' });
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
 * listing each referenced folder once and matching basenames by prefix.
 */
export async function resolveImages(payload: SharePayload): Promise<ResolvedImage[]> {
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
          url = `${HOST}/images/${key}`;
          break;
        }
      }
    }
    return { index: ref.index, prefix: ref.prefix, short: ref.short, url };
  });
}
