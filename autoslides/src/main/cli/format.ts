// Plain-text tables and values for human output. Pure, so it is unit-tested.

// East Asian wide and fullwidth characters take two terminal columns; course
// titles are mostly Chinese, so padding by `.length` would misalign them.
const WIDE = /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/;

export function displayWidth(text: string): number {
  let width = 0;
  for (const ch of text) width += WIDE.test(ch) ? 2 : 1;
  return width;
}

/** Columns separated by two spaces; the last column is not padded. */
export function table(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const widths = headers.map((h, col) => Math.max(displayWidth(h), ...rows.map((r) => displayWidth(r[col] ?? ''))));
  const line = (cells: readonly string[]): string =>
    cells
      .map((cell, col) => (col === cells.length - 1 ? cell : cell + ' '.repeat(widths[col] - displayWidth(cell))))
      .join('  ')
      .trimEnd();
  return [line(headers), ...rows.map(line)].join('\n');
}

/** `1:35:20`, or `47:05` under an hour; empty for an unknown length. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${m}:${rest}`;
}

/** `2025-09-08 08:00` from Yanhekt's `2025-09-08 08:00:00`. */
export function formatTime(value: string | undefined): string {
  return value ? value.slice(0, 16) : '';
}

// Yanhekt's `name_en` is teacher-entered: some are the placeholder 待完善, some
// repeat the Chinese name, some arrive HTML-escaped. Same rule as the app's
// `usableEnglishTitle` (renderer `displayNames.ts`, which main cannot import):
// any CJK ideograph means it is not an English title.
const CJK_IDEOGRAPH = /[㐀-䶿一-鿿豈-﫿]/;
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** The usable English course name, or null. */
export function englishTitle(value: string | null | undefined): string | null {
  if (!value) return null;
  const decoded = value
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (whole, body: string) => {
      const token = body.toLowerCase();
      if (!token.startsWith('#')) return ENTITIES[token] ?? whole;
      const code = token.startsWith('#x') ? parseInt(token.slice(2), 16) : parseInt(token.slice(1), 10);
      const valid = Number.isFinite(code) && code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff);
      return valid ? String.fromCodePoint(code) : whole;
    })
    .trim();
  return decoded && !CJK_IDEOGRAPH.test(decoded) ? decoded : null;
}
