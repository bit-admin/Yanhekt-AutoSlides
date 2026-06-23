import { useMemo, useState } from 'react';
import type { SharePayload } from '../../../autoslides/src/shared/shareLink';
import type { ResolvedImage } from '../resolver';
import { parseTitle } from '../lib/title';
import { Lightbox } from './Lightbox';

interface ShareDocumentProps {
  payload: SharePayload;
  images: ResolvedImage[];
}

type Busy = null | 'zip' | 'pdf';

export function ShareDocument({ payload, images }: ShareDocumentProps) {
  const [busy, setBusy] = useState<Busy>(null);
  const [zoom, setZoom] = useState<string | null>(null);

  const urls = useMemo(() => images.map((i) => i.url), [images]);
  const resolvedCount = useMemo(() => urls.filter(Boolean).length, [urls]);
  const { course, session } = useMemo(() => parseTitle(payload.t), [payload.t]);

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
        <h1 className="doc__title">{course || 'Shared slides'}</h1>
        {session && <p className="doc__session">{session}</p>}
        <p className="doc__meta">
          {resolvedCount} {resolvedCount === 1 ? 'slide' : 'slides'} · shared via AutoSlides
        </p>
        <div className="doc__actions">
          <button
            className="btn"
            disabled={busy !== null || resolvedCount === 0}
            onClick={() =>
              run('zip', async () => {
                const { downloadAllZip } = await import('../lib/zip');
                await downloadAllZip(urls, payload.t);
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
                await saveAsPdf(urls, payload.t);
              })
            }
          >
            {busy === 'pdf' ? 'Building PDF…' : 'Save as PDF'}
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
