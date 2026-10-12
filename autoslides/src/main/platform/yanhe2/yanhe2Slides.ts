/**
 * Yanhe 2.0 server slides: the list aita detects on a lecture's screen
 * recording (`search-ppt`).
 *
 * The call ignores `page` / `per_page` and answers with every row, so it is
 * made once and never looped on `total`. A lecture with no slides answers
 * `list: []` with `code` 0, which is a real answer.
 */
import { YANHE2_ORIGIN } from '@common/yanhe2';
import type { Yanhe2Slide } from '@common/yanhe2Slides';
import { YANHE2_READ_PATHS, readYanhe2, type Yanhe2Fetched } from './yanhe2Http';

type Row = Record<string, unknown>;

const isRow = (value: unknown): value is Row => !!value && typeof value === 'object' && !Array.isArray(value);

/** A slide image the local proxy may fetch: a JPEG or PNG in aita's own `/ai-nginx/` tree. */
export function isYanhe2SlideImageUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.origin === YANHE2_ORIGIN
    && url.pathname.startsWith('/ai-nginx/')
    && !url.pathname.includes('..')
    && /\.(jpe?g|png)$/i.test(url.pathname)
  );
}

/** `content` is a JSON string holding the image URL and the time. */
function parseContent(value: unknown): Row | null {
  if (typeof value !== 'string') return isRow(value) ? value : null;
  try {
    const parsed: unknown = JSON.parse(value);
    return isRow(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** `{code:0, total, list}`, rows in time order. Rows without a usable image are dropped. */
export function parseYanhe2Slides(body: unknown): Yanhe2Slide[] | null {
  if (!isRow(body) || body.code !== 0) return null;
  if (!Array.isArray(body.list)) return [];
  const slides: Yanhe2Slide[] = [];
  for (const item of body.list) {
    if (!isRow(item)) continue;
    const content = parseContent(item.content);
    if (!content) continue;
    const url = typeof content.pptimgurl === 'string' ? content.pptimgurl.trim() : '';
    if (!isYanhe2SlideImageUrl(url)) continue;
    // The same number twice: `content.created` and the row's `created_sec`.
    const time = Number(content.created ?? item.created_sec);
    slides.push({ seconds: Number.isFinite(time) && time > 0 ? Math.floor(time) : 0, url });
  }
  return slides.sort((a, b) => a.seconds - b.seconds);
}

export async function fetchYanhe2Slides(
  jwt: string,
  query: { courseId: string; subId: string },
): Promise<Yanhe2Fetched<Yanhe2Slide[]>> {
  const fetched = await readYanhe2(jwt, YANHE2_READ_PATHS.slides, {
    course_id: query.courseId,
    sub_id: query.subId,
  });
  if (fetched.kind !== 'ok') return fetched;
  const data = parseYanhe2Slides(fetched.data);
  return data ? { kind: 'ok', data } : { kind: 'failed', detail: `${YANHE2_READ_PATHS.slides} answered an unexpected shape` };
}
