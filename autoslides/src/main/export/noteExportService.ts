import fs from 'node:fs';
import { BrowserWindow, dialog } from 'electron';
import axios from 'axios';
import PDFDocument from 'pdfkit';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  ImageRun,
  AlignmentType,
} from 'docx';
import JSZip from 'jszip';
import { sanitizeFileName } from '@common/sanitizeFileName';
import { resolveSystemCjkFont } from './coverFontService';
import { createLogger } from '@main/infra/logger';

const log = createLogger('NoteExport');

export type NoteExportFormat = 'pdf' | 'markdown' | 'docx';

export interface NoteExportPayload {
  title: string;
  /** Stringified Editor.js document. */
  content: string;
  format: NoteExportFormat;
}

export interface NoteExportResult {
  ok: boolean;
  path?: string;
  canceled?: boolean;
  error?: string;
}

// ── Editor.js block model (only the fields we render) ────────────────────────
interface EJBlock {
  type: string;
  data?: Record<string, unknown>;
}

/** Strip inline HTML to plain text (Editor.js stores rich text as HTML fragments). */
function htmlToText(html: unknown): string {
  if (typeof html !== 'string') return '';
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
    .trim();
}

function parseBlocks(content: string): EJBlock[] {
  try {
    const doc = JSON.parse(content);
    if (doc && Array.isArray(doc.blocks)) return doc.blocks as EJBlock[];
  } catch {
    /* malformed — nothing to export */
  }
  return [];
}

function listItems(data: Record<string, unknown> | undefined): string[] {
  const items = data?.items;
  if (!Array.isArray(items)) return [];
  // @editorjs/list stores strings; tolerate {content} objects from newer builds.
  return items.map((it) =>
    typeof it === 'string' ? htmlToText(it) : htmlToText((it as { content?: string })?.content),
  );
}

function tableRows(data: Record<string, unknown> | undefined): string[][] {
  const content = data?.content;
  if (!Array.isArray(content)) return [];
  return content.map((row) =>
    Array.isArray(row) ? row.map((cell) => htmlToText(cell)) : [],
  );
}

async function fetchImage(url: string): Promise<Buffer | null> {
  try {
    if (url.startsWith('data:')) {
      const base64 = url.slice(url.indexOf(',') + 1);
      return Buffer.from(base64, 'base64');
    }
    const res = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer', timeout: 30000 });
    return Buffer.from(res.data);
  } catch (err) {
    log.warn('failed to fetch note image', url, err);
    return null;
  }
}

/** Minimal image dimension reader for the two formats slides/uploads use. */
function readImageMeta(buf: Buffer): { width: number; height: number; type: 'png' | 'jpg' } {
  // PNG: 0x89 P N G ... IHDR width/height at bytes 16/20.
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), type: 'png' };
  }
  // JPEG: scan for a start-of-frame marker.
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let o = 2;
    while (o + 9 < buf.length) {
      if (buf[o] !== 0xff) { o += 1; continue; }
      const marker = buf[o + 1];
      if (marker >= 0xc0 && marker <= 0xc3) {
        return { width: buf.readUInt16BE(o + 7), height: buf.readUInt16BE(o + 5), type: 'jpg' };
      }
      o += 2 + buf.readUInt16BE(o + 2);
    }
    return { width: 500, height: 300, type: 'jpg' };
  }
  return { width: 500, height: 300, type: 'png' };
}

const imageBlockUrl = (b: EJBlock): string | null => {
  const file = b.data?.file as { url?: string } | undefined;
  return b.type === 'image' && typeof file?.url === 'string' ? file.url : null;
};

// ── PDF ──────────────────────────────────────────────────────────────────────
async function renderPdf(title: string, blocks: EJBlock[], outPath: string): Promise<void> {
  const doc = new PDFDocument({ size: 'A4', margin: 50, autoFirstPage: true });
  const stream = fs.createWriteStream(outPath);
  const done = new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });
  doc.pipe(stream);
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  // PDFKit's built-in fonts don't cover CJK (Chinese notes render as mojibake),
  // so register a system CJK font — same source the Slides export uses. When
  // available it renders both CJK and Latin, so use it for every text style
  // (a single face means no separate bold/italic/mono, an acceptable trade for
  // correct Chinese); fall back to the built-in fonts only if none is found.
  const sysFont = resolveSystemCjkFont();
  let cjk: string | null = null;
  if (sysFont) {
    try {
      if (sysFont.postScriptName) doc.registerFont('cjk', sysFont.path, sysFont.postScriptName);
      else doc.registerFont('cjk', sysFont.path);
      cjk = 'cjk';
    } catch (err) {
      log.warn('CJK font registration failed', err);
    }
  }
  const bodyFont = cjk ?? 'Helvetica';
  const boldFont = cjk ?? 'Helvetica-Bold';
  const italicFont = cjk ?? 'Helvetica-Oblique';
  const monoFont = cjk ?? 'Courier';

  // The note usually opens with its own title header — only add an explicit
  // title when it doesn't, so the title isn't printed twice.
  if (blocks[0]?.type !== 'header') {
    doc.font(boldFont).fontSize(18).text(title, { align: 'left' });
    doc.moveDown(0.8);
  }

  for (const b of blocks) {
    const url = imageBlockUrl(b);
    if (url) {
      const buf = await fetchImage(url);
      if (buf) {
        const meta = readImageMeta(buf);
        const maxH = doc.page.height - doc.page.margins.top - doc.page.margins.bottom;
        const drawW = Math.min(contentWidth, meta.width);
        const drawH = (meta.height / meta.width) * drawW;
        if (doc.y + Math.min(drawH, maxH) > doc.page.height - doc.page.margins.bottom) doc.addPage();
        try {
          doc.image(buf, { fit: [contentWidth, maxH], align: 'center' });
        } catch (err) {
          log.warn('pdf image embed failed', err);
        }
        doc.moveDown(0.6);
      }
      continue;
    }
    switch (b.type) {
      case 'header': {
        const level = Number(b.data?.level) || 2;
        doc.font(boldFont).fontSize(level <= 2 ? 15 : 13).text(htmlToText(b.data?.text));
        doc.moveDown(0.3);
        break;
      }
      case 'paragraph': {
        doc.font(bodyFont).fontSize(11).text(htmlToText(b.data?.text));
        doc.moveDown(0.4);
        break;
      }
      case 'list': {
        doc.font(bodyFont).fontSize(11);
        const ordered = b.data?.style === 'ordered';
        listItems(b.data).forEach((item, i) => {
          doc.text(`${ordered ? `${i + 1}.` : '•'} ${item}`, { indent: 12 });
        });
        doc.moveDown(0.4);
        break;
      }
      case 'quote': {
        doc.font(italicFont).fontSize(11).text(htmlToText(b.data?.text), { indent: 12 });
        const cap = htmlToText(b.data?.caption);
        if (cap) doc.font(bodyFont).fontSize(9).text(`— ${cap}`, { indent: 12 });
        doc.moveDown(0.4);
        break;
      }
      case 'code': {
        doc.font(monoFont).fontSize(10).text(String(b.data?.code ?? ''), { indent: 12 });
        doc.moveDown(0.4);
        break;
      }
      case 'table': {
        doc.font(bodyFont).fontSize(10);
        tableRows(b.data).forEach((row) => doc.text(row.join('   |   ')));
        doc.moveDown(0.4);
        break;
      }
      case 'delimiter': {
        doc.font(bodyFont).fontSize(11).text('* * *', { align: 'center' });
        doc.moveDown(0.4);
        break;
      }
      default:
        break;
    }
  }
  doc.end();
  await done;
}

// ── DOCX ─────────────────────────────────────────────────────────────────────
const HEADING_BY_LEVEL: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
};

async function renderDocx(title: string, blocks: EJBlock[], outPath: string): Promise<void> {
  const children: Paragraph[] = [];
  // Only add an explicit title when the note doesn't already open with a header.
  if (blocks[0]?.type !== 'header') {
    children.push(new Paragraph({ text: title, heading: HeadingLevel.TITLE }));
  }

  for (const b of blocks) {
    const url = imageBlockUrl(b);
    if (url) {
      const buf = await fetchImage(url);
      if (buf) {
        const meta = readImageMeta(buf);
        const width = Math.min(500, meta.width);
        const height = Math.round((meta.height / meta.width) * width);
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({ data: buf, type: meta.type, transformation: { width, height } }),
            ],
          }),
        );
      }
      continue;
    }
    switch (b.type) {
      case 'header':
        children.push(
          new Paragraph({
            text: htmlToText(b.data?.text),
            heading: HEADING_BY_LEVEL[Number(b.data?.level) || 2] ?? HeadingLevel.HEADING_2,
          }),
        );
        break;
      case 'paragraph':
        children.push(new Paragraph({ children: [new TextRun(htmlToText(b.data?.text))] }));
        break;
      case 'list': {
        const ordered = b.data?.style === 'ordered';
        listItems(b.data).forEach((item) => {
          children.push(
            new Paragraph({
              text: item,
              numbering: undefined,
              bullet: ordered ? undefined : { level: 0 },
            }),
          );
        });
        break;
      }
      case 'quote': {
        children.push(new Paragraph({ children: [new TextRun({ text: htmlToText(b.data?.text), italics: true })] }));
        const cap = htmlToText(b.data?.caption);
        if (cap) children.push(new Paragraph({ children: [new TextRun({ text: `— ${cap}`, italics: true, size: 18 })] }));
        break;
      }
      case 'code':
        children.push(new Paragraph({ children: [new TextRun({ text: String(b.data?.code ?? ''), font: 'Courier New' })] }));
        break;
      case 'table':
        tableRows(b.data).forEach((row) => children.push(new Paragraph({ text: row.join('   |   ') })));
        break;
      case 'delimiter':
        children.push(new Paragraph({ text: '* * *', alignment: AlignmentType.CENTER }));
        break;
      default:
        break;
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);
  await fs.promises.writeFile(outPath, buffer);
}

// ── Markdown (zipped with images/) ───────────────────────────────────────────
async function renderMarkdownZip(title: string, blocks: EJBlock[], outPath: string): Promise<void> {
  const zip = new JSZip();
  const images = zip.folder('images');
  const lines: string[] = [];
  // Only add an explicit title when the note doesn't already open with a header.
  if (blocks[0]?.type !== 'header') lines.push(`# ${title}`, '');
  let imgIndex = 0;

  for (const b of blocks) {
    const url = imageBlockUrl(b);
    if (url) {
      const buf = await fetchImage(url);
      if (buf) {
        const meta = readImageMeta(buf);
        const name = `image_${String(++imgIndex).padStart(3, '0')}.${meta.type === 'jpg' ? 'jpg' : 'png'}`;
        images?.file(name, buf);
        const caption = htmlToText(b.data?.caption);
        lines.push(`![${caption}](images/${name})`, '');
      }
      continue;
    }
    switch (b.type) {
      case 'header':
        lines.push(`${'#'.repeat(Math.min(6, Number(b.data?.level) || 2))} ${htmlToText(b.data?.text)}`, '');
        break;
      case 'paragraph':
        lines.push(htmlToText(b.data?.text), '');
        break;
      case 'list': {
        const ordered = b.data?.style === 'ordered';
        listItems(b.data).forEach((item, i) => lines.push(`${ordered ? `${i + 1}.` : '-'} ${item}`));
        lines.push('');
        break;
      }
      case 'quote': {
        lines.push(`> ${htmlToText(b.data?.text)}`);
        const cap = htmlToText(b.data?.caption);
        if (cap) lines.push(`> — ${cap}`);
        lines.push('');
        break;
      }
      case 'code':
        lines.push('```', String(b.data?.code ?? ''), '```', '');
        break;
      case 'table': {
        const rows = tableRows(b.data);
        if (rows.length > 0) {
          lines.push(`| ${rows[0].join(' | ')} |`);
          lines.push(`| ${rows[0].map(() => '---').join(' | ')} |`);
          rows.slice(1).forEach((r) => lines.push(`| ${r.join(' | ')} |`));
          lines.push('');
        }
        break;
      }
      case 'delimiter':
        lines.push('---', '');
        break;
      default:
        break;
    }
  }

  zip.file('note.md', lines.join('\n'));
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.promises.writeFile(outPath, buffer);
}

const EXT: Record<NoteExportFormat, { ext: string; name: string }> = {
  pdf: { ext: 'pdf', name: 'PDF' },
  docx: { ext: 'docx', name: 'Word Document' },
  markdown: { ext: 'zip', name: 'Markdown Archive' },
};

export class NoteExportService {
  /** Prompt for a destination, render the note in the chosen format, write it. */
  async export(payload: NoteExportPayload): Promise<NoteExportResult> {
    const blocks = parseBlocks(payload.content);
    const cfg = EXT[payload.format];
    const safeTitle = sanitizeFileName(payload.title || 'note') || 'note';

    const win = BrowserWindow.getFocusedWindow() ?? undefined;
    const result = await dialog.showSaveDialog(win!, {
      defaultPath: `${safeTitle}.${cfg.ext}`,
      filters: [{ name: cfg.name, extensions: [cfg.ext] }],
    });
    if (result.canceled || !result.filePath) return { canceled: true, ok: false };
    const outPath = result.filePath;

    try {
      if (payload.format === 'pdf') await renderPdf(payload.title, blocks, outPath);
      else if (payload.format === 'docx') await renderDocx(payload.title, blocks, outPath);
      else await renderMarkdownZip(payload.title, blocks, outPath);
      return { ok: true, path: outPath };
    } catch (err) {
      log.error('note export failed', err);
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const noteExportService = new NoteExportService();
