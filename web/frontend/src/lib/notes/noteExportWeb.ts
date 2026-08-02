// Browser-side note export (Editor.js → PDF / Markdown ZIP).
// Port of autoslides noteExportService for the web Notes page — PDF + Markdown
// only (no DOCX). Uses pdf-lib + @pdf-lib/fontkit + fflate.
//
// Dual fonts per set (common TrueType faces under /fonts/ — see notesFontSets):
//   Latin  — Default Arial / Serif Georgia / Mono Courier New
//   CJK    — Default+Mono SimHei (gothic) / Serif SimSun (宋体)
// CFF/OTF faces are avoided: fontkit subsetting corrupts their glyph map.

import { zipSync, type Zippable } from 'fflate'
import type { PDFDocument, PDFFont, PDFPage, RGB } from 'pdf-lib'
import { downloadBlob } from '../pdfExport'
import { createLogger } from '../logger'
import {
  getNotesFontSet,
  type NotesFontSetId,
} from './notesFontSets'

const log = createLogger('NoteExportWeb')

export type NoteExportFormat = 'pdf' | 'markdown'

export interface NoteExportResult {
  ok: boolean
  error?: string
  /** PDF only: true when the CJK face was unavailable (Latin-only export). */
  cjkFallback?: boolean
}

// ── Editor.js block model (only the fields we render) ────────────────────────
interface EJBlock {
  type: string
  data?: Record<string, unknown>
}

function htmlToText(html: unknown): string {
  if (typeof html !== 'string') return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function parseBlocks(content: string): EJBlock[] {
  try {
    const doc = JSON.parse(content)
    if (doc && Array.isArray(doc.blocks)) return doc.blocks as EJBlock[]
  } catch {
    /* malformed — nothing to export */
  }
  return []
}

function listItems(data: Record<string, unknown> | undefined): string[] {
  const items = data?.items
  if (!Array.isArray(items)) return []
  return items.map((it) =>
    typeof it === 'string' ? htmlToText(it) : htmlToText((it as { content?: string })?.content),
  )
}

function tableRows(data: Record<string, unknown> | undefined): string[][] {
  const content = data?.content
  if (!Array.isArray(content)) return []
  return content.map((row) =>
    Array.isArray(row) ? row.map((cell) => htmlToText(cell)) : [],
  )
}

function imageBlockUrl(b: EJBlock): string | null {
  const file = b.data?.file as { url?: string } | undefined
  return b.type === 'image' && typeof file?.url === 'string' ? file.url : null
}

function sanitizeFileName(name: string): string {
  const cleaned = Array.from(name)
    .map((ch) => {
      const code = ch.charCodeAt(0)
      if (code < 32 || '<>:"/\\|?*'.includes(ch)) return '_'
      return ch
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.slice(0, 120) || 'note'
}

async function fetchImageBytes(url: string): Promise<Uint8Array | null> {
  try {
    if (url.startsWith('data:')) {
      const base64 = url.slice(url.indexOf(',') + 1)
      const bin = atob(base64)
      const out = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
      return out
    }
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return new Uint8Array(await res.arrayBuffer())
  } catch (err) {
    log.warn('failed to fetch note image', url, err)
    return null
  }
}

function readImageMeta(buf: Uint8Array): { width: number; height: number; type: 'png' | 'jpg' } {
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
    return { width: view.getUint32(16), height: view.getUint32(20), type: 'png' }
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let o = 2
    while (o + 9 < buf.length) {
      if (buf[o] !== 0xff) {
        o += 1
        continue
      }
      const marker = buf[o + 1]
      if (marker >= 0xc0 && marker <= 0xc3) {
        const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
        return { width: view.getUint16(o + 7), height: view.getUint16(o + 5), type: 'jpg' }
      }
      const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
      o += 2 + view.getUint16(o + 2)
    }
    return { width: 500, height: 300, type: 'jpg' }
  }
  return { width: 500, height: 300, type: 'png' }
}

// ── Markdown ─────────────────────────────────────────────────────────────────

/** Plain markdown for clipboard / export (remote image URLs kept as-is). */
export function noteContentToMarkdown(title: string, content: string): string {
  const blocks = parseBlocks(content)
  const lines: string[] = []
  if (blocks[0]?.type !== 'header') lines.push(`# ${title}`, '')
  for (const b of blocks) {
    const url = imageBlockUrl(b)
    if (url) {
      const caption = htmlToText(b.data?.caption)
      lines.push(`![${caption}](${url})`, '')
      continue
    }
    switch (b.type) {
      case 'header':
        lines.push(`${'#'.repeat(Math.min(6, Number(b.data?.level) || 2))} ${htmlToText(b.data?.text)}`, '')
        break
      case 'paragraph':
        lines.push(htmlToText(b.data?.text), '')
        break
      case 'list': {
        const ordered = b.data?.style === 'ordered'
        listItems(b.data).forEach((item, i) => lines.push(`${ordered ? `${i + 1}.` : '-'} ${item}`))
        lines.push('')
        break
      }
      case 'quote': {
        lines.push(`> ${htmlToText(b.data?.text)}`)
        const cap = htmlToText(b.data?.caption)
        if (cap) lines.push(`> — ${cap}`)
        lines.push('')
        break
      }
      case 'code':
        lines.push('```', String(b.data?.code ?? ''), '```', '')
        break
      case 'table': {
        const rows = tableRows(b.data)
        if (rows.length > 0) {
          lines.push(`| ${rows[0].join(' | ')} |`)
          lines.push(`| ${rows[0].map(() => '---').join(' | ')} |`)
          rows.slice(1).forEach((r) => lines.push(`| ${r.join(' | ')} |`))
          lines.push('')
        }
        break
      }
      case 'delimiter':
        lines.push('---', '')
        break
      default:
        break
    }
  }
  return lines.join('\n').trimEnd() + '\n'
}

async function buildMarkdownZip(title: string, blocks: EJBlock[]): Promise<Uint8Array> {
  const files: Zippable = {}
  const lines: string[] = []
  if (blocks[0]?.type !== 'header') lines.push(`# ${title}`, '')
  let imgIndex = 0

  for (const b of blocks) {
    const url = imageBlockUrl(b)
    if (url) {
      const buf = await fetchImageBytes(url)
      if (buf) {
        const meta = readImageMeta(buf)
        const name = `image_${String(++imgIndex).padStart(3, '0')}.${meta.type === 'jpg' ? 'jpg' : 'png'}`
        files[`images/${name}`] = [buf, { level: 0 }]
        const caption = htmlToText(b.data?.caption)
        lines.push(`![${caption}](images/${name})`, '')
      }
      continue
    }
    switch (b.type) {
      case 'header':
        lines.push(`${'#'.repeat(Math.min(6, Number(b.data?.level) || 2))} ${htmlToText(b.data?.text)}`, '')
        break
      case 'paragraph':
        lines.push(htmlToText(b.data?.text), '')
        break
      case 'list': {
        const ordered = b.data?.style === 'ordered'
        listItems(b.data).forEach((item, i) => lines.push(`${ordered ? `${i + 1}.` : '-'} ${item}`))
        lines.push('')
        break
      }
      case 'quote': {
        lines.push(`> ${htmlToText(b.data?.text)}`)
        const cap = htmlToText(b.data?.caption)
        if (cap) lines.push(`> — ${cap}`)
        lines.push('')
        break
      }
      case 'code':
        lines.push('```', String(b.data?.code ?? ''), '```', '')
        break
      case 'table': {
        const rows = tableRows(b.data)
        if (rows.length > 0) {
          lines.push(`| ${rows[0].join(' | ')} |`)
          lines.push(`| ${rows[0].map(() => '---').join(' | ')} |`)
          rows.slice(1).forEach((r) => lines.push(`| ${r.join(' | ')} |`))
          lines.push('')
        }
        break
      }
      case 'delimiter':
        lines.push('---', '')
        break
      default:
        break
    }
  }

  const md = new TextEncoder().encode(lines.join('\n'))
  files['note.md'] = [md, { level: 6 }]

  // Copyright reminder (see /copyright §5). Advisory only; does not grant a licence.
  const notice = new TextEncoder().encode(
    [
      'COPYRIGHT NOTICE',
      '',
      'This archive may contain copyrighted material.',
      'It is intended for personal study only under your own lawful access rights.',
      'Do not redistribute without authorisation from the rights holder.',
      '',
      'See https://learn.ruc.edu.kg/copyright',
      '',
    ].join('\n'),
  )
  files['COPYRIGHT.txt'] = [notice, { level: 6 }]

  return zipSync(files)
}

// ── PDF (pdf-lib + @pdf-lib/fontkit + dual self-hosted TTFs) ─────────────────

// Same-origin TrueType faces (frontend/public/fonts/). Served by Vite/ASSETS.
// Must be TrueType (not CFF/OTF): fontkit subsetting of CFF corrupts glyphs.

const fontBytesCache = new Map<string, Uint8Array | null>()

async function loadFontBytes(url: string, label: string): Promise<Uint8Array | null> {
  if (fontBytesCache.has(url)) return fontBytesCache.get(url) ?? null
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const bytes = new Uint8Array(await res.arrayBuffer())
    fontBytesCache.set(url, bytes)
    return bytes
  } catch (err) {
    log.warn(`${label} font fetch failed`, err)
    fontBytesCache.set(url, null)
    return null
  }
}

/** CJK ideographs + common CJK punctuation / fullwidth forms. */
function isCjkChar(ch: string): boolean {
  const c = ch.codePointAt(0)
  if (c == null) return false
  return (
    (c >= 0x2e80 && c <= 0x9fff) || // radicals … CJK unified
    (c >= 0xf900 && c <= 0xfaff) || // compatibility ideographs
    (c >= 0x3000 && c <= 0x303f) || // CJK symbols & punctuation
    (c >= 0xff00 && c <= 0xffef) // half/fullwidth forms
  )
}

interface TextRun {
  text: string
  cjk: boolean
}

function splitRuns(text: string): TextRun[] {
  if (!text) return []
  const runs: TextRun[] = []
  let buf = ''
  let bufCjk = isCjkChar(text[0]!)
  for (const ch of text) {
    const cjk = isCjkChar(ch)
    if (cjk === bufCjk) {
      buf += ch
    } else {
      if (buf) runs.push({ text: buf, cjk: bufCjk })
      buf = ch
      bufCjk = cjk
    }
  }
  if (buf) runs.push({ text: buf, cjk: bufCjk })
  return runs
}

function measureText(latin: PDFFont, cjk: PDFFont, text: string, size: number): number {
  let w = 0
  for (const run of splitRuns(text)) {
    const font = run.cjk ? cjk : latin
    w += font.widthOfTextAtSize(run.text, size)
  }
  return w
}

/** Tokenize for wrapping: CJK one char each; Latin broken on whitespace. */
function wrapTokens(text: string): string[] {
  const tokens: string[] = []
  let latin = ''
  const flushLatin = () => {
    if (!latin) return
    // Keep whitespace attached to the preceding word chunk when possible.
    for (const part of latin.split(/(\s+)/)) {
      if (part) tokens.push(part)
    }
    latin = ''
  }
  for (const ch of text) {
    if (isCjkChar(ch)) {
      flushLatin()
      tokens.push(ch)
    } else {
      latin += ch
    }
  }
  flushLatin()
  return tokens
}

const PAGE_W = 595.28 // A4
const PAGE_H = 841.89
const MARGIN = 50
const CONTENT_W = PAGE_W - MARGIN * 2

interface PdfCursor {
  page: PDFPage
  y: number
  doc: PDFDocument
  latin: PDFFont
  cjk: PDFFont
  black: RGB
}

function ensureSpace(cur: PdfCursor, needed: number): void {
  if (cur.y - needed < MARGIN) {
    cur.page = cur.doc.addPage([PAGE_W, PAGE_H])
    cur.y = PAGE_H - MARGIN
  }
}

function wrapLines(
  latin: PDFFont,
  cjk: PDFFont,
  text: string,
  size: number,
  maxWidth: number,
): string[] {
  const paragraphs = text.split('\n')
  const out: string[] = []
  for (const para of paragraphs) {
    if (!para) {
      out.push('')
      continue
    }
    const tokens = wrapTokens(para)
    let line = ''
    for (const token of tokens) {
      const trial = line + token
      if (line && measureText(latin, cjk, trial, size) > maxWidth) {
        out.push(line)
        // Don't start a new line with pure whitespace.
        line = /^\s+$/.test(token) ? '' : token.trimStart()
      } else {
        line = trial
      }
    }
    if (line) out.push(line)
  }
  return out.length ? out : ['']
}

function drawLine(
  cur: PdfCursor,
  text: string,
  size: number,
  x: number,
): void {
  let xPos = x
  for (const run of splitRuns(text)) {
    if (!run.text) continue
    const font = run.cjk ? cur.cjk : cur.latin
    cur.page.drawText(run.text, {
      x: xPos,
      y: cur.y - size,
      size,
      font,
      color: cur.black,
    })
    xPos += font.widthOfTextAtSize(run.text, size)
  }
}

function drawWrapped(
  cur: PdfCursor,
  text: string,
  size: number,
  opts: { indent?: number; lineGap?: number } = {},
): void {
  const indent = opts.indent ?? 0
  const lineGap = opts.lineGap ?? size * 0.35
  const maxW = CONTENT_W - indent
  const lines = wrapLines(cur.latin, cur.cjk, text, size, maxW)
  for (const line of lines) {
    ensureSpace(cur, size + lineGap)
    if (line) drawLine(cur, line, size, MARGIN + indent)
    cur.y -= size + lineGap
  }
}

async function buildPdf(
  title: string,
  blocks: EJBlock[],
  fontSetId: NotesFontSetId,
): Promise<{ bytes: Uint8Array; cjkFallback: boolean }> {
  const pdfLib = await import('pdf-lib')
  const { PDFDocument, StandardFonts, rgb } = pdfLib
  const doc = await PDFDocument.create()

  // Copyright reminder (see /copyright §5) — advisory only; does not grant a licence.
  doc.setSubject('This file may contain copyrighted material. For personal study only.')
  doc.setProducer('AutoSlides')
  doc.setCreator('AutoSlides')

  // Dynamic import keeps ~0.7 MB fontkit out of the main chunk until export.
  const fontkitMod = await import('@pdf-lib/fontkit')
  doc.registerFontkit(fontkitMod.default)

  const helvetica = await doc.embedFont(StandardFonts.Helvetica)
  let latin = helvetica
  let cjk = helvetica
  let cjkFallback = false

  const set = getNotesFontSet(fontSetId)
  const [latinBytes, cjkBytes] = await Promise.all([
    loadFontBytes(set.pdfLatinUrl, 'Latin'),
    loadFontBytes(set.pdfCjkUrl, 'CJK'),
  ])

  if (latinBytes) {
    try {
      latin = await doc.embedFont(latinBytes, { subset: true })
    } catch (err) {
      log.warn('Latin embed failed, using Helvetica', err)
    }
  }

  if (cjkBytes) {
    try {
      cjk = await doc.embedFont(cjkBytes, { subset: true })
    } catch (err) {
      log.warn('CJK embed failed', err)
      cjk = latin
      cjkFallback = true
    }
  } else {
    cjk = latin
    cjkFallback = true
  }

  const cur: PdfCursor = {
    doc,
    page: doc.addPage([PAGE_W, PAGE_H]),
    y: PAGE_H - MARGIN,
    latin,
    cjk,
    black: rgb(0.12, 0.12, 0.12),
  }

  if (blocks[0]?.type !== 'header') {
    drawWrapped(cur, title, 18, { lineGap: 8 })
    cur.y -= 6
  }

  for (const b of blocks) {
    const url = imageBlockUrl(b)
    if (url) {
      const buf = await fetchImageBytes(url)
      if (buf) {
        const meta = readImageMeta(buf)
        try {
          const embedded =
            meta.type === 'jpg' ? await doc.embedJpg(buf) : await doc.embedPng(buf)
          const maxH = PAGE_H - MARGIN * 2
          const scale = Math.min(CONTENT_W / embedded.width, maxH / embedded.height, 1)
          const drawW = embedded.width * scale
          const drawH = embedded.height * scale
          ensureSpace(cur, drawH + 8)
          cur.page.drawImage(embedded, {
            x: MARGIN + (CONTENT_W - drawW) / 2,
            y: cur.y - drawH,
            width: drawW,
            height: drawH,
          })
          cur.y -= drawH + 10
        } catch (err) {
          log.warn('pdf image embed failed', err)
        }
      }
      continue
    }
    switch (b.type) {
      case 'header': {
        const level = Number(b.data?.level) || 2
        const size = level <= 2 ? 15 : 13
        cur.y -= 4
        drawWrapped(cur, htmlToText(b.data?.text), size, { lineGap: 6 })
        cur.y -= 2
        break
      }
      case 'paragraph':
        drawWrapped(cur, htmlToText(b.data?.text), 11)
        cur.y -= 4
        break
      case 'list': {
        const ordered = b.data?.style === 'ordered'
        listItems(b.data).forEach((item, i) => {
          drawWrapped(cur, `${ordered ? `${i + 1}.` : '•'} ${item}`, 11, { indent: 12 })
        })
        cur.y -= 4
        break
      }
      case 'quote': {
        drawWrapped(cur, htmlToText(b.data?.text), 11, { indent: 12 })
        const cap = htmlToText(b.data?.caption)
        if (cap) drawWrapped(cur, `— ${cap}`, 9, { indent: 12 })
        cur.y -= 4
        break
      }
      case 'code':
        // Latin face for code (no mono face bundled); CJK still routes via splitRuns.
        drawWrapped(cur, String(b.data?.code ?? ''), 10, { indent: 12 })
        cur.y -= 4
        break
      case 'table':
        tableRows(b.data).forEach((row) => drawWrapped(cur, row.join('   |   '), 10))
        cur.y -= 4
        break
      case 'delimiter':
        ensureSpace(cur, 20)
        drawLine(cur, '* * *', 11, MARGIN + CONTENT_W / 2 - 12)
        cur.y -= 20
        break
      default:
        break
    }
  }

  const bytes = await doc.save()
  return { bytes, cjkFallback }
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function exportNote(
  title: string,
  content: string,
  format: NoteExportFormat,
  fontSetId: NotesFontSetId = 'default',
): Promise<NoteExportResult> {
  const safe = sanitizeFileName(title)
  const blocks = parseBlocks(content)
  try {
    if (format === 'markdown') {
      const zip = await buildMarkdownZip(title, blocks)
      downloadBlob(zip, `${safe}.zip`, 'application/zip')
      return { ok: true }
    }
    const { bytes, cjkFallback } = await buildPdf(title, blocks, fontSetId)
    downloadBlob(bytes, `${safe}.pdf`, 'application/pdf')
    return { ok: true, cjkFallback }
  } catch (err) {
    log.error('export failed', err)
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
