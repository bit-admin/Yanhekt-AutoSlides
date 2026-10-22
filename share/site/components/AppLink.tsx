/**
 * "Open in AutoSlides Desktop": an `autoslides://` link (the desktop app
 * registers the scheme from 5.2.0). Browsers do not say whether a custom scheme
 * opened anything, so this guesses: when the app (or the browser's "Open
 * AutoSlides?" prompt) comes up, the page loses focus. If it keeps focus for a
 * moment after the click, a hint says what is needed. The hint is worded for
 * the case where the guess is wrong.
 */

import { useEffect, useRef, useState } from 'react';
import { APPS_URL } from '../api';
import { useT } from '../i18n';

const WAIT_MS = 2500;

/** Which link was clicked last and seems to have opened nothing, or null. */
export function useAppLaunch() {
  const [missing, setMissing] = useState<string | null>(null);
  const stop = useRef<(() => void) | null>(null);

  useEffect(() => () => stop.current?.(), []);

  const watch = (key: string) => {
    stop.current?.();
    setMissing(null);
    // Any blur counts: focus went to the app or to the browser's prompt.
    const left = () => done();
    const hidden = () => {
      if (document.visibilityState === 'hidden') done();
    };
    const timer = window.setTimeout(() => {
      done();
      setMissing(key);
    }, WAIT_MS);
    const done = () => {
      window.clearTimeout(timer);
      window.removeEventListener('blur', left);
      document.removeEventListener('visibilitychange', hidden);
      stop.current = null;
    };
    window.addEventListener('blur', left);
    document.addEventListener('visibilitychange', hidden);
    stop.current = done;
  };

  return { missing, watch };
}

export function AppLink({
  href,
  className,
  onLaunch,
  short,
}: {
  href: string;
  className?: string;
  onLaunch: () => void;
  /** The session rows' short label; the full one stays as the tooltip. */
  short?: boolean;
}) {
  const t = useT();
  // A plain link, so the click is the user gesture the browser wants before it
  // hands a custom scheme to the system.
  return (
    <a className={className} href={href} onClick={onLaunch} title={short ? t.openInApp : undefined}>
      {short ? t.rowApp : t.openInApp} ↗
    </a>
  );
}

export function AppMissingHint({ className }: { className?: string }) {
  const t = useT();
  return (
    <p className={`app-hint${className ? ` ${className}` : ''}`} role="status">
      {t.appMissing}{' '}
      <a href={APPS_URL} target="_blank" rel="noreferrer">
        {t.getApp} ↗
      </a>
    </p>
  );
}
