// Bounded reads. The Worker used to read whole bodies (uploads, AI requests,
// playlists, sign-in pages) into memory whatever their size. These read at
// most `maxBytes`: a declared Content-Length over the limit is refused before
// anything is read, and a body without one (or with a wrong one) is read only
// until it passes the limit, then cancelled.

async function readStreamLimited(
  body: ReadableStream<Uint8Array> | null,
  declaredLength: string | null,
  maxBytes: number,
): Promise<Uint8Array | null> {
  const declared = Number(declaredLength ?? "");
  if (declaredLength !== null && Number.isFinite(declared) && declared > maxBytes) {
    await body?.cancel().catch(() => undefined);
    return null;
  }
  if (!body) return new Uint8Array(0);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.byteLength;
  }
  return out;
}

/** A request's body, or null when it is longer than `maxBytes`. */
export function readRequestLimited(req: Request, maxBytes: number): Promise<Uint8Array | null> {
  return readStreamLimited(req.body, req.headers.get("Content-Length"), maxBytes);
}

/** A response's text (UTF-8), or null when it is longer than `maxBytes`. */
export async function readTextLimited(res: Response, maxBytes: number): Promise<string | null> {
  const bytes = await readStreamLimited(res.body, res.headers.get("Content-Length"), maxBytes);
  return bytes === null ? null : new TextDecoder().decode(bytes);
}

/** Limits per route, generous next to any normal payload; Cloudflare's own cap is 100 MB. */
export const BODY_LIMITS = {
  /** Note image uploads and note writes through /api/yanhekt. */
  yanhekt: 25 * 1024 * 1024,
  /** Builtin AI and Copilot requests: a batch of slide images, base64. */
  ai: 50 * 1024 * 1024,
  /** Sign-in requests: a username, a password, a code, a sealed bag. */
  login: 256 * 1024,
  /** A recorded-lecture playlist from the relay (the relay itself stops at 4 MB). */
  playlist: 4 * 1024 * 1024,
  /** A campus SSO page or JSON answer. */
  ssoPage: 2 * 1024 * 1024,
} as const;

export function tooLarge(maxBytes: number): Response {
  return new Response(JSON.stringify({ success: false, error: `Request body over ${Math.round(maxBytes / (1024 * 1024))} MB` }), {
    status: 413,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
