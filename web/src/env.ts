/**
 * Bindings available to the AutoSlides Web Worker.
 *
 * - ASSETS: static-assets fetcher serving the frontend in ./public.
 */
export interface Env {
  ASSETS: Fetcher;
}
