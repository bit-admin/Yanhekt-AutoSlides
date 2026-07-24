/**
 * Bindings available to the AutoSlides Web Worker.
 *
 * - ASSETS: static-assets fetcher serving the frontend in ./public.
 * - SSO_RESUME_KEY: secret used to seal the mid-login state of an SMS
 *   second factor (see lib/resumeSeal.ts). Optional — with no secret bound,
 *   password login still works but cannot complete an SMS challenge, and the
 *   frontend falls back to the token-paste flow. Set it with
 *   `wrangler secret put SSO_RESUME_KEY`.
 */
export interface Env {
  ASSETS: Fetcher;
  SSO_RESUME_KEY?: string;
}
