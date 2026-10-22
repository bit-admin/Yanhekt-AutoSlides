/** Shared pieces: the wordmark, the search box, the language switch, the footer, a copy button. */

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { terms as fetchTerms, type TermsResponse } from '../api';
import { setLang, useLang, useT } from '../i18n';
import { linkClick } from '../router';

const LETTERS: Array<[string, string]> = [
  ['I', 'var(--logo-blue)'],
  ['n', 'var(--logo-red)'],
  ['d', 'var(--logo-yellow)'],
  ['e', 'var(--logo-blue)'],
  ['x', 'var(--logo-green)'],
];

export function Logo({ size }: { size: 'large' | 'small' }) {
  const t = useT();
  return (
    <a href="/" onClick={linkClick} className={`logo logo--${size}`} aria-label="Index">
      <span className="logo__word" aria-hidden="true">
        {LETTERS.map(([ch, color], i) => (
          <span key={i} style={{ color }}>
            {ch}
          </span>
        ))}
      </span>
      <span className="logo__sub">{t.brandSub}</span>
    </a>
  );
}

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path
      fill="currentColor"
      d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
    />
  </svg>
);

const ClearIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path
      fill="currentColor"
      d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
    />
  </svg>
);

export function SearchBox({
  initial,
  onSubmit,
  autoFocus,
  variant,
}: {
  initial: string;
  onSubmit: (q: string) => void;
  autoFocus?: boolean;
  variant: 'home' | 'header';
}) {
  const t = useT();
  const [q, setQ] = useState(initial);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => setQ(initial), [initial]);

  // "/" focuses the box, as on most search sites.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (e.key !== '/' || el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return;
      e.preventDefault();
      input.current?.focus();
      input.current?.select();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = q.trim();
    if (v) {
      input.current?.blur();
      onSubmit(v);
    }
  };

  return (
    <form className={`searchbox searchbox--${variant}`} role="search" onSubmit={submit}>
      {variant === 'home' && (
        <span className="searchbox__icon">
          <SearchIcon />
        </span>
      )}
      <input
        ref={input}
        className="searchbox__input"
        type="search"
        name="q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t.placeholder}
        aria-label={t.search}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
        maxLength={300}
      />
      {q && (
        <button
          type="button"
          className="searchbox__clear"
          aria-label={t.clear}
          title={t.clear}
          onClick={() => {
            setQ('');
            input.current?.focus();
          }}
        >
          <ClearIcon />
        </button>
      )}
      {variant === 'header' && (
        <>
          <span className="searchbox__divider" aria-hidden="true" />
          <button type="submit" className="searchbox__go" aria-label={t.search} title={t.search}>
            <SearchIcon />
          </button>
        </>
      )}
    </form>
  );
}

export function LangSwitch() {
  const lang = useLang();
  return (
    <div className="lang">
      <button type="button" className={lang === 'zh' ? 'is-on' : ''} onClick={() => setLang('zh')} lang="zh-CN">
        中文
      </button>
      <button type="button" className={lang === 'en' ? 'is-on' : ''} onClick={() => setLang('en')} lang="en">
        English
      </button>
    </div>
  );
}

/** The term list and update time, shared by every page (one request per page load). */
export function useTerms(): TermsResponse | null {
  const [data, setData] = useState<TermsResponse | null>(null);
  useEffect(() => {
    let live = true;
    fetchTerms()
      .then((d) => live && setData(d))
      .catch(() => live && setData({ updatedAt: null, terms: [] }));
    return () => {
      live = false;
    };
  }, []);
  return data;
}

export function Footer({ info }: { info: TermsResponse | null }) {
  const t = useT();
  const lang = useLang();
  const when =
    info?.updatedAt != null
      ? new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
          new Date(info.updatedAt),
        )
      : null;
  return (
    <footer className="footer">
      <div className="footer__row">
        <span>
          {when && t.footerUpdated(when)}
          {when && info && info.terms.length > 0 && ' · '}
          {info && info.terms.length > 0 && t.footerTotals(info.terms.length)}
        </span>
        <span className="footer__links">
          <a href="https://github.com/bit-admin/Yanhekt-AutoSlides/blob/main/share/docs/api.md" target="_blank" rel="noreferrer">
            {t.api}
          </a>
          <a href="https://github.com/bit-admin/Yanhekt-AutoSlides" target="_blank" rel="noreferrer">
            AutoSlides
          </a>
        </span>
      </div>
      <div className="footer__row footer__row--note">{t.footerAbout}</div>
    </footer>
  );
}

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const t = useT();
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => setDone(false), 1500);
    return () => clearTimeout(timer);
  }, [done]);
  return (
    <button
      type="button"
      className={`copy${done ? ' is-done' : ''}`}
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => setDone(true));
      }}
      title={`${t.copy} ${text.length > 40 ? '' : text}`.trim()}
    >
      {done ? t.copied : (label ?? t.copy)}
    </button>
  );
}

export function Header({ q, onSearch, children }: { q: string; onSearch: (q: string) => void; children?: React.ReactNode }) {
  return (
    <header className="header">
      <div className="header__top">
        <Logo size="small" />
        <SearchBox initial={q} onSubmit={onSearch} variant="header" />
        <LangSwitch />
      </div>
      {children}
    </header>
  );
}
