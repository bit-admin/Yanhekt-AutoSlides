import { useEffect, useState } from 'react';
import { decodeSharePayload, type SharePayload } from '../../autoslides/src/shared/shareLink';
import { resolveImages, type ResolvedImage } from './resolver';
import { ShareDocument, type ViewerMeta } from './components/ShareDocument';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; payload: SharePayload; images: ResolvedImage[]; meta: ViewerMeta | null };

async function fetchMeta(courseId?: string, sessionId?: string): Promise<ViewerMeta | null> {
  if (!courseId && !sessionId) return null;
  const params = new URLSearchParams();
  if (courseId) params.set('courseId', courseId);
  if (sessionId) params.set('sessionId', sessionId);
  try {
    const res = await fetch(`/v1/api/meta?${params}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { meta?: ViewerMeta };
    return data.meta ?? null;
  } catch {
    return null;
  }
}

async function loadShare(): Promise<{ fragment: string; meta: ViewerMeta | null } | null> {
  if (location.hash.length > 1) {
    const fragment = location.hash.slice(1);
    const payload = decodeSharePayload(fragment);
    const meta = payload ? await fetchMeta(payload.c, payload.s) : null;
    return { fragment, meta };
  }

  const m = location.pathname.match(/\/v1\/s\/([A-Za-z0-9]+)\/?$/);
  if (m) {
    try {
      const res = await fetch(`/v1/api/get?id=${encodeURIComponent(m[1])}`);
      if (res.ok) {
        const data = (await res.json()) as { fragment?: string; meta?: ViewerMeta | null };
        if (data.fragment) return { fragment: data.fragment, meta: data.meta ?? null };
      }
    } catch {
      /* fall through */
    }
  }
  return null;
}

export function App() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await loadShare();
      if (cancelled) return;
      if (!loaded) {
        setState({ kind: 'error', message: 'This link has no share data.' });
        return;
      }
      const payload = decodeSharePayload(loaded.fragment);
      if (!payload) {
        setState({ kind: 'error', message: 'This share link is invalid or corrupted.' });
        return;
      }
      try {
        const images = await resolveImages(payload);
        if (!cancelled) setState({ kind: 'ready', payload, images, meta: loaded.meta });
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
  return <ShareDocument payload={state.payload} images={state.images} meta={state.meta} />;
}
