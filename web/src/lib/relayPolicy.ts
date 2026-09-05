/**
 * Where recorded HLS is streamed from, and who is allowed to stream it.
 *
 * Two ways to reach the sibling relay:
 *
 *   binding — the browser asks THIS origin (`/playlist`, `/segment`) and the
 *             Worker forwards over the RELAY service binding. That hop is
 *             Worker-to-Worker, so the relay's own edge protection (its
 *             campus-network allowlist) never sees the viewer: everyone,
 *             anywhere, plays.
 *   direct  — the SPA streams from the relay's public origin, so every viewer
 *             meets that edge protection themselves. Viewers off the allowed
 *             networks may be challenged or blocked there.
 *
 * `direct` is the default: relaying off-campus viewers through this Worker is
 * opt-in (`ALLOW_OFFCAMPUS_RELAY: "true"`). In `direct` mode the same-origin
 * routes are closed (403) — otherwise a hand-written same-origin URL would
 * walk straight around the gate.
 *
 * A deployment with no RELAY_PUBLIC_ORIGIN has nowhere to send a browser, so
 * it keeps using the binding whatever the flag says.
 */
import type { Env } from "../env";

export type RelayMode = "binding" | "direct";

/** Discriminated so `direct` always carries the origin the SPA must use. */
export type RelayPolicy = { mode: "binding" } | { mode: "direct"; origin: string };

/** Networks the relay's edge protection is expected to admit (informational). */
export const CAMPUS_ASNS: readonly number[] = [
  4847, // China Networks Inter-Exchange (DSL, MOBILE, BIZNET, EYEBALL)
  23910, // China Next Generation Internet CERNET2 (IPv6)
];

export function isCampusAsn(asn: number | undefined): boolean {
  return typeof asn === "number" && CAMPUS_ASNS.includes(asn);
}

/** `https://host[:port]` with no path, or null when unusable. */
function normalizeOrigin(raw: string | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function resolveRelayPolicy(env: Env): RelayPolicy {
  if ((env.ALLOW_OFFCAMPUS_RELAY ?? "").trim().toLowerCase() === "true") {
    return { mode: "binding" };
  }
  const origin = normalizeOrigin(env.RELAY_PUBLIC_ORIGIN);
  return origin ? { mode: "direct", origin } : { mode: "binding" };
}
