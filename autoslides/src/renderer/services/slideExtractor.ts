/**
 * Compatibility shim — the slide extraction pipeline now lives under
 * `../processing/`. This file re-exports the public surface so existing
 * imports (`from '../services/slideExtractor'`) keep working during the
 * refactor.
 *
 * New code should import from `../processing` instead.
 */

export {
  SlideExtractionPipeline as SlideExtractor,
  SlideExtractionManager,
  slideExtractionManager,
} from '../processing';

export type {
  ExtractedSlide,
  SlideExtractionConfig,
  SlideExtractionStatus,
  SlideExtractionInput,
  SlideExtractionAdapter,
  SlideExtractionHandle,
  SlideExtractionMode,
  SlideSourceMode,
  VerificationState,
  CourseInfo,
} from '../processing';
