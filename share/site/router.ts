/**
 * A tiny history router: three pages, all client-rendered from one shell.
 *   /                         home
 *   /search?q=&term=          results (term omitted for an id/code lookup)
 *   /course/{id}              one course and its session ids
 */

import { useSyncExternalStore, type MouseEvent } from 'react';

export type Route =
  | { page: 'home' }
  | { page: 'search'; q: string; term: string | null; p: number }
  | { page: 'course'; id: number }
  | { page: 'missing' };

const listeners = new Set<() => void>();
let current = parse();

function parse(): Route {
  const { pathname, search } = window.location;
  const qs = new URLSearchParams(search);
  if (pathname === '/' || pathname === '/index.html') return { page: 'home' };
  if (/^\/search\/?$/.test(pathname)) {
    const q = (qs.get('q') ?? '').trim();
    if (!q) return { page: 'home' };
    return { page: 'search', q, term: qs.get('term') || null, p: Math.max(1, Number(qs.get('p')) || 1) };
  }
  const course = /^\/course\/(\d{1,12})\/?$/.exec(pathname);
  if (course) return { page: 'course', id: Number(course[1]) };
  return { page: 'missing' };
}

window.addEventListener('popstate', () => {
  current = parse();
  listeners.forEach((l) => l());
});

export function useRoute(): Route {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => current,
  );
}

export function navigate(href: string, replace = false): void {
  if (replace) history.replaceState(null, '', href);
  else history.pushState(null, '', href);
  current = parse();
  listeners.forEach((l) => l());
  if (!replace) window.scrollTo(0, 0);
}

export function searchHref(q: string, term: string | null, p = 1): string {
  const qs = new URLSearchParams({ q });
  if (term) qs.set('term', term);
  if (p > 1) qs.set('p', String(p));
  return `/search?${qs}`;
}

export const courseHref = (id: number) => `/course/${id}`;

/** onClick for an in-site <a>: plain clicks route in place; modified clicks open as usual. */
export function linkClick(e: MouseEvent<HTMLAnchorElement>): void {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const href = e.currentTarget.getAttribute('href');
  if (!href || !href.startsWith('/')) return;
  e.preventDefault();
  navigate(href);
}
