import type { SharePayload } from '../../autoslides/src/shared/shareLink';
import {
  buildCossListUrl,
  resolveShareImages,
  type ResolvedShareImage,
} from '../../autoslides/src/shared/shareResolve';

/** Re-export under the viewer's historical name. */
export type ResolvedImage = ResolvedShareImage;

/**
 * Browser/Worker folder lister: fetch each ListObjectsV2 page and pull the keys
 * out with DOMParser. Paginates via the S3 continuation token (mirrors
 * REFERENCE/coss-browser.html). The bucket is anonymously listable; we read with
 * credentials omitted.
 */
async function listFolder(prefix: string): Promise<Map<string, string>> {
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

/** Resolve a payload's short-hash image refs to full CDN URLs. */
export function resolveImages(payload: SharePayload): Promise<ResolvedImage[]> {
  return resolveShareImages(payload, listFolder);
}
