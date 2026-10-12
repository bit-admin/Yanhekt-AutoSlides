/**
 * What the slide gallery and its preview need from a slide. An extracted slide
 * (`ExtractedSlide`) has these already; a Yanhe 2.0 server slide is mapped
 * onto them.
 */
export interface GallerySlide {
  id: string
  title: string
  /** Passed to the host's `formatSlideTime`; the host decides what it holds. */
  timestamp: string
  /** Anything an `<img>` can load: a data, blob or http(s) URL. Empty while the image is still loading. */
  dataUrl: string
}
