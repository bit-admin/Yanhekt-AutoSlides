// Asia region pins for this relay. `scripts/stamp-placement.mjs` reads wrangler
// `placement.region` (or its absence) and writes `public/placement.json`.
// Cloudflare runs the isolate in the data center closest to that cloud region.
// For the regions below, that data center is the colo listed here.

export interface PlacementTarget {
  region: string;
  colo: string;
  city: string;
  /** Closest Cloudflare region to the Beijing recording origin. */
  closestToOrigin?: boolean;
}

export const RECORDING_ORIGIN = {
  host: 'cvideo.yanhekt.cn',
  address: '183.243.192.45',
  where: 'Beijing, China',
} as const;

/** Production pin first. The others are the reasonable Asia tests. */
export const ASIA_PLACEMENTS: readonly PlacementTarget[] = [
  { region: 'aws:ap-east-1', colo: 'HKG', city: 'Hong Kong', closestToOrigin: true },
  { region: 'aws:ap-northeast-2', colo: 'ICN', city: 'Seoul' },
  { region: 'aws:ap-northeast-1', colo: 'NRT', city: 'Tokyo' },
  { region: 'aws:ap-northeast-3', colo: 'KIX', city: 'Osaka' },
  { region: 'aws:ap-southeast-1', colo: 'SIN', city: 'Singapore' },
];

export interface StampedPlacement {
  /** False when wrangler has no placement.region. The Worker then runs in the edge city. */
  pinned: boolean;
  region: string | null;
  colo: string | null;
  city: string | null;
  closestToOrigin: boolean;
  closest: { region: string; colo: string; city: string };
  origin: { host: string; address: string; where: string };
}

function closestTarget(): PlacementTarget {
  const found = ASIA_PLACEMENTS.find((p) => p.closestToOrigin);
  if (!found) throw new Error('Asia placement list has no closestToOrigin entry');
  return found;
}

export function resolvePlacement(region: string | undefined | null): StampedPlacement {
  const closest = closestTarget();
  const shared = {
    closest: { region: closest.region, colo: closest.colo, city: closest.city },
    origin: {
      host: RECORDING_ORIGIN.host,
      address: RECORDING_ORIGIN.address,
      where: RECORDING_ORIGIN.where,
    },
  };
  const trimmed = (region ?? '').trim();
  if (!trimmed) {
    return { pinned: false, region: null, colo: null, city: null, closestToOrigin: false, ...shared };
  }
  const known = ASIA_PLACEMENTS.find((p) => p.region === trimmed);
  return {
    pinned: true,
    region: trimmed,
    colo: known ? known.colo : null,
    city: known ? known.city : null,
    closestToOrigin: !!known?.closestToOrigin,
    ...shared,
  };
}

/** Pull `placement.region` out of a wrangler jsonc file. Comments are ignored. */
export function readPlacementRegion(jsonc: string): string | null {
  const parsed: unknown = JSON.parse(stripJsonc(jsonc));
  if (!parsed || typeof parsed !== 'object') return null;
  const placement = (parsed as { placement?: unknown }).placement;
  if (!placement || typeof placement !== 'object') return null;
  const region = (placement as { region?: unknown }).region;
  if (typeof region !== 'string') return null;
  const trimmed = region.trim();
  return trimmed || null;
}

export function stripJsonc(text: string): string {
  let out = '';
  let i = 0;
  let inString = false;
  while (i < text.length) {
    const c = text[i];
    const next = text[i + 1];
    if (inString) {
      out += c;
      if (c === '\\') {
        out += next ?? '';
        i += 2;
        continue;
      }
      if (c === '"') inString = false;
      i += 1;
      continue;
    }
    if (c === '"') {
      inString = true;
      out += c;
      i += 1;
      continue;
    }
    if (c === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    out += c;
    i += 1;
  }
  return out.replace(/,\s*([}\]])/g, '$1');
}
