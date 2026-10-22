import { useEffect, useState } from 'react';
import { ApiError, courseSessions, search, yanhektCourseUrl, yanhektSessionUrl, type CourseResult } from '../api';
import { CopyButton, Footer, Header, useTerms } from '../components/Chrome';
import { termLabel, useNumber, useT } from '../i18n';
import { isIdentifier } from '../query';
import { navigate, searchHref } from '../router';
import { defaultTerm } from '../terms';

type State =
  | { kind: 'loading' }
  | { kind: 'done'; course: CourseResult; sessions: number[] }
  | { kind: 'missing' }
  | { kind: 'error'; code: string };

export function Course({ id }: { id: number }) {
  const t = useT();
  const num = useNumber();
  const info = useTerms();
  const [state, setState] = useState<State>({ kind: 'loading' });

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

  useEffect(() => {
    document.title = state.kind === 'done' ? `${state.course.name} (${id}) - Index` : `${id} - Index`;
  }, [state, id]);

  const onSearch = (value: string) =>
    navigate(searchHref(value, isIdentifier(value) ? null : state.kind === 'done' ? state.course.term : info ? defaultTerm(info.terms) : null));

  return (
    <div className="page">
      <Header q="" onSearch={onSearch} />
      <main className="main">
        {state.kind === 'loading' && <p className="stats">{t.loading}</p>}
        {state.kind === 'missing' && <p className="notice">{t.courseNotFound(String(id))}</p>}
        {state.kind === 'error' && <p className="notice">{t.errors[state.code] ?? t.errors.internal}</p>}
        {state.kind === 'done' && (
          <article className="course">
            <h1 className="course__name">{state.course.name}</h1>
            <p className="course__term">{termLabel(t, state.course.term)}</p>

            <div className="course__actions">
              <a className="pill pill--primary" href={yanhektCourseUrl(id)} target="_blank" rel="noreferrer">
                {t.openOnYanhekt} ↗
              </a>
              {state.sessions.length > 0 && <CopyButton text={state.sessions.join('\n')} label={t.copyAllSessions} />}
            </div>

            <dl className="facts">
              <dt>{t.courseId}</dt>
              <dd>
                <code>{id}</code> <CopyButton text={String(id)} />
              </dd>
              <dt>{t.number}</dt>
              <dd>
                {state.course.number ? (
                  <>
                    <code>{state.course.number}</code> <CopyButton text={state.course.number} />
                  </>
                ) : (
                  '—'
                )}
              </dd>
              <dt>{t.term}</dt>
              <dd>
                {termLabel(t, state.course.term)} <code className="muted">{state.course.term ?? ''}</code>
              </dd>
              <dt>{t.teachers}</dt>
              <dd>{state.course.teachers.length > 0 ? state.course.teachers.join('、') : t.noTeachers}</dd>
              <dt>{t.sessionsLabel}</dt>
              <dd>{num(state.sessions.length)}</dd>
            </dl>

            <section className="sessions">
              <h2>{t.sessionsHeading}</h2>
              <p className="sessions__note">{t.sessionsNote}</p>
              {state.sessions.length === 0 ? (
                <p>{t.noSessions}</p>
              ) : (
                <ol className="sessions__list">
                  {state.sessions.map((s, i) => (
                    <li key={s}>
                      <span className="sessions__no">{t.sessionNo(i + 1)}</span>
                      <code className="sessions__id">{s}</code>
                      <CopyButton text={String(s)} />
                      <a href={yanhektSessionUrl(s)} target="_blank" rel="noreferrer" className="sessions__open">
                        {t.openOnYanhekt} ↗
                      </a>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </article>
        )}
      </main>
      <Footer info={info} />
    </div>
  );
}
