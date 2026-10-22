/**
 * `autoslides://` links. Any web page or app can open one, so they only ever
 * navigate: open a Yanhekt course's sessions page, or open a session playing
 * on top of it. Never downloads, settings or files.
 *
 *   autoslides://course/<course id>
 *   autoslides://session/<session id>
 *
 * A query or hash is ignored; anything else is not a link.
 */
export const DEEP_LINK_SCHEME = 'autoslides';

export type DeepLink =
  | { kind: 'course'; courseId: string }
  | { kind: 'session'; sessionId: string };

// Yanhekt ids are small positive integers; the cap keeps `Number()` exact.
const ID = /^\d{1,15}$/;

export function parseDeepLink(raw: string): DeepLink | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol.toLowerCase() !== `${DEEP_LINK_SCHEME}:`) return null;

  // `autoslides://course/1` parses as host `course`, path `/1`; take both, and
  // allow `autoslides:///course/1` and a trailing slash.
  const parts = `${url.hostname}${url.pathname}`.split('/').filter(Boolean);
  if (parts.length !== 2) return null;
  const [kind, rawId] = parts;
  if (!ID.test(rawId)) return null;
  const id = String(Number(rawId));
  if (id === '0') return null;

  switch (kind.toLowerCase()) {
    case 'course':
      return { kind: 'course', courseId: id };
    case 'session':
      return { kind: 'session', sessionId: id };
    default:
      return null;
  }
}

/** The `autoslides:` argument in a launch's argv (Windows and Linux pass the link there). */
export function findDeepLinkArg(argv: readonly string[]): string | null {
  const prefix = `${DEEP_LINK_SCHEME}:`;
  return argv.find((arg) => arg.toLowerCase().startsWith(prefix)) ?? null;
}
