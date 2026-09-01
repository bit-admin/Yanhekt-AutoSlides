import { useMemo, useState } from 'react';
import { payloadHasTimeline, type SharePayload } from '../../../autoslides/src/shared/shareLink';
import { timelineFromSharePayload } from '../../../autoslides/src/shared/shareTimeline';
import type { ResolvedImage } from '../resolver';
import { formatAcademicTerm } from '../lib/term';
import { triggerDownload } from '../lib/files';
import { Lightbox } from './Lightbox';

export interface ViewerMeta {
  courseId?: string;
  sessionId?: string;
  courseTitle?: string;
  sessionTitle?: string;
  instructor?: string;
  professors?: string[];
  college?: string;
  schoolYear?: string;
  semester?: string;
}

interface ShareDocumentProps {
  payload: SharePayload;
  images: ResolvedImage[];
  meta: ViewerMeta | null;
  /** Decoded share payload fragment (no leading `#`). */
  fragment: string;
}

type Busy = null | 'zip' | 'pdf' | 'timeline';
type Copied = null | 'current' | 'fragment';

const SHORT_PATH = /\/v1\/s\/[A-Za-z0-9]+\/?$/;

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}

function fileStem(payload: SharePayload, meta: ViewerMeta | null): string {
  const token = [payload.c && `c${payload.c}`, payload.s && `s${payload.s}`, payload.l && `l${payload.l}`]
    .filter(Boolean)
    .join('');
  const parts = [token, meta?.courseTitle, meta?.sessionTitle].filter(Boolean);
  return parts.join(' · ') || 'slides';
}

export function ShareDocument({ payload, images, meta, fragment }: ShareDocumentProps) {
  const [busy, setBusy] = useState<Busy>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const [copied, setCopied] = useState<Copied>(null);

  const urls = useMemo(() => images.map((i) => i.url), [images]);
  const resolvedCount = useMemo(() => urls.filter(Boolean).length, [urls]);
  const timelineJson = useMemo(() => {
    if (!payloadHasTimeline(payload)) return null;
    const tl = timelineFromSharePayload(payload);
    return tl ? JSON.stringify(tl, null, 2) : null;
  }, [payload]);
  const course = meta?.courseTitle || 'Shared slides';
  const session = meta?.sessionTitle || '';
  const term = formatAcademicTerm(meta?.schoolYear, meta?.semester);
  const byline = [meta?.instructor, meta?.college, term].filter(Boolean).join(' · ');
  const stem = fileStem(payload, meta);
  const isShortLink = SHORT_PATH.test(location.pathname);
  const fragmentUrl = `${location.origin}/v1#${fragment}`;

  const copyLink = async (kind: Exclude<Copied, null>, text: string) => {
    const ok = await copyText(text);
    if (!ok) return;
    setCopied(kind);
    window.setTimeout(() => setCopied((cur) => (cur === kind ? null : cur)), 1600);
  };

  const run = async (kind: Exclude<Busy, null>, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(kind);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="doc">
      <header className="doc__head">
        <div className="doc__share-links">
          <button
            type="button"
            className="text-link"
            onClick={() => void copyLink('current', location.href)}
          >
            {copied === 'current' ? 'Copied' : 'Copy link'}
          </button>
          {isShortLink && (
            <button
              type="button"
              className="text-link"
              onClick={() => void copyLink('fragment', fragmentUrl)}
            >
              {copied === 'fragment' ? 'Copied' : 'Copy full link'}
            </button>
          )}
        </div>
        <h1 className="doc__title">{course || 'Shared slides'}</h1>
        {session && <p className="doc__session">{session}</p>}
        <p className="doc__meta">
          {[
            `${resolvedCount} ${resolvedCount === 1 ? 'slide' : 'slides'}`,
            byline,
            'shared via AutoSlides',
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <div className="doc__actions">
          <button
            className="btn"
            disabled={busy !== null || resolvedCount === 0}
            onClick={() =>
              run('zip', async () => {
                const { downloadAllZip } = await import('../lib/zip');
                await downloadAllZip(urls, stem, timelineJson);
              })
            }
          >
            {busy === 'zip' ? 'Zipping…' : 'Download all'}
          </button>
          <button
            className="btn"
            disabled={busy !== null || resolvedCount === 0}
            onClick={() =>
              run('pdf', async () => {
                const { saveAsPdf } = await import('../lib/pdf');
                await saveAsPdf(urls, stem);
              })
            }
          >
            {busy === 'pdf' ? 'Building PDF…' : 'Save as PDF'}
          </button>
          <button
            className="btn"
            disabled={busy !== null || !timelineJson}
            title={timelineJson ? 'Download timeline.json' : 'This share has no slide timeline'}
            onClick={() =>
              run('timeline', async () => {
                if (!timelineJson) return;
                triggerDownload(new Blob([timelineJson], { type: 'application/json' }), `${stem}-timeline.json`);
              })
            }
          >
            {busy === 'timeline' ? 'Saving…' : 'Download timeline'}
          </button>
        </div>
      </header>

      <main className="doc__body">
        {images.map((img) =>
          img.url ? (
            <figure className="slide" key={img.index}>
              <img
                className="slide__img"
                src={img.url}
                alt={`Slide ${img.index + 1}`}
                loading="lazy"
                onClick={() => setZoom(img.url)}
              />
            </figure>
          ) : (
            <div className="slide slide--missing" key={img.index}>
              Slide {img.index + 1} could not be resolved.
            </div>
          ),
        )}
      </main>

      <footer className="doc__foot">
        Slides are aggregated from public objects. This page may contain copyrighted material shared
        for personal study and non-commercial educational use; all rights remain with their holders.
      </footer>

      {zoom && <Lightbox url={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}
