/**
 * Read a request body, at most `maxBytes` of it. Returns null when the body
 * is longer: a declared Content-Length over the limit is refused before
 * anything is read, and a body without one (or with a wrong one) is read only
 * until it passes the limit, then cancelled.
 */
export async function readBodyLimited(req: Request, maxBytes: number): Promise<Uint8Array | null> {
  const declared = Number(req.headers.get('Content-Length') ?? '');
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!req.body) return new Uint8Array(0);
  const reader = req.body.getReader();
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
