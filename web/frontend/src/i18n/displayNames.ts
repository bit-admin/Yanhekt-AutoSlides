/**
 * Locale-aware display formatting for course data.
 *
 * These are **display only**. A course carries one canonical title — the Chinese
 * `name_zh`, on `Course.title` — and that value is what the IndexedDB folder key,
 * slide metadata `source.courseTitle`, and managed note titles all derive from.
 * The English name lives beside it on `titleEn` and must never be substituted
 * into those paths: `useSlideExtraction`'s `buildFolderName` output is the folder
 * store's primary key, and `watchNotesStore` matches cloud notes by exact title
 * equality, so a localized title there would orphan folders and duplicate notes.
 *
 * Both helpers read `getCurrentLocale()`, which reads `i18n.global.locale.value`
 * — a ref — so a template using them re-renders when the language changes.
 */

import { i18n, getCurrentLocale } from "./index";

// Yanhekt's name_en is teacher-entered and frequently unusable: some courses
// carry the literal placeholder 待完善 ("to be completed"), others repeat the
// Chinese name outright. Any CJK ideograph means this is not an English title,
// which catches every such case without maintaining a placeholder blacklist.
// (Full-width punctuation is deliberately not in this range — an English title
// ending in "（英文）" is still usable English.)
const CJK_IDEOGRAPH = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

// Some name_en values arrive HTML-escaped ("Development &#97;nd Practice…").
// Decoding is display-only and the result is rendered through Vue's text
// interpolation, which re-escapes it — never feed this to v-html.
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeHtmlEntities(value: string): string {
  if (!value.includes("&")) return value;
  return value.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (whole, body: string) => {
    const token = body.toLowerCase();
    if (token.startsWith("#")) {
      const code = token.startsWith("#x")
        ? parseInt(token.slice(2), 16)
        : parseInt(token.slice(1), 10);
      // Reject non-characters and anything outside the Unicode range.
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return whole;
      if (code >= 0xd800 && code <= 0xdfff) return whole;
      return String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[token] ?? whole;
  });
}

/**
 * The usable English course name, or `undefined`. Exported for tests; callers
 * should use {@link courseDisplayTitle}.
 */
export function usableEnglishTitle(titleEn?: string | null): string | undefined {
  if (!titleEn) return undefined;
  const decoded = decodeHtmlEntities(titleEn).trim();
  if (!decoded || CJK_IDEOGRAPH.test(decoded)) return undefined;
  return decoded;
}

/**
 * The course name to show. English only when the UI is in English *and* Yanhekt
 * supplied a usable `name_en`; zh/ja/ko keep the Chinese name, as does any course
 * whose English name is missing or a placeholder.
 */
export function courseDisplayTitle(
  course?: { title?: string; titleEn?: string } | null,
): string {
  if (!course) return "";
  const zh = course.title ?? "";
  if (getCurrentLocale() !== "en") return zh;
  return usableEnglishTitle(course.titleEn) ?? zh;
}

/**
 * Characters that occupy roughly two Latin widths: CJK ideographs, kana, hangul,
 * CJK punctuation and full-width forms.
 */
const WIDE_CHAR =
  /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe6f\uff00-\uff60\uffe0-\uffe6]/;

/** Visual width of a string in Latin-character units (CJK counts double). */
function visualWidth(text: string): number {
  let width = 0;
  for (const ch of text) width += WIDE_CHAR.test(ch) ? 2 : 1;
  return width;
}

/**
 * Step-down modifier for a course title. The cards were sized for Chinese names
 * (~10 characters); the English ones run two to four times longer and were
 * truncating inside the two clamped lines, so a long title drops a size instead.
 *
 * Returns a bare modifier (`''` / `'is-long'` / `'is-longer'`) so each surface can
 * apply it to its own base class. Thresholds are in visual-width units, which is
 * why a 20-character Chinese name scores the same as a 40-character English one
 * and Chinese titles keep the default size in practice.
 */
export function courseTitleSizeClass(title: string): "" | "is-long" | "is-longer" {
  const width = visualWidth(title.trim());
  if (width > 56) return "is-longer";
  if (width > 40) return "is-long";
  return "";
}

/**
 * The academic term line on a course card: `"2026-2027 Fall"` in English,
 * `"2026-2027 秋季学期"` in Chinese. `schoolYear` is the API's raw range string.
 *
 * `semester` is a **string** on the course list but a **number** on `/v1/course`,
 * so it is coerced. Anything that is not 1 or 2 — and any course with no term
 * fields at all, which is every live broadcast — returns `fallback` instead
 * (live cards pass their `HH:MM - HH:MM` clock range there).
 */
export function academicTermLabel(
  schoolYear?: string | number | null,
  semester?: string | number | null,
  fallback = "",
): string {
  const range = schoolYear == null ? "" : String(schoolYear).trim();
  const n = semester == null || semester === "" ? NaN : Number(semester);
  if (!range || (n !== 1 && n !== 2)) return fallback;
  const key =
    n === 1 ? "searchPage.termRangeFall" : "searchPage.termRangeSpring";
  return i18n.global.t(key, { range });
}
