import type { SlideReviewMeta } from './types';

export interface IndexReviewFlags {
  reviewed: boolean;
  edited: boolean;
}

// Review flags a folder publishes to the AutoSlides Index. Only the human
// latches count: `cropped` is current state and is also set by automated
// post-processing (phase-3 in-place auto-crop), so it must not imply `edited`.
// A human crop already sets the `edited` latch. Editing implies reviewing.
export function indexReviewFlags(
  review: Partial<SlideReviewMeta> | null | undefined,
): IndexReviewFlags {
  const edited = !!review?.edited;
  return { reviewed: !!review?.reviewed || edited, edited };
}
