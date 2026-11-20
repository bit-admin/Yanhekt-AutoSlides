import {
  buildSharePayload,
  encodeSharePayload,
  parseCossImageUrl,
  SHARE_ORIGIN,
  SHARE_PATH,
  type ShareIdentity,
} from './shareLink';
import { COSS_HOST } from './shareResolve';
import { shareTimelineDelta } from './shareTimeline';
import type { SlideTimeline } from './sidecars/timeline';

// The share Worker's POST /v1/api/shorten caps the fragment at 8 KiB.
const MAX_SHORTENABLE_FRAGMENT_BYTES = 8192;
const PUBLIC_IMAGE_PREFIX = `${COSS_HOST}/images/`;

interface ShareSlide {
  /** The original filename from the timeline, not the CDN basename. */
  filename: string;
  url: string;
}

/**
 * Build a share link without a note. Pass the selected, uploaded slides in
 * image order and omit the timeline for an images-only link. Discard images
 * the viewer cannot resolve before indexing the timeline: otherwise dropping
 * one URL would silently move the rest of the cues onto the wrong images.
 */
export function buildSlideShareLink(
  identity: ShareIdentity,
  slides: readonly ShareSlide[],
  timeline?: SlideTimeline | null,
) {
  const shareable = slides.filter(({ url }) =>
    url.startsWith(PUBLIC_IMAGE_PREFIX) && parseCossImageUrl(url) !== null,
  );
  if (shareable.length === 0) return null;

  const t = shareTimelineDelta(timeline, shareable.map(({ filename }) => filename));
  const payload = buildSharePayload(identity, shareable.map(({ url }) => url), undefined, { t });
  const fragment = encodeSharePayload(payload);
  return {
    fragment,
    longUrl: `${SHARE_ORIGIN}${SHARE_PATH}#${fragment}`,
    imageCount: shareable.length,
    // Base64url is ASCII, so the string length is also the UTF-8 byte count.
    canShorten: fragment.length <= MAX_SHORTENABLE_FRAGMENT_BYTES,
  };
}
