/**
 * Compatibility shim — the SSIM worker wrapper now lives under
 * `../processing/workerHelpers.ts`. Re-exported here so legacy imports keep
 * working during the refactor.
 *
 * New code should import from `../processing` instead.
 */

export { SlideProcessorService, slideProcessorService } from '../processing';
