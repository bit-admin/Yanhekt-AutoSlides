import { parseLectureIds, parseLectureToken } from '../toolFolders';
import { canonicalTimelineFiles, noteImageUrls, readLegacyNoteTimeline } from './notesContent';
import { buildSharePayload, buildShareUrl, parseCossImageUrl, timelineDeltaFromUnknown } from './shareLink';

/** Build an image-only link from a note. This never uploads or changes the note. */
export function createNoteImageShare(title: string, content: string): { imageCount: number; url: string } {
  const urls = noteImageUrls(content);
  const imageCount = urls.filter((url) => parseCossImageUrl(url) !== null).length;
  if (imageCount === 0) return { imageCount, url: '' };

  // Older imports encode lecture identity in the title and may carry a timeline.
  // Cues address images by position, so they are kept only while the note still
  // has exactly the images the timeline lists. A same-count reorder cannot be
  // told apart: the old metadata does not record which URL was which slide.
  const token = parseLectureToken(title.trim());
  const identity = token.courseId || token.liveId ? token : parseLectureIds(title);
  const timeline = readLegacyNoteTimeline(content);
  const cuesFit = imageCount === urls.length && canonicalTimelineFiles(timeline).length === imageCount;
  const t = cuesFit ? timelineDeltaFromUnknown(timeline, imageCount) : undefined;
  const payload = buildSharePayload(identity, urls, undefined, { t });
  return { imageCount, url: buildShareUrl(payload) };
}
