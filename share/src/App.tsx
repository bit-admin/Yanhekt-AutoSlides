import { useEffect, useState } from 'react';
import { decodeSharePayload, type SharePayload } from '../../autoslides/src/shared/shareLink';
import { resolveImages, type ResolvedImage } from './resolver';
import { ShareDocument } from './components/ShareDocument';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; payload: SharePayload; images: ResolvedImage[] };

/** Get the encoded fragment, from the URL hash or a /v1/s/<id> short link. */
async function loadFragment(): Promise<string | null> {
  if (location.hash.length > 1) return location.hash.slice(1);

  const m = location.pathname.match(/\/v1\/s\/([A-Za-z0-9]+)\/?$/);
  if (m) {
    try {
      const res = await fetch(`/v1/api/get?id=${encodeURIComponent(m[1])}`);
      if (res.ok) {
        const data = (await res.json()) as { fragment?: string };
        return data.fragment ?? null;
      }
    } catch {
      /* fall through to error state */
    }
  }
  return null;
}

export function App() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fragment = await loadFragment();
      if (cancelled) return;
      if (!fragment) {
        setState({ kind: 'error', message: 'This link has no share data.' });
        return;
      }
      const payload = decodeSharePayload(fragment);
      if (!payload) {
        setState({ kind: 'error', message: 'This share link is invalid or corrupted.' });
        return;
      }
      try {
        const images = await resolveImages(payload);
        if (!cancelled) setState({ kind: 'ready', payload, images });
      } catch {
        if (!cancelled) setState({ kind: 'error', message: 'Could not load the slides from the server.' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === 'loading') {
    return <div className="state">Loading slides…</div>;
  }
  if (state.kind === 'error') {
    return (
      <div className="state state--error">
        <p>{state.message}</p>
      </div>
    );
  }
  return <ShareDocument payload={state.payload} images={state.images} />;
}
