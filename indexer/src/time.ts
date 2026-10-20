/**
 * Beijing-time helpers. China has no DST, so a fixed +8h offset is exact.
 * Yanhekt timestamps (`started_at`, …) are Beijing wall-clock strings.
 */

const CN_OFFSET_MS = 8 * 3600_000;
const DAY_MS = 24 * 3600_000;

/** `YYYY-MM-DD HH:MM:SS` in Beijing time — the format Yanhekt uses. */
export function cnClock(nowMs: number): string {
  return new Date(nowMs + CN_OFFSET_MS).toISOString().slice(0, 19).replace('T', ' ');
}

function cnMinuteOfDay(nowMs: number): number {
  const d = new Date(nowMs + CN_OFFSET_MS);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** Epoch ms of Beijing midnight that starts the Beijing day containing `nowMs`. */
function cnMidnightMs(nowMs: number): number {
  const shifted = nowMs + CN_OFFSET_MS;
  return shifted - (((shifted % DAY_MS) + DAY_MS) % DAY_MS) - CN_OFFSET_MS;
}

/** Is `nowMs` inside the Beijing-time window [startHour, endHour)? Wraps midnight when start > end. */
export function inWindow(nowMs: number, startHour: number, endHour: number): boolean {
  if (startHour === endHour) return false;
  const m = cnMinuteOfDay(nowMs);
  const s = startHour * 60;
  const e = endHour * 60;
  return s < e ? m >= s && m < e : m >= s || m < e;
}

/** End of the window `nowMs` is in (epoch ms). Only meaningful when `inWindow` is true. */
export function windowEndMs(nowMs: number, startHour: number, endHour: number): number {
  const midnight = cnMidnightMs(nowMs);
  let end = midnight + endHour * 3600_000;
  // Wrapping window, and we are in the part before midnight: the end is tomorrow.
  if (startHour > endHour && cnMinuteOfDay(nowMs) >= startHour * 60) end += DAY_MS;
  return end;
}

/** Next window start strictly after `nowMs` (epoch ms). */
export function nextWindowStartMs(nowMs: number, startHour: number): number {
  let start = cnMidnightMs(nowMs) + startHour * 3600_000;
  if (start <= nowMs) start += DAY_MS;
  return start;
}
