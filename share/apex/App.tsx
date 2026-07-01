import { useCallback, useEffect, useState } from 'react';

/** A lecture summary as returned by /v2/api/{search,lecture,stats}. */
interface Lecture {
  courseId: string;
  sessionId: string;
  courseTitle?: string;
  sessionTitle?: string;
  instructor?: string;
  professors?: string[];
  semester?: string;
  schoolYear?: string;
  college?: string;
  versionCount?: number;
  updatedAt?: string;
}

interface Version {
  shareId: string;
  title?: string;
  imageCount?: number;
  reviewed: boolean;
  edited: boolean;
  createdAt?: string;
}

interface Stats {
  courseCount: number;
  lectureCount: number;
  versionCount: number;
  recent: Lecture[];
  colleges: { college: string; count: number }[];
}

const API = '/v2/api';

function lectureUrl(l: Pick<Lecture, 'courseId' | 'sessionId'>): string {
  return `/?l=${encodeURIComponent(l.courseId)}.${encodeURIComponent(l.sessionId)}`;
}

function termLabel(l: Lecture): string {
  return [l.schoolYear, l.semester ? `Term ${l.semester}` : '', l.college]
    .filter(Boolean)
    .join(' · ');
}

/** Resolve the lecture id from the URL (?l=<courseId>.<sessionId>), if present. */
function readRoute(): { courseId: string; sessionId: string } | null {
  const l = new URLSearchParams(window.location.search).get('l');
  if (!l) return null;
  const dot = l.indexOf('.');
  if (dot < 0) return null;
  return { courseId: l.slice(0, dot), sessionId: l.slice(dot + 1) };
}

export function App() {
  const [route, setRoute] = useState(readRoute());

  useEffect(() => {
    const onPop = () => setRoute(readRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const go = useCallback((url: string) => {
    window.history.pushState(null, '', url);
    setRoute(readRoute());
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="page">
      {route ? (
        <LectureView courseId={route.courseId} sessionId={route.sessionId} onBack={() => go('/')} />
      ) : (
        <Home go={go} />
      )}
    </div>
  );
}

function Home({ go }: { go: (url: string) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Lecture[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pasteLink, setPasteLink] = useState('');
  const [showPaste, setShowPaste] = useState(false);

  useEffect(() => {
    fetch(`${API}/stats`)
      .then((r) => r.json())
      .then((d) => setStats(d.stats ?? null))
      .catch(() => setStats(null));
  }, []);

  const runSearch = useCallback(async (term: string) => {
    setSearching(true);
    try {
      const r = await fetch(`${API}/search?q=${encodeURIComponent(term)}`);
      const d = await r.json();
      setResults(Array.isArray(d.results) ? d.results : []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const onOpenV1 = useCallback(() => {
    const v = pasteLink.trim();
    if (!v) return;
    // A full URL → open as-is; a bare fragment/payload → open under /v1/.
    if (/^https?:\/\//.test(v)) window.location.href = v;
    else if (v.startsWith('/v1/')) window.location.href = v;
    else window.location.href = `/v1/${v.startsWith('#') ? v : `#${v.replace(/^#/, '')}`}`;
  }, [pasteLink]);

  const lectures = results ?? stats?.recent ?? [];

  return (
    <main className="home">
      <section className="hero">
        <div className="wordmark">
          <span className="wordmark-mark">▦</span> AutoSlides <span className="wordmark-dim">Index</span>
        </div>
        {showPaste ? (
          <form
            className="search-shell"
            onSubmit={(e) => {
              e.preventDefault();
              onOpenV1();
            }}
          >
            <div className="search">
              <LinkIcon className="search-icon" />
              <input
                className="search-input"
                placeholder="Paste a share link (…/v1/s/… or #fragment)"
                value={pasteLink}
                onChange={(e) => setPasteLink(e.target.value)}
                autoFocus
              />
              <button className="search-submit" type="submit" aria-label="Open" disabled={!pasteLink.trim()}>
                <ArrowIcon />
              </button>
            </div>
          </form>
        ) : (
          <form
            className="search-shell"
            onSubmit={(e) => {
              e.preventDefault();
              void runSearch(q);
            }}
          >
            <div className="search">
              <SearchIcon className="search-icon" />
              <input
                className="search-input"
                placeholder="Search by course, session, instructor, or college…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoFocus
              />
              <button className="search-submit" type="submit" aria-label="Search" disabled={searching}>
                {searching ? <SpinnerIcon /> : <SearchIcon />}
              </button>
            </div>
          </form>
        )}

        <button className="paste-toggle" type="button" onClick={() => setShowPaste((v) => !v)}>
          {showPaste ? 'Search instead' : 'Have a share link?'}
        </button>
      </section>

      <section className="feed">
        <div className="feed-header">
          <h2>{results ? `Results${q ? ` for "${q}"` : ''}` : 'Recently added'}</h2>
          {!results && stats && (
            <span className="feed-stats">
              {stats.courseCount.toLocaleString()} courses · {stats.lectureCount.toLocaleString()} lectures ·{' '}
              {stats.versionCount.toLocaleString()} versions
            </span>
          )}
        </div>
        {lectures.length === 0 ? (
          <p className="empty">
            {results ? 'No lectures matched your search.' : 'Nothing here yet.'}
          </p>
        ) : (
          <div className="card-grid">
            {lectures.map((l) => (
              <button
                key={`${l.courseId}.${l.sessionId}`}
                className="card"
                onClick={() => go(lectureUrl(l))}
              >
                <div className="card-title">{l.courseTitle || 'Untitled course'}</div>
                <div className="card-sub">{l.sessionTitle || ''}</div>
                <div className="card-meta">{l.instructor || (l.professors ?? []).join(', ')}</div>
                <div className="card-foot">
                  <span className="card-term">{termLabel(l)}</span>
                  {l.versionCount ? (
                    <span className="pill">{l.versionCount} version{l.versionCount > 1 ? 's' : ''}</span>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function LectureView({
  courseId,
  sessionId,
  onBack,
}: {
  courseId: string;
  sessionId: string;
  onBack: () => void;
}) {
  const [data, setData] = useState<{ lecture: Lecture; versions: Version[] } | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    setStatus('loading');
    fetch(`${API}/lecture?courseId=${encodeURIComponent(courseId)}&sessionId=${encodeURIComponent(sessionId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setData({ lecture: d.lecture, versions: d.versions ?? [] });
          setStatus('ok');
        } else {
          setStatus('error');
        }
      })
      .catch(() => setStatus('error'));
  }, [courseId, sessionId]);

  return (
    <main className="lecture">
      <button className="back" onClick={onBack}>← Back</button>
      {status === 'loading' && <p className="empty">Loading…</p>}
      {status === 'error' && <p className="empty">This lecture isn’t in the index.</p>}
      {status === 'ok' && data && (
        <>
          <h1>{data.lecture.courseTitle || 'Untitled course'}</h1>
          <p className="lecture-sub">{data.lecture.sessionTitle}</p>
          <p className="lecture-meta">
            {[data.lecture.instructor || (data.lecture.professors ?? []).join(', '), termLabel(data.lecture)]
              .filter(Boolean)
              .join(' · ')}
          </p>

          <h2>{data.versions.length} version{data.versions.length === 1 ? '' : 's'}</h2>
          <div className="version-list">
            {data.versions.map((v, i) => (
              <a key={v.shareId} className="version" href={`/v1/s/${v.shareId}`}>
                <div className="version-head">
                  <span className="version-ord">#{i + 1}</span>
                  <span className="version-count">{v.imageCount ?? '?'} slides</span>
                  {v.reviewed && <span className="badge badge-reviewed">Human Reviewed</span>}
                  {v.edited && <span className="badge badge-edited">Human Edited</span>}
                </div>
                <div className="version-foot">
                  <span>Open in viewer →</span>
                  {v.createdAt && <span>{new Date(v.createdAt).toLocaleDateString()}</span>}
                </div>
              </a>
            ))}
          </div>
        </>
      )}
    </main>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="spinner-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="42"
        strokeDashoffset="14"
      />
    </svg>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9.5 14.5 14.5 9.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M11 7.5 12.4 6.1a3.5 3.5 0 0 1 5 5L16 12.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M13 16.5 11.6 17.9a3.5 3.5 0 0 1-5-5L8 11.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <polyline
        points="13 6 19 12 13 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

