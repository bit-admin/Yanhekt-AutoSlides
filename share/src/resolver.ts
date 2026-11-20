import { shareImageRefs, type SharePayload } from './lib/shareLink';
import { demoHooks } from './lib/demoRegistry';
import {
  buildCossListUrl,
  resolveShareImages,
  type ResolvedShareImage,
} from './lib/shareResolve';

/** Re-export under the viewer's historical name. */
export type ResolvedImage = ResolvedShareImage;

/** List public COSS keys in the browser; a single hash only needs the first match. */
async function listFolder(prefix: string, singleHash?: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let token: string | null = null;

  do {
    const url: URL = new URL(buildCossListUrl(prefix, token));
    if (singleHash) {
      // S3 filters the full key: append the hash to the slash-terminated folder.
      url.searchParams.set('prefix', `${url.searchParams.get('prefix')}${singleHash}`);
      url.searchParams.set('max-keys', '1');
    }
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) break;
    const doc = new DOMParser().parseFromString(await res.text(), 'application/xml');

    for (const node of Array.from(doc.querySelectorAll('Contents'))) {
      const key = node.querySelector('Key')?.textContent ?? '';
      if (!key) continue;
      const base = key.split('/').pop() ?? '';
      if (base) map.set(base, key);
    }

    if (singleHash) break;
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

  // For a folder with multiple distinct hashes, sharing one listing avoids
  // making the request count grow with the number of slides.
  const hashesByFolder = new Map<string, Set<string>>();
  for (const { prefix, short } of shareImageRefs(payload)) {
    const hashes = hashesByFolder.get(prefix) ?? new Set<string>();
    hashes.add(short);
    hashesByFolder.set(prefix, hashes);
  }
  return resolveShareImages(payload, (prefix) => {
    const hashes = hashesByFolder.get(prefix);
    const hash = hashes?.size === 1 ? hashes.values().next().value : undefined;
    return listFolder(prefix, hash && /^[0-9a-f]+$/.test(hash) ? hash : undefined);
  });
}
