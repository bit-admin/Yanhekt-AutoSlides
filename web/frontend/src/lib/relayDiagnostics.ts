/**
 * Is the public relay reachable from THIS browser?
 *
 * When the site streams recorded lectures straight from the relay's own origin
 * (`relay.mode === "direct"`), a viewer whose network that origin's edge does
 * not admit gets a challenge page instead of media, and hls.js reports nothing
 * more useful than a network error. `/cf.txt` on the relay is a 3-byte static
 * asset with CORS (see `relay/public/_headers`), so probing it separates the
 * two cases without costing a Worker request:
 *
 *   - readable `ok`  → the relay answers this browser; blame something else
 *   - rejected fetch → the request never got past the edge (a challenge page
 *                      carries no CORS headers), so it was challenged/blocked
 *
 * The probe sends no credentials, exactly like hls.js's segment requests — a
 * `cf_clearance` cookie from having visited the relay in a tab must not make
 * the probe pass where playback still fails.
 */

export type RelayReach = "reachable" | "blocked" | "unknown";

const PROBE_PATH = "/cf.txt";
const TIMEOUT_MS = 5000;

const cache = new Map<string, Promise<RelayReach>>();

async function probe(origin: string): Promise<RelayReach> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${origin}${PROBE_PATH}`, {
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
    });
    // A readable non-2xx is the edge turning us away (`cf-mitigated` on a
    // challenge); a readable 2xx means the relay itself answered.
    return res.ok ? "reachable" : "blocked";
  } catch (err) {
    // AbortError = we gave up waiting, which says nothing either way.
    return err instanceof DOMException && err.name === "AbortError" ? "unknown" : "blocked";
  } finally {
    clearTimeout(timer);
  }
}

/** Memoised per origin for the page's lifetime — the answer is a network fact. */
export function probeRelayReach(origin: string): Promise<RelayReach> {
  const key = origin.replace(/\/+$/, "");
  let pending = cache.get(key);
  if (!pending) {
    pending = probe(key);
    cache.set(key, pending);
  }
  return pending;
}
