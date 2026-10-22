import { useEffect, useState } from 'react';
import { ApiError, search } from '../api';
import { Footer, LangSwitch, Logo, SearchBox, useTerms } from '../components/Chrome';
import { termLabel, useT } from '../i18n';
import { isIdentifier } from '../query';
import { courseHref, navigate, searchHref } from '../router';
import { defaultTerm } from '../terms';

export function Home() {
  const t = useT();
  const info = useTerms();
  const [term, setTerm] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = t.homeTitle;
  }, [t]);
  useEffect(() => {
    if (info && term === null) setTerm(defaultTerm(info.terms));
  }, [info, term]);

  const go = (value: string) => navigate(searchHref(value, isIdentifier(value) ? null : term));

  const lucky = async () => {
    const value = q.trim();
    if (!value) return;
    setBusy(true);
    try {
      const r = await search(value, isIdentifier(value) ? null : term);
      navigate(r.results[0] ? courseHref(r.results[0].id) : searchHref(value, term));
    } catch (err) {
      if (err instanceof ApiError) navigate(searchHref(value, term));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="home">
      <div className="home__bar">
        <LangSwitch />
      </div>
      <main className="home__main">
        <Logo size="large" />
        <div className="home__box" onInput={(e) => setQ((e.target as HTMLInputElement).value)}>
          <SearchBox initial="" onSubmit={go} autoFocus variant="home" />
        </div>
        <div className="home__buttons">
          <button type="button" className="button" onClick={() => q.trim() && go(q.trim())}>
            {t.searchButton}
          </button>
          <button type="button" className="button" onClick={lucky} disabled={busy}>
            {t.luckyButton}
          </button>
        </div>
        {info && info.terms.length > 0 && (
          <div className="home__term">
            <label>
              {t.searchIn}{' '}
              <select value={term ?? ''} onChange={(e) => setTerm(e.target.value)} className="term-select">
                {info.terms.map((x) => (
                  <option key={x} value={x}>
                    {termLabel(t, x)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </main>
      <Footer info={info} />
    </div>
  );
}
