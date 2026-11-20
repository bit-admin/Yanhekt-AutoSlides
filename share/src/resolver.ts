import type { SharePayload } from './lib/shareLink';
import { demoHooks } from './lib/demoRegistry';
import {
  buildCossListUrl,
  resolveShareImages,
  type ResolvedShareImage,
} from './lib/shareResolve';

/** Re-export under the viewer's historical name. */
export type ResolvedImage = ResolvedShareImage;

/**
 * List public COSS keys in the browser with DOMParser, paginating with the S3
 * continuation token. With `onlyHash` (the folder's one distinct hash, chosen
 * by the shared resolver) one page holding the first match is enough.
 */
async function listFolder(prefix: string, onlyHash?: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let token: string | null = null;

  do {
    const res = await fetch(new URL(buildCossListUrl(prefix, token, onlyHash)), { credentials: 'omit' });
    if (!res.ok) break;
    const doc = new DOMParser().parseFromString(await res.text(), 'application/xml');

    for (const node of Array.from(doc.querySelectorAll('Contents'))) {
      const key = node.querySelector('Key')?.textContent ?? '';
      if (!key) continue;
      const base = key.split('/').pop() ?? '';
      if (base) map.set(base, key);
    }

    if (onlyHash) break;
    const truncated = doc.querySelector('IsTruncated')?.textContent === 'true';
    token = truncated ? (doc.querySelector('NextContinuationToken')?.textContent ?? null) : null;
  } while (token);

  return map;
}

/** Resolve a payload's short-hash image refs to full CDN URLs. */
export function resolveImages(payload: SharePayload): Promise<ResolvedImage[]> {
  // Slide pixels reach the page through <img src> and new Image(), neither of
  // which the demo's fetch stub can see — so the demo substitutes the whole
  // resolver rather than the bucket listing.
  if (__DEMO__ && demoHooks.resolveImages) return demoHooks.resolveImages(payload);
  return resolveShareImages(payload, listFolder);
}
