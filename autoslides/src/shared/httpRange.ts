/**
 * Parse a single HTTP Range header value for progressive media.
 * Returns null when absent/unrecognised, 'unsatisfiable' for 416 cases.
 */
export function parseHttpRange(
  header: string | null,
  size: number,
): { start: number; end: number } | 'unsatisfiable' | null {
  if (!header) return null;
  // Single range only (what <video> sends): bytes=start-end | bytes=start- | bytes=-suffix
  const m = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (!m) return null;

  const hasStart = m[1] !== '';
  const hasEnd = m[2] !== '';
  if (!hasStart && !hasEnd) return null;

  let start: number;
  let end: number;

  if (!hasStart && hasEnd) {
    // bytes=-N → last N bytes
    const suffix = Number(m[2]);
    if (!Number.isFinite(suffix) || suffix <= 0) return 'unsatisfiable';
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = hasEnd ? Number(m[2]) : size - 1;
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0) {
    return 'unsatisfiable';
  }
  if (start >= size) return 'unsatisfiable';
  if (end >= size) end = size - 1;
  if (end < start) return 'unsatisfiable';
  return { start, end };
}
