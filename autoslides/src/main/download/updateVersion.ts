/**
 * Compares dotted release versions ("5.2.0" vs "5.10.1"). A non-numeric part
 * (a "-beta" suffix) counts as 0, so a prerelease tag never reads as newer
 * than the release it precedes by accident of NaN.
 */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) => v.replace(/^v/, '').split(/[.-]/).map((p) => {
    const n = parseInt(p, 10);
    return Number.isFinite(n) ? n : 0;
  });
  const pa = parts(a);
  const pb = parts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}
