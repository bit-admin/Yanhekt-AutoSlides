/**
 * Bindings available to the AutoSlides Web Worker.
 *
 * - ASSETS: static-assets fetcher serving the frontend in ./public.
 * - SSO_RESUME_KEY: key the Worker seals the mid-login state of an SMS second
 *   factor with (see lib/resumeSeal.ts). Not a campus or Cloudflare credential —
 *   just a random string this Worker encrypts to itself with. Supplied by the
 *   `vars` block of the gitignored wrangler configs. Optional: with nothing
 *   bound, password login still works but cannot complete an SMS challenge, and
 *   the frontend falls back to the token-paste flow.
 * - RELAY: optional service binding to the sibling recorded-HLS Worker.
 *   Unset → `/playlist`/`/segment` 503.
 * - ALLOW_OFFCAMPUS_RELAY / RELAY_PUBLIC_ORIGIN: the relay policy (see
 *   lib/relayPolicy.ts). Off-campus relaying through this Worker is opt-in;
 *   without it the browser is sent to the public relay origin instead and the
 *   same-origin routes are closed.
 * - SHARE: optional service binding to the sibling share Worker.
 *   Unset → `/api/share/*` 503.
 * - AI_ORIGIN: origin this Worker fetches for `/api/ai/*`. Unset → 503.
 */
export interface Env {
  ASSETS: Fetcher;
  SSO_RESUME_KEY?: string;
  /** Sibling recorded-HLS Worker. Unset → `/playlist`/`/segment` 503. */
  RELAY?: Fetcher;
  /**
   * `"true"` lets browsers on any network stream recorded video through this
   * Worker's RELAY binding (a Worker-to-Worker hop, so the relay's own edge
   * protection never sees the viewer). Anything else — including unset, the
   * default — closes `/playlist`/`/segment` and points the SPA at
   * RELAY_PUBLIC_ORIGIN instead.
   */
  ALLOW_OFFCAMPUS_RELAY?: string;
  /**
   * Public origin of the relay (`https://…`, no path). What the SPA streams
   * from when off-campus relaying is not allowed, so each viewer meets the
   * relay's own edge protection directly. Unset → no gate to enforce, so the
   * binding stays in use.
   */
  RELAY_PUBLIC_ORIGIN?: string;
  /** Sibling share Worker. Unset → `/api/share/*` 503. */
  SHARE?: Fetcher;
  /** Builtin AI origin (`https://…`, no trailing path). Unset → `/api/ai/*` 503. */
  AI_ORIGIN?: string;
}
