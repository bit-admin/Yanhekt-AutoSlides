import { useEffect, useState } from 'react';
import {
  ApiError,
  appCourseUrl,
  appSessionUrl,
  courseSessions,
  search,
  webCourseUrl,
  webSessionUrl,
  yanhektCourse,
  yanhektCourseUrl,
  yanhektSessions,
  yanhektSessionUrl,
  type CourseResult,
  type YanhektCourse,
  type YanhektSession,
  type YanhektSessionRow,
} from '../api';
import { AppLink, AppMissingHint, useAppLaunch } from '../components/AppLink';
import { CopyButton, Footer, Header, useTerms } from '../components/Chrome';
import { termLabel, useLang, useNumber, useT, type Strings } from '../i18n';
import { isIdentifier } from '../query';
import { navigate, searchHref } from '../router';
import { defaultTerm } from '../terms';

type State =
  | { kind: 'loading' }
  | { kind: 'done'; course: CourseResult; sessions: number[] }
  | { kind: 'missing' }
  | { kind: 'error'; code: string };

/** Yanhekt's side of the page: the course, and the sessions read so far (by id). */
type Live = {
  course: YanhektCourse | null;
  rows: Map<number, YanhektSessionRow>;
  /** Every page of sessions has been read. */
  complete: boolean;
  /** Yanhekt could not be read at all. */
  failed: boolean;
};

const emptyLive = (): Live => ({ course: null, rows: new Map(), complete: false, failed: false });

export function Course({ id }: { id: number }) {
  const t = useT();
  const num = useNumber();
  const lang = useLang();
  const info = useTerms();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [live, setLive] = useState<Live>(emptyLive);
  const app = useAppLaunch();

  useEffect(() => {
    const ac = new AbortController();
    setState({ kind: 'loading' });
    // The course card comes from an id lookup; its session ids from the sessions endpoint. Both cached at the edge.
    Promise.all([search(String(id), null, ac.signal), courseSessions(id, ac.signal)])
      .then(([found, s]) => {
        const course = found.results.find((r) => r.id === id);
        setState(course ? { kind: 'done', course, sessions: s.sessions } : { kind: 'missing' });
      })
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return;
        if (err instanceof ApiError && err.code === 'not-found') setState({ kind: 'missing' });
        else setState({ kind: 'error', code: err instanceof ApiError ? err.code : 'network' });
      });
    return () => ac.abort();
  }, [id]);

  // Yanhekt's details, read through our API: the course at once, the sessions page by page.
  useEffect(() => {
    const ac = new AbortController();
    setLive(emptyLive());
    yanhektCourse(id, ac.signal)
      .then(({ course }) => setLive((l) => ({ ...l, course })))
      .catch(() => {
        /* the Index facts stand on their own */
      });
    (async () => {
      let from: number | null = 0;
      while (from !== null) {
        const page = await yanhektSessions(id, from, ac.signal);
        setLive((l) => {
          const rows = new Map(l.rows);
          for (const r of page.sessions) rows.set(r.id, r);
          return { ...l, rows };
        });
        from = page.next;
      }
      setLive((l) => ({ ...l, complete: true }));
    })().catch((err) => {
      if ((err as Error).name === 'AbortError') return;
      setLive((l) => ({ ...l, complete: true, failed: l.rows.size === 0 }));
    });
    return () => ac.abort();
  }, [id]);

  useEffect(() => {
    document.title = state.kind === 'done' ? `${state.course.name} (${id}) - Index` : `${id} - Index`;
  }, [state, id]);

  const onSearch = (value: string) =>
    navigate(searchHref(value, isIdentifier(value) ? null : state.kind === 'done' ? state.course.term : info ? defaultTerm(info.terms) : null));

  return (
    <div className="page">
      <Header q="" onSearch={onSearch} />
      <main className="main main--wide">
        {state.kind === 'loading' && <p className="stats">{t.loading}</p>}
        {state.kind === 'missing' && <p className="notice">{t.courseNotFound(String(id))}</p>}
        {state.kind === 'error' && <p className="notice">{t.errors[state.code] ?? t.errors.internal}</p>}
        {state.kind === 'done' && (
          <CoursePage id={id} course={state.course} sessionIds={state.sessions} live={live} app={app} t={t} num={num} lang={lang} />
        )}
      </main>
      <Footer info={info} />
    </div>
  );
}

function CoursePage({
  id,
  course,
  sessionIds,
  live,
  app,
  t,
  num,
  lang,
}: {
  id: number;
  course: CourseResult;
  sessionIds: number[];
  live: Live;
  app: ReturnType<typeof useAppLaunch>;
  t: Strings;
  num: (n: number) => string;
  lang: 'zh' | 'en';
}) {
  const yc = live.course;
  const nameEn = yc?.nameEn && yc.nameEn !== course.name ? yc.nameEn : null;
  const college = lang === 'en' ? (yc?.collegeEn ?? yc?.college) : yc?.college;
  const teachers = course.teachers.length > 0 ? course.teachers : (yc?.teachers ?? []);

  const details = sessionIds.map((s) => live.rows.get(s));
  const recorded = live.complete && !live.failed ? details.filter((d) => d && 'recorded' in d && d.recorded).length : null;

  // Index order (ascending ids) while loading, so rows do not jump; by start time once everything is in.
  const order = live.complete ? [...sessionIds].sort(byStart(live.rows)) : sessionIds;

  return (
    <div className="course">
      <div className="course__head">
        <h1 className="course__name">{course.name}</h1>
        <p className="course__term">
          {nameEn && <span lang="en">{nameEn} · </span>}
          {termLabel(t, course.term)}
        </p>
        <div className="course__actions">
          <a className="pill pill--primary" href={yanhektCourseUrl(id)} target="_blank" rel="noreferrer">
            {t.openOnYanhekt} ↗
          </a>
          <a className="pill" href={webCourseUrl(id)} target="_blank" rel="noreferrer">
            {t.openOnWeb} ↗
          </a>
          <AppLink className="pill" href={appCourseUrl(id)} onLaunch={() => app.watch('course')} />
        </div>
        {app.missing === 'course' && <AppMissingHint />}
      </div>

      <aside className="panel" aria-label={t.aboutCourse}>
        <div className="panel__head">
          <h2 className="panel__title">{t.aboutCourse}</h2>
          {yc?.image && <CourseImage src={yc.image} />}
        </div>
        <dl className="facts">
          <dt>{t.courseId}</dt>
          <dd>
            <code>{id}</code> <CopyButton text={String(id)} />
          </dd>
          <dt>{t.number}</dt>
          <dd>
            {course.number ? (
              <>
                <code>{course.number}</code> <CopyButton text={course.number} />
              </>
            ) : (
              '—'
            )}
          </dd>
          {yc?.code && (
            <>
              <dt>{t.courseCode}</dt>
              <dd>
                <code>{yc.code}</code> <CopyButton text={yc.code} />
              </dd>
            </>
          )}
          <dt>{t.term}</dt>
          <dd>{termLabel(t, course.term)}</dd>
          {college && (
            <>
              <dt>{t.college}</dt>
              <dd>{college}</dd>
            </>
          )}
          {yc?.level && (
            <>
              <dt>{t.level}</dt>
              <dd>{t.levelName(yc.level)}</dd>
            </>
          )}
          <dt>{t.teachers}</dt>
          <dd>{teachers.length > 0 ? teachers.join('、') : t.noTeachers}</dd>
          <dt>{t.sessionsLabel}</dt>
          <dd>{t.sessionsSummary(num(sessionIds.length), recorded === null ? null : num(recorded))}</dd>
        </dl>
      </aside>

      <section className="sessions">
        <h2>{t.sessionsHeading}</h2>
        {live.failed && <p className="sessions__note">{t.yanhektFailed}</p>}
        {sessionIds.length === 0 ? (
          <p>{t.noSessions}</p>
        ) : (
          <ol className="lectures">
            {order.map((s) => (
              <Lecture key={s} courseId={id} id={s} row={live.rows.get(s)} pending={!live.complete} app={app} t={t} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

/** A course or college picture from Yanhekt; dropped if it does not load. */
function CourseImage({ src }: { src: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return <img className="panel__image" src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setOk(false)} />;
}

/** One session, laid out like a search result: where and when, the title, the state, the other ways to open it. */
function Lecture({
  courseId,
  id,
  row,
  pending,
  app,
  t,
}: {
  courseId: number;
  id: number;
  row: YanhektSessionRow | undefined;
  pending: boolean;
  app: ReturnType<typeof useAppLaunch>;
  t: Strings;
}) {
  const s = row && !('error' in row) ? row : null;
  const gone = row && 'error' in row && row.error === 'gone';
  const start = s ? chinaTime(s.startedAt) : null;
  const where = [start ? t.dateFormat(start) : null, s?.room].filter(Boolean).join(' · ');
  const hint = app.missing === `session:${id}`;

  return (
    <li className={`lecture${!row && pending ? ' is-loading' : ''}${gone ? ' is-gone' : ''}`}>
      <div className="lecture__where">{where || ' '}</div>
      <h3 className="lecture__title">
        <a href={yanhektSessionUrl(id)} target="_blank" rel="noreferrer" title={t.openOnYanhekt}>
          {s?.title ?? t.sessionFallback(id)}
        </a>
      </h3>
      <div className="lecture__snippet">
        {s ? <When s={s} t={t} /> : row ? (gone ? t.sessionGone : t.sessionUnavailable) : pending ? t.loading : null}
      </div>
      <div className="lecture__links">
        <a href={webSessionUrl(courseId, id)} target="_blank" rel="noreferrer" title={t.openOnWeb}>
          {t.rowWeb} ↗
        </a>
        <AppLink short href={appSessionUrl(id)} onLaunch={() => app.watch(`session:${id}`)} />
        <span className="lecture__id">
          {t.sessionId} <code>{id}</code> <CopyButton text={String(id)} />
        </span>
      </div>
      {hint && <AppMissingHint />}
    </li>
  );
}

function When({ s, t }: { s: YanhektSession; t: Strings }) {
  const start = chinaTime(s.startedAt);
  const end = chinaTime(s.endedAt);
  const span = s.startedAt && s.endedAt ? `${s.startedAt.slice(11, 16)}–${s.endedAt.slice(11, 16)}` : null;
  const now = Date.now();
  let state: { label: string; cls: string };
  if (s.recorded) state = { label: t.recorded, cls: 'is-recorded' };
  else if (start && end && start.getTime() <= now && now < end.getTime()) state = { label: t.liveNow, cls: 'is-live' };
  else if (start && start.getTime() > now) state = { label: t.upcoming, cls: 'is-upcoming' };
  else state = { label: t.noRecording, cls: 'is-none' };
  return (
    <>
      {span && <span>{span} · </span>}
      <span className={`lecture__state ${state.cls}`}>{state.label}</span>
    </>
  );
}

/** Yanhekt's `YYYY-MM-DD HH:MM:SS` is China time. */
function chinaTime(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(`${v.replace(' ', 'T')}+08:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Start time ascending; sessions without one keep their place at the end, by id. */
function byStart(rows: Map<number, YanhektSessionRow>) {
  const key = (id: number) => {
    const r = rows.get(id);
    return r && !('error' in r) && r.startedAt ? r.startedAt : '￿';
  };
  return (a: number, b: number) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : a - b);
}
