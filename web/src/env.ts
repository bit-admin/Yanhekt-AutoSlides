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
 * - AI_ORIGIN: origin this Worker fetches for `/api/ai/*`. Unset → 503.
 */
export interface Env {
  ASSETS: Fetcher;
  SSO_RESUME_KEY?: string;
  /** Sibling recorded-HLS Worker. Unset → `/playlist`/`/segment` 503. */
  RELAY?: Fetcher;
  /** Builtin AI origin (`https://…`, no trailing path). Unset → `/api/ai/*` 503. */
  AI_ORIGIN?: string;
}
