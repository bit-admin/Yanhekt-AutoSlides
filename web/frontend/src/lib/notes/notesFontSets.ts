// Notion-style note font sets for the web Notes editor + PDF export.
// Faces live under /fonts/ (gitignored binaries). Loaded lazily on first use —
// editor via FontFace API; PDF via fetch + pdf-lib subset embed.
//
// Common web-style pairings (Latin + CJK). PDF CJK must be TrueType (.ttf);
// fontkit cannot subset .ttc collections (YaHei / Songti SC / STHeiti).
//   Default — Arial          + SimHei   (sans / gothic)
//   Serif   — Georgia        + SimSun   (serif / 宋体; extracted from Simsun.ttc)
//   Mono    — Courier New    + SimHei   (mono; no true CJK mono .ttf on hand)
//
// Never use simsunb.ttf — that is SimSun-ExtB (rare Extension-B only → tofu).

export type NotesFontSetId = 'default' | 'serif' | 'mono'

export interface NotesFontSet {
  id: NotesFontSetId
  /** CSS font-family name registered by ensureNotesFontSetLoaded. */
  family: string
  /** Preview tile style (for the Ag picker). */
  previewFamily: string
  /** PDF latin face (roman). */
  pdfLatinUrl: string
  /** PDF CJK face (TrueType only — fontkit subsetting requires .ttf). */
  pdfCjkUrl: string
  /** Editor faces to register (url + optional style). Latin only; CJK is system. */
  editorFaces: { url: string; style?: 'normal' | 'italic'; weight?: string }[]
}

/**
 * CSS stack for the document. Custom Latin family first, then system CJK that
 * matches the set's mood, then generic Latin fallbacks.
 */
export const NOTES_FONT_FALLBACKS: Record<NotesFontSetId, string> = {
  default:
    '"AS Notes Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, ' +
    '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif',
  serif:
    '"AS Notes Serif", Georgia, "Times New Roman", Times, ' +
    '"Songti SC", "STSong", "SimSun", "Noto Serif CJK SC", serif',
  mono:
    '"AS Notes Mono", "Courier New", Courier, ui-monospace, SFMono-Regular, Menlo, Consolas, ' +
    '"PingFang SC", "Microsoft YaHei", monospace',
}

export const NOTES_FONT_SETS: NotesFontSet[] = [
  {
    id: 'default',
    family: 'AS Notes Sans',
    previewFamily: 'Arial, Helvetica, sans-serif',
    pdfLatinUrl: '/fonts/Arial.ttf',
    pdfCjkUrl: '/fonts/SimHei.ttf',
    editorFaces: [
      { url: '/fonts/Arial.ttf', style: 'normal' },
      { url: '/fonts/Arial Italic.ttf', style: 'italic' },
    ],
  },
  {
    id: 'serif',
    family: 'AS Notes Serif',
    previewFamily: 'Georgia, "Times New Roman", serif',
    pdfLatinUrl: '/fonts/Georgia.ttf',
    // Classic SimSun face extracted from Simsun.ttc (see public/fonts/README.md).
    // Do NOT use simsunb.ttf (SimSun-ExtB — no everyday SC glyphs).
    pdfCjkUrl: '/fonts/SimSun.ttf',
    editorFaces: [
      { url: '/fonts/Georgia.ttf', style: 'normal' },
      { url: '/fonts/Georgia Italic.ttf', style: 'italic' },
    ],
  },
  {
    id: 'mono',
    family: 'AS Notes Mono',
    previewFamily: '"Courier New", Courier, monospace',
    pdfLatinUrl: '/fonts/Courier New.ttf',
    pdfCjkUrl: '/fonts/SimHei.ttf',
    editorFaces: [
      { url: '/fonts/Courier New.ttf', style: 'normal' },
      { url: '/fonts/Courier New Italic.ttf', style: 'italic' },
    ],
  },
]

export function getNotesFontSet(id: NotesFontSetId | string | undefined): NotesFontSet {
  return NOTES_FONT_SETS.find((s) => s.id === id) ?? NOTES_FONT_SETS[0]!
}

export function isNotesFontSetId(v: unknown): v is NotesFontSetId {
  return v === 'default' || v === 'serif' || v === 'mono'
}

const loaded = new Set<NotesFontSetId>()
const inflight = new Map<NotesFontSetId, Promise<void>>()

/**
 * Lazily register the Latin faces for a font set via the FontFace API.
 * CJK stays on the system stack (see NOTES_FONT_FALLBACKS) so we don't pull
 * multi‑MB CJK files into the SPA. No-op if already loaded.
 */
export function ensureNotesFontSetLoaded(id: NotesFontSetId): Promise<void> {
  if (loaded.has(id)) return Promise.resolve()
  const existing = inflight.get(id)
  if (existing) return existing

  const set = getNotesFontSet(id)
  const p = (async () => {
    await Promise.all(
      set.editorFaces.map(async (face) => {
        try {
          const ff = new FontFace(set.family, `url(${face.url})`, {
            style: face.style ?? 'normal',
            weight: face.weight ?? '400',
            display: 'swap',
          })
          const loadedFace = await ff.load()
          document.fonts.add(loadedFace)
        } catch (err) {
          // Soft-fail: picker preview / editor keep system fallbacks.
          console.warn(`[NotesFont] failed to load ${face.url}`, err)
        }
      }),
    )
    loaded.add(id)
    inflight.delete(id)
  })()
  inflight.set(id, p)
  return p
}
