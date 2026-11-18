import { describe, expect, it } from 'vitest';
import { readBodyLimited } from './body';

const streamed = (parts: string[]) =>
  new Request('https://share.test/v1/api/shorten', {
    method: 'POST',
    body: new ReadableStream({
      start(controller) {
        for (const p of parts) controller.enqueue(new TextEncoder().encode(p));
        controller.close();
      },
    }),
    // @ts-expect-error -- Node's fetch needs this for a streamed body
    duplex: 'half',
  });

describe('readBodyLimited', () => {
  it('reads a body within the limit', async () => {
    const body = await readBodyLimited(new Request('https://share.test/', { method: 'POST', body: '{"a":1}' }), 16);
    expect(new TextDecoder().decode(body!)).toBe('{"a":1}');
  });

  it('refuses a declared length over the limit without reading', async () => {
    const req = new Request('https://share.test/', { method: 'POST', body: 'x', headers: { 'Content-Length': '999999' } });
    expect(await readBodyLimited(req, 16)).toBeNull();
  });

  it('stops reading a body with no length once it passes the limit', async () => {
    expect(await readBodyLimited(streamed(['0123456789', '0123456789']), 16)).toBeNull();
    expect(new TextDecoder().decode((await readBodyLimited(streamed(['01234567', '89abcdef']), 16))!)).toBe('0123456789abcdef');
  });
});
