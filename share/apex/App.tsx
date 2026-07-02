import { useCallback, useEffect, useMemo, useState } from 'react';
import { groupLectures, schoolYearRank, semesterRank } from './lectureSort';

declare global {
  interface Window {
    /** Injected by the Electron Cloud Index page so removal can auth silently. */
    __autoslidesToken?: string;
  }
}

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
  weekNumber?: number;
  day?: number;
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

function semesterLabel(semester?: string): string {
  if (semester === '1') return 'Fall';
  if (semester === '2') return 'Spring';
  return semester ? `Term ${semester}` : '';
}

function fileCountLabel(n?: number): string {
  return n ? `${n} file${n > 1 ? 's' : ''}` : '';
}

function termLabel(l: Lecture): string {
  return [l.schoolYear, semesterLabel(l.semester), l.college]
    .filter(Boolean)
    .join(' · ');
}

/** Encodes a lecture's term as a stable filter key, e.g. "2025-2026||1". */
function termKey(l: Lecture): string {
  return `${l.schoolYear ?? ''}||${l.semester ?? ''}`;
}

function termOptionLabel(l: Lecture): string {
  return [l.schoolYear, semesterLabel(l.semester)].filter(Boolean).join(' · ');
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
  const [collegeFilter, setCollegeFilter] = useState<string | null>(null);
  const [termFilter, setTermFilter] = useState<string | null>(null);
  const [instructorFilter, setInstructorFilter] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/stats`)
      .then((r) => r.json())
      .then((d) => setStats(d.stats ?? null))
      .catch(() => setStats(null));
  }, []);

  const runSearch = useCallback(async (term: string) => {
    setSearching(true);
    setCollegeFilter(null);
    setTermFilter(null);
    setInstructorFilter(null);
    setSelectedCourseId(null);
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
  const hasResults = results !== null;

  const colleges = useMemo(() => {
    if (!results) return [];
    const set = new Set(results.map((l) => l.college).filter((v): v is string => !!v));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh'));
  }, [results]);

  const terms = useMemo(() => {
    if (!results) return [];
    const byKey = new Map<string, Lecture>();
    for (const l of results) {
      if (!l.schoolYear && !l.semester) continue;
      const key = termKey(l);
      if (!byKey.has(key)) byKey.set(key, l);
    }
    return Array.from(byKey.entries())
      .map(([key, l]) => ({ key, label: termOptionLabel(l), l }))
      .sort((a, b) => {
        const yearDiff = schoolYearRank(b.l.schoolYear) - schoolYearRank(a.l.schoolYear);
        if (yearDiff !== 0) return yearDiff;
        return semesterRank(b.l.semester) - semesterRank(a.l.semester);
      });
  }, [results]);

  const instructors = useMemo(() => {
    if (!results) return [];
    const set = new Set(
      results.map((l) => l.instructor || (l.professors ?? []).join(', ')).filter((v): v is string => !!v),
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh'));
  }, [results]);

  const filtered = useMemo(() => {
    if (!results) return lectures;
    return results.filter((l) => {
      if (collegeFilter && l.college !== collegeFilter) return false;
      if (termFilter && termKey(l) !== termFilter) return false;
      if (instructorFilter && (l.instructor || (l.professors ?? []).join(', ')) !== instructorFilter) return false;
      return true;
    });
  }, [results, lectures, collegeFilter, termFilter, instructorFilter]);

  const groups = useMemo(() => (hasResults ? groupLectures(filtered) : []), [hasResults, filtered]);
  const showFilterBar = hasResults && (colleges.length > 1 || terms.length > 1 || instructors.length > 1);

  // Unfiltered by college/term/instructor — clicking into a course should show all of
  // its sessions from the current search, regardless of the active filter selection.
  const courseGroups = useMemo(() => (hasResults ? groupLectures(results ?? []) : []), [hasResults, results]);
  const selectedCourse = useMemo(
    () => (selectedCourseId ? courseGroups.find((g) => g.courseId === selectedCourseId) ?? null : null),
    [selectedCourseId, courseGroups],
  );

  if (selectedCourse) {
    return (
      <main className="lecture">
        <button className="back" onClick={() => setSelectedCourseId(null)}>← Back</button>
        <div className="lecture-head">
          <h1 className="lecture-title">{selectedCourse.courseTitle}</h1>
        </div>
        <p className="lecture-meta">
          {[
            selectedCourse.items[0].instructor || (selectedCourse.items[0].professors ?? []).join(', '),
            termLabel(selectedCourse.items[0]),
            `${selectedCourse.items.length} session${selectedCourse.items.length > 1 ? 's' : ''}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <div className="result-list result-list--flat">
          {selectedCourse.items.map((l) => (
            <button
              key={`${l.courseId}.${l.sessionId}`}
              className="result-item"
              onClick={() => go(lectureUrl(l))}
            >
              <div className="result-title">
                <span className="result-session">{l.sessionTitle || 'Untitled session'}</span>
              </div>
              <div className="result-meta">
                {[
                  l.instructor || (l.professors ?? []).join(', '),
                  termLabel(l),
                  fileCountLabel(l.versionCount),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </button>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className={hasResults ? 'home home--results' : 'home'}>
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
              {stats.versionCount.toLocaleString()} files
            </span>
          )}
        </div>

        {showFilterBar && (
          <div className="filter-bar">
            {colleges.length > 1 && (
              <select
                className="filter-select"
                value={collegeFilter ?? ''}
                onChange={(e) => setCollegeFilter(e.target.value || null)}
              >
                <option value="">All colleges</option>
                {colleges.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
            {terms.length > 1 && (
              <select
                className="filter-select"
                value={termFilter ?? ''}
                onChange={(e) => setTermFilter(e.target.value || null)}
              >
                <option value="">All terms</option>
                {terms.map((t) => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            )}
            {instructors.length > 1 && (
              <select
                className="filter-select"
                value={instructorFilter ?? ''}
                onChange={(e) => setInstructorFilter(e.target.value || null)}
              >
                <option value="">All instructors</option>
                {instructors.map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {hasResults ? (
          groups.length === 0 ? (
            <p className="empty">
              {results && results.length === 0
                ? 'No lectures matched your search.'
                : 'No lectures match the selected filters.'}
            </p>
          ) : (
            <div className="result-groups">
              {groups.map((group) => (
                <div className="result-group" key={group.courseId}>
                  <div className="result-group-header">
                    <button
                      className="result-group-title"
                      onClick={() => setSelectedCourseId(group.courseId)}
                    >
                      {group.courseTitle}
                    </button>
                    <div className="result-group-meta">
                      {[
                        group.items[0].instructor || (group.items[0].professors ?? []).join(', '),
                        termLabel(group.items[0]),
                        `${group.items.length} session${group.items.length > 1 ? 's' : ''}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                  <div className="result-list">
                    {group.items.map((l) => (
                      <button
                        key={`${l.courseId}.${l.sessionId}`}
                        className="result-item"
                        onClick={() => go(lectureUrl(l))}
                      >
                        <div className="result-title">
                          <span className="result-session">{l.sessionTitle || 'Untitled session'}</span>
                        </div>
                        <div className="result-meta">
                          {[
                            l.instructor || (l.professors ?? []).join(', '),
                            termLabel(l),
                            fileCountLabel(l.versionCount),
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : lectures.length === 0 ? (
          <p className="empty">Nothing here yet.</p>
        ) : (
          <div className="result-list">
            {lectures.map((l) => (
              <button
                key={`${l.courseId}.${l.sessionId}`}
                className="result-item"
                onClick={() => go(lectureUrl(l))}
              >
                <div className="result-title">
                  <span className="result-course">{l.courseTitle || 'Untitled course'}</span>
                  {l.sessionTitle && <span className="result-session"> {l.sessionTitle}</span>}
                </div>
                <div className="result-meta">
                  {[
                    l.instructor || (l.professors ?? []).join(', '),
                    termLabel(l),
                    fileCountLabel(l.versionCount),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
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
  const [showRemoval, setShowRemoval] = useState(false);

  const load = useCallback(
    (bust = false) => {
      setStatus('loading');
      const cb = bust ? `&_=${Date.now()}` : '';
      fetch(`${API}/lecture?courseId=${encodeURIComponent(courseId)}&sessionId=${encodeURIComponent(sessionId)}${cb}`)
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
    },
    [courseId, sessionId],
  );

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="lecture">
      <button className="back" onClick={onBack}>← Back</button>
      {status === 'loading' && <p className="empty">Loading…</p>}
      {status === 'error' && <p className="empty">This lecture isn’t in the index.</p>}
      {status === 'ok' && data && (
        <>
          <div className="lecture-head">
            <h1 className="lecture-title">
              {[data.lecture.courseTitle || 'Untitled course', data.lecture.sessionTitle]
                .filter(Boolean)
                .join(' ')}
            </h1>
            <button
              className="removal-btn"
              type="button"
              aria-label="Request removal"
              title="Request removal"
              onClick={() => setShowRemoval(true)}
            >
              <FlagIcon />
            </button>
          </div>
          <p className="lecture-meta">
            {[data.lecture.instructor || (data.lecture.professors ?? []).join(', '), termLabel(data.lecture)]
              .filter(Boolean)
              .join(' · ')}
          </p>

          <h2>{data.versions.length} file{data.versions.length === 1 ? '' : 's'} indexed</h2>
          <div className="version-list">
            {data.versions.map((v, i) => (
              <a key={v.shareId} className="version" href={`/v1/s/${v.shareId}`}>
                <span className="version-ord">Slides #{i + 1}</span>
                {v.createdAt && <span className="version-date">{new Date(v.createdAt).toLocaleDateString()}</span>}
                <span className="version-count">{v.imageCount ?? '?'} slides</span>
                {v.edited && <span className="version-edited">Edited</span>}
                {v.reviewed && <VerifiedIcon />}
              </a>
            ))}
          </div>
        </>
      )}
      {showRemoval && (
        <RemovalModal
          courseId={courseId}
          sessionId={sessionId}
          onClose={() => setShowRemoval(false)}
          onRemoved={(lectureRemoved) => {
            setShowRemoval(false);
            if (lectureRemoved) onBack();
            else load(true);
          }}
        />
      )}
    </main>
  );
}

function RemovalModal({
  courseId,
  sessionId,
  onClose,
  onRemoved,
}: {
  courseId: string;
  sessionId: string;
  onClose: () => void;
  onRemoved: (lectureRemoved: boolean) => void;
}) {
  // In the Electron Cloud Index page the app injects the signed-in user's token,
  // so we skip the manual paste field and just confirm. On the plain web the user
  // pastes their auth token.
  const injected = typeof window !== 'undefined' ? window.__autoslidesToken : undefined;
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // `changed` distinguishes an actual removal (parent must refresh) from a no-op.
  const [done, setDone] = useState<{ message: string; changed: boolean; lectureRemoved: boolean } | null>(null);

  const submit = useCallback(async () => {
    const t = (injected || token).trim();
    if (!t) return;
    setBusy(true);
    setError('');
    try {
      const r = await fetch(`${API}/request-removal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ courseId, sessionId }),
      });
      if (r.status === 401) {
        setError('Invalid or expired token.');
        return;
      }
      const d = await r.json();
      if (!d.ok) {
        setError('Removal failed. Please try again.');
        return;
      }
      if (d.removed === 0) {
        setDone({ message: 'You haven’t uploaded any versions of this lecture.', changed: false, lectureRemoved: false });
        return;
      }
      const lectureRemoved = !!d.lectureRemoved;
      setDone({
        message: `Removed ${d.removed} version${d.removed === 1 ? '' : 's'} you uploaded.`,
        changed: true,
        lectureRemoved,
      });
      // Brief confirmation, then refresh the parent view.
      setTimeout(() => onRemoved(lectureRemoved), 900);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  }, [injected, token, courseId, sessionId, onRemoved]);

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="removal-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="removal-modal-title">Request removal</h3>
        {done ? (
          <p className="removal-modal-body">{done.message}</p>
        ) : (
          <>
            <p className="removal-modal-body">
              This removes only the version(s) you uploaded for this lecture. Other
              contributors’ versions are unaffected.
            </p>
            {!injected && (
              <input
                className="removal-input"
                type="password"
                placeholder="Paste your auth token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoFocus
              />
            )}
            {error && <p className="removal-error">{error}</p>}
          </>
        )}
        <div className="removal-actions">
          {done ? (
            <button
              className="removal-cancel"
              type="button"
              onClick={() => (done.changed ? onRemoved(done.lectureRemoved) : onClose())}
            >
              Close
            </button>
          ) : (
            <>
              <button className="removal-cancel" type="button" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button
                className="removal-confirm"
                type="button"
                onClick={() => void submit()}
                disabled={busy || (!injected && !token.trim())}
              >
                {busy ? 'Removing…' : 'Remove'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
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

function FlagIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 3v18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M5 4h11l-2 3.5L16 11H5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function VerifiedIcon() {
  return (
    <svg className="version-verified" width="16" height="16" viewBox="0 0 24 24" aria-label="Human reviewed">
      {/* Scalloped badge (a ring of overlapping circles), not a plain circle. */}
      <g fill="currentColor">
        <circle cx="20.2" cy="12" r="3.3" />
        <circle cx="17.8" cy="17.8" r="3.3" />
        <circle cx="12" cy="20.2" r="3.3" />
        <circle cx="6.2" cy="17.8" r="3.3" />
        <circle cx="3.8" cy="12" r="3.3" />
        <circle cx="6.2" cy="6.2" r="3.3" />
        <circle cx="12" cy="3.8" r="3.3" />
        <circle cx="17.8" cy="6.2" r="3.3" />
        <circle cx="12" cy="12" r="7.2" />
      </g>
      <path
        d="M7.9 12.4 10.5 15 16.3 9"
        stroke="#fff"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

