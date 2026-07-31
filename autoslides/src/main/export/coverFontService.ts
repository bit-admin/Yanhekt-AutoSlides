/**
 * Cover Font Service
 *
 * Resolves a platform CJK font for PDF cover-page rendering, with a
 * pinyin-based fallback when no font can be located. Also hosts small
 * helpers shared by the cover builder (course/session extraction and
 * timestamp formatting).
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { pinyin } from 'pinyin-pro';

export interface SystemCjkFont {
  path: string;
  postScriptName?: string;
}

interface FontCandidate {
  path: string;
  postScriptName?: string;
}

/**
 * System-wide fonts only (never ~/Library/Fonts — not present for other users /
 * packaged machines). Prefer faces that PDFKit maps CJK punctuation correctly:
 * Hiragino Sans GB and Arial Unicode are verified; STHeiti / Songti .ttc often
 * turn ，。：；「」—— into ` ' ° || under PDFKit and are last-resort only.
 * PingFang is preferred when the system ships it at a known path.
 */
function darwinCandidates(): FontCandidate[] {
  return [
    // Preferred — correct CJK punctuation under PDFKit
    { path: '/System/Library/Fonts/PingFang.ttc', postScriptName: 'PingFangSC-Regular' },
    { path: '/System/Library/Fonts/Hiragino Sans GB.ttc', postScriptName: 'HiraginoSansGB-W3' },
    { path: '/System/Library/Fonts/Supplemental/Arial Unicode.ttf' },
    { path: '/Library/Fonts/Arial Unicode.ttf' },
    // Last resort — ideographs usually OK; CJK punctuation often wrong in PDFKit
    { path: '/System/Library/Fonts/STHeiti Medium.ttc', postScriptName: 'STHeitiSC-Medium' },
    { path: '/System/Library/Fonts/STHeiti Light.ttc', postScriptName: 'STHeitiSC-Light' },
    { path: '/System/Library/Fonts/Supplemental/Songti.ttc', postScriptName: 'STSongti-SC-Regular' },
    { path: '/Library/Fonts/Songti.ttc', postScriptName: 'STSong' },
  ];
}

function win32Candidates(): FontCandidate[] {
  const windir = process.env.WINDIR || 'C:\\Windows';
  const fonts = path.join(windir, 'Fonts');
  return [
    // Prefer .ttf over .ttc for the same reason as on macOS.
    { path: path.join(fonts, 'simhei.ttf') },
    { path: path.join(fonts, 'msyh.ttf'), postScriptName: 'MicrosoftYaHei' },
    { path: path.join(fonts, 'simsun.ttf') },
    { path: path.join(fonts, 'msyh.ttc'), postScriptName: 'MicrosoftYaHei' },
    { path: path.join(fonts, 'simsun.ttc'), postScriptName: 'SimSun' },
  ];
}

const CANDIDATES_BY_PLATFORM: Record<NodeJS.Platform, () => FontCandidate[]> = {
  darwin: darwinCandidates,
  win32: win32Candidates,
  linux: () => [
    // Standalone OTF/TTF first when distros ship them
    { path: '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', postScriptName: 'NotoSansCJKsc-Regular' },
    { path: '/usr/share/fonts/opentype/noto/NotoSansCJK.ttc', postScriptName: 'NotoSansCJKsc-Regular' },
    { path: '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc' },
    { path: '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc' },
    { path: '/usr/share/fonts/truetype/arphic/uming.ttc' },
  ],
  aix: () => [],
  android: () => [],
  freebsd: () => [],
  haiku: () => [],
  openbsd: () => [],
  sunos: () => [],
  cygwin: () => [],
  netbsd: () => [],
};

let cachedFont: SystemCjkFont | null | undefined;

export function resolveSystemCjkFont(): SystemCjkFont | null {
  if (cachedFont !== undefined) return cachedFont;

  const candidates = (CANDIDATES_BY_PLATFORM[os.platform()] || (() => []))();
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate.path)) {
        cachedFont = { path: candidate.path, postScriptName: candidate.postScriptName };
        return cachedFont;
      }
    } catch {
      // continue
    }
  }

  cachedFont = null;
  return null;
}

/** Test helper / settings UI — drop the memoized pick so a newly installed font is seen. */
export function clearSystemCjkFontCache(): void {
  cachedFont = undefined;
}

const CJK_RANGE = /[㐀-鿿豈-﫿]/;

export function containsCjk(text: string): boolean {
  return CJK_RANGE.test(text);
}

/**
 * Convert Chinese characters to pinyin while leaving Latin / digits untouched.
 * Used as a last-resort fallback when no system CJK font is available.
 */
export function chineseToPinyin(text: string): string {
  if (!containsCjk(text)) return text;
  return pinyin(text, {
    toneType: 'symbol',
    type: 'string',
    nonZh: 'consecutive',
  });
}

// Course/session extraction lives in @common/lectureNaming so the renderer's
// folder list and this cover builder cannot drift apart (they used to hold
// separate copies of the same regex). Re-exported here to keep the existing
// import sites working.
export { extractCourseName, extractSessionLabel } from '@common/lectureNaming';

const WEEKDAY_EN: Record<string, string> = {
  '一': 'Monday',
  '二': 'Tuesday',
  '三': 'Wednesday',
  '四': 'Thursday',
  '五': 'Friday',
  '六': 'Saturday',
  '日': 'Sunday',
};

/**
 * Translate a session label like "第1周 星期一 第1大节" (or its
 * underscore form) into English: "Week 1 · Monday · Period 1".
 * Used when no CJK font is available and the cover falls back to pinyin —
 * for session labels we can do better than pinyin since the structure is
 * fully determined.
 */
export function translateSessionToEnglish(label: string): string {
  const normalized = label.replace(/_/g, ' ').trim();
  const match = normalized.match(/^第(\d+)周\s+星期([一二三四五六日])\s+第(\d+)大节$/);
  if (!match) return label;
  const week = match[1];
  const weekday = WEEKDAY_EN[match[2]] ?? match[2];
  const period = match[3];
  return `Week ${week} · ${weekday} · Period ${period}`;
}

export function formatCoverTimestamp(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

/**
 * Resolve a system font path for cover rendering, including the helper meta
 * needed by callers (e.g. whether pinyin fallback should kick in).
 */
export function getCoverFontPlan(): {
  font: SystemCjkFont | null;
  pinyinFallback: boolean;
} {
  const font = resolveSystemCjkFont();
  return { font, pinyinFallback: font === null };
}

// Exposed for tests / dev resets.
export function _resetFontCache(): void {
  cachedFont = undefined;
}

export const _CANDIDATES_BY_PLATFORM = CANDIDATES_BY_PLATFORM;
