import { useEffect, useState } from 'react';
import { ApiError, search, webCourseUrl, yanhektCourseUrl, type CourseResult, type SearchResponse } from '../api';
import { CopyButton, Footer, Header, useTerms } from '../components/Chrome';
import { Highlight } from '../components/Highlight';
import { termLabel, useNumber, useT, type Strings } from '../i18n';
import { isIdentifier, queryWords } from '../query';
import { courseHref, linkClick, navigate, searchHref } from '../router';
import { defaultTerm } from '../terms';

const PAGE = 10;

type State =
  | { kind: 'loading' }
  | { kind: 'done'; data: SearchResponse; ms: number }
  | { kind: 'error'; code: string };

export function Results({ q, term, p }: { q: string; term: string | null; p: number }) {
  const t = useT();
  const num = useNumber();
  const info = useTerms();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const identifier = isIdentifier(q);
  // A word search needs a term; an old or hand-typed link without one gets the default.
  const needsTerm = !identifier && !term;

  useEffect(() => {
    document.title = t.title(q);
  }, [q, t]);

  useEffect(() => {
    if (needsTerm && info) navigate(searchHref(q, defaultTerm(info.terms)), true);
  }, [needsTerm, info, q]);

  useEffect(() => {
    if (needsTerm) return;
    const ac = new AbortController();
    const started = performance.now();
    setState({ kind: 'loading' });
    search(q, identifier ? null : term, ac.signal)
      .then((data) => setState({ kind: 'done', data, ms: performance.now() - started }))
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return;
        setState({ kind: 'error', code: err instanceof ApiError ? err.code : 'network' });
      });
    return () => ac.abort();
  }, [q, term, identifier, needsTerm]);

  const onSearch = (value: string) => navigate(searchHref(value, isIdentifier(value) ? null : (term ?? (info ? defaultTerm(info.terms) : null))));

  const tabs = [...(info?.terms ?? [])];
  if (term && !tabs.includes(term)) tabs.unshift(term);

  return (
    <div className="page">
      <Header q={q} onSearch={onSearch}>
        <nav className="tabs" aria-label={t.term}>
          {identifier && <span className="tab is-on">{t.identifierTab}</span>}
          {tabs.map((x) => (
            <a
              key={x}
              href={searchHref(q, x)}
              onClick={linkClick}
              className={`tab${!identifier && x === term ? ' is-on' : ''}`}
              aria-current={!identifier && x === term ? 'page' : undefined}
            >
              {termLabel(t, x)}
            </a>
          ))}
        </nav>
      </Header>
      <main className="main">
        {state.kind === 'loading' && <p className="stats">{t.loading}</p>}
        {state.kind === 'error' && <p className="notice">{t.errors[state.code] ?? t.errors.internal}</p>}
        {state.kind === 'done' && (
          <ResultList data={state.data} ms={state.ms} q={q} term={term} identifier={identifier} p={p} tabs={tabs} t={t} num={num} />
        )}
      </main>
      <Footer info={info} />
    </div>
  );
}

function ResultList({
  data,
  ms,
  q,
  term,
  identifier,
  p,
  tabs,
  t,
  num,
}: {
  data: SearchResponse;
  ms: number;
  q: string;
  term: string | null;
  identifier: boolean;
  p: number;
  tabs: string[];
  t: Strings;
  num: (n: number) => string;
}) {
  const words = queryWords(q);
  const pages = Math.ceil(data.results.length / PAGE);
  const page = Math.min(p, Math.max(1, pages));
  const shown = data.results.slice((page - 1) * PAGE, page * PAGE);

  if (data.total === 0) {
    const others = tabs.filter((x) => x !== term).slice(0, 4);
    return (
      <div className="empty">
        <p>{identifier ? t.noResultsId(q) : t.noResults(q, termLabel(t, term))}</p>
        <p>{t.suggestions}</p>
        <ul>
          {!identifier && others.length > 0 && (
            <li>
              {t.suggestOtherTerm}
              {others.map((x, i) => (
                <span key={x}>
                  {i > 0 && ' · '}
                  <a href={searchHref(q, x)} onClick={linkClick}>
                    {termLabel(t, x)}
                  </a>
                </span>
              ))}
            </li>
          )}
          {!identifier && <li>{t.suggestShorter}</li>}
          <li>{t.suggestId}</li>
          <li>{t.suggestCoverage}</li>
        </ul>
      </div>
    );
  }

  return (
    <>
      <p className="stats">
        {t.stats(num(data.total), (ms / 1000).toFixed(2))}
        {data.total > data.results.length && t.statsTop(data.results.length)}
        {data.truncated && t.statsTruncated}
      </p>
      <ol className="results" start={(page - 1) * PAGE + 1}>
        {shown.map((r) => (
          <Result key={r.id} r={r} words={words} t={t} />
        ))}
      </ol>
      {pages > 1 && <Pager q={q} term={identifier ? null : term} page={page} pages={pages} t={t} />}
    </>
  );
}

function Result({ r, words, t }: { r: CourseResult; words: string[]; t: Strings }) {
  const href = courseHref(r.id);
  const byId = r.match.fields.includes('id');
  const byNumber = r.match.fields.includes('number');
  return (
    <li className="result">
      <a href={href} onClick={linkClick} className="result__head">
        <span className="result__site" aria-hidden="true">
          <IndexMark />
        </span>
        <span className="result__where">
          <span className="result__sitename">Index</span>
          <cite className="result__url">
            {location.host} › course › {r.id}
          </cite>
        </span>
      </a>
      <h3 className="result__title">
        <a href={href} onClick={linkClick}>
          {r.name}
        </a>
      </h3>
      <div className="result__snippet">
        <span className="result__date">{termLabel(t, r.term)} — </span>
        {r.teachers.length > 0 ? (
          <>
            {t.teachers}
            {t.colon}
            <Highlight text={r.teachers.join('、')} words={words} />
          </>
        ) : (
          t.noTeachers
        )}
        {' · '}
        {t.sessions(r.sessionCount)}
        {r.number && (
          <>
            {' · '}
            {t.number} {byNumber ? <b>{r.number}</b> : r.number}
          </>
        )}
      </div>
      <div className="result__links">
        {(byId || byNumber) && <span className="chip">{byId ? t.matchId : t.matchNumber}</span>}
        <span className="result__id">
          {t.courseId} <code>{r.id}</code>
        </span>
        <CopyButton text={String(r.id)} />
        <a href={href} onClick={linkClick}>
          {t.viewSessions}
        </a>
        <a href={yanhektCourseUrl(r.id)} target="_blank" rel="noreferrer">
          {t.openOnYanhekt} ↗
        </a>
        <a href={webCourseUrl(r.id)} target="_blank" rel="noreferrer">
          {t.openOnWeb} ↗
        </a>
      </div>
    </li>
  );
}

/** "I n d d d … e x": one d per page, like a familiar search pager. */
function Pager({ q, term, page, pages, t }: { q: string; term: string | null; page: number; pages: number; t: Strings }) {
  const from = Math.max(1, Math.min(page - 5, pages - 9));
  const to = Math.min(pages, from + 9);
  const list = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  return (
    <nav className="pager" aria-label="pages">
      <div className="pager__cell pager__cell--edge">
        <span className="pager__letter" style={{ color: 'var(--logo-blue)' }}>
          I
        </span>
        {page > 1 && (
          <a href={searchHref(q, term, page - 1)} onClick={linkClick} className="pager__label">
            {t.previous}
          </a>
        )}
      </div>
      <div className="pager__cell">
        <span className="pager__letter" style={{ color: 'var(--logo-red)' }}>
          n
        </span>
      </div>
      {list.map((n) => (
        <div className="pager__cell" key={n}>
          <span className="pager__letter" style={{ color: n === page ? 'var(--logo-red)' : 'var(--logo-yellow)' }}>
            d
          </span>
          {n === page ? (
            <span className="pager__num is-on">{n}</span>
          ) : (
            <a href={searchHref(q, term, n)} onClick={linkClick} className="pager__num">
              {n}
            </a>
          )}
        </div>
      ))}
      <div className="pager__cell">
        <span className="pager__letter" style={{ color: 'var(--logo-blue)' }}>
          e
        </span>
      </div>
      <div className="pager__cell pager__cell--edge">
        <span className="pager__letter" style={{ color: 'var(--logo-green)' }}>
          x
        </span>
        {page < pages && (
          <a href={searchHref(q, term, page + 1)} onClick={linkClick} className="pager__label">
            {t.next}
          </a>
        )}
      </div>
    </nav>
  );
}

export function IndexMark() {
  return <img src="/favicon.svg" width="18" height="18" alt="" />;
}
