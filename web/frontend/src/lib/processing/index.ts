/**
 * Slide Extraction Pipeline — public exports.
 * Ported from autoslides/src/renderer/shared/processing/index.ts.
 */

export * from './types';
export { SlideExtractionPipeline } from './pipeline';
export { SlideExtractionManager, slideExtractionManager } from './manager';
export { SlideProcessorService, slideProcessorService } from './workerHelpers';
export { CanvasTaintedError } from './frameSource';
