/**
 * Minimal dotted-numeric version helpers (no prerelease/build metadata).
 * Accepts optional leading "v"/"V". Non-numeric segments coerce to 0.
 */

function parseParts(version: string | null | undefined): number[] {
  const cleaned = String(version ?? '')
    .trim()
    .replace(/^[vV]/, '')
    .split(/[-+]/)[0]; // drop prerelease/build if present
  if (!cleaned) return [0];
  return cleaned.split('.').map(part => {
    const n = parseInt(part, 10);
    return Number.isFinite(n) ? n : 0;
  });
}

/** Compare a and b: -1 if a < b, 0 if equal, 1 if a > b. */
export function compareSemver(
  a: string | null | undefined,
  b: string | null | undefined
): number {
  const pa = parseParts(a);
  const pb = parseParts(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

export function semverGte(
  version: string | null | undefined,
  minimum: string
): boolean {
  return compareSemver(version, minimum) >= 0;
}

export function semverLt(
  version: string | null | undefined,
  minimum: string
): boolean {
  return compareSemver(version, minimum) < 0;
}
