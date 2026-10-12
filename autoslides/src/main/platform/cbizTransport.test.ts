import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/infra/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import { CbizTransport } from './cbizTransport';
import type { IntranetMappingService } from './intranetMappingService';

interface Seen { method: string; url: string; contentType: string; body: Buffer }

const servers: http.Server[] = [];

/** A local server that records requests. `hang` never answers, like a route that swallows packets. */
async function serve(hang = false): Promise<{ origin: string; port: number; seen: Seen[] }> {
  const seen: Seen[] = [];
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      seen.push({
        method: req.method ?? '',
        url: req.url ?? '',
        contentType: String(req.headers['content-type'] ?? ''),
        body: Buffer.concat(chunks),
      });
      if (hang) return;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ code: 0, data: { ok: true } }));
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  return { origin: `http://127.0.0.1:${port}`, port, seen };
}

/** A port nothing listens on: connecting to it is refused at once. */
async function closedPort(): Promise<number> {
  const { port } = await serve();
  const server = servers.pop()!;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

/** A mapping that sends the "public" origin to `intranetPort`, as if that were its campus address. */
function mappingTo(publicPort: number, intranetPort: number) {
  const mapping = {
    on: vi.fn(),
    isEnabled: () => true,
    isApiViaIntranet: () => true,
    getInterfaceIp: () => null,
    ensureFresh: vi.fn(async () => undefined),
    reportFailure: vi.fn(),
    mapUrl: (u: string) => u.replace(`:${publicPort}`, `:${intranetPort}`),
    rewriteUrl: (u: string) => u.replace(`:${publicPort}`, `:${intranetPort}`),
  };
  return mapping as unknown as IntranetMappingService & typeof mapping;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise((resolve) => {
    s.closeAllConnections();
    s.close(resolve);
  })));
});

describe('CbizTransport without a mapping', () => {
  it('sends a JSON body, including on DELETE', async () => {
    const api = await serve();
    const transport = new CbizTransport();
    const res = await transport.send<{ code: number }>({
      method: 'DELETE',
      url: `${api.origin}/v1/note`,
      headers: { 'Content-Type': 'application/json' },
      data: { id: 7 },
    });
    expect(res.data.code).toBe(0);
    expect(api.seen[0]).toMatchObject({ method: 'DELETE', url: '/v1/note', contentType: 'application/json' });
    expect(JSON.parse(api.seen[0].body.toString())).toEqual({ id: 7 });
  });

  it('sends a FormData upload as multipart with the file bytes intact', async () => {
    const api = await serve();
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3, 255]);
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: 'image/png' }), 'Slide_001.png');
    form.append('bucket', 'notes');

    await new CbizTransport().send({ method: 'POST', url: `${api.origin}/v1/minio/upload`, data: form });

    const { contentType, body } = api.seen[0];
    expect(contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(body.includes(Buffer.from(bytes))).toBe(true);
    const text = body.toString('latin1');
    expect(text).toContain('name="file"; filename="Slide_001.png"');
    expect(text).toContain('Content-Type: image/png');
    expect(text).toMatch(/name="bucket"\r\n\r\nnotes/);
  });
});

describe('CbizTransport on the intranet route', () => {
  it('uses the intranet address while it answers', async () => {
    const pub = await serve();
    const intranet = await serve();
    const transport = new CbizTransport(mappingTo(pub.port, intranet.port));
    await transport.send({ method: 'GET', url: `${pub.origin}/v1/note/list` });
    expect(intranet.seen).toHaveLength(1);
    expect(pub.seen).toHaveLength(0);
  });

  it('retries a refused connection on the public host, for reads and writes alike', async () => {
    const pub = await serve();
    const mapping = mappingTo(pub.port, await closedPort());
    const transport = new CbizTransport(mapping);

    await transport.send({ method: 'GET', url: `${pub.origin}/v1/note?id=1` });
    await transport.send({ method: 'POST', url: `${pub.origin}/v1/note`, data: { title: 'a' } });

    expect(pub.seen.map((r) => r.method)).toEqual(['GET', 'POST']);
    expect(mapping.reportFailure).toHaveBeenCalledTimes(2);
  });

  it('retries a read that timed out, but never a write that may have arrived', async () => {
    const pub = await serve();
    const stalled = await serve(true);
    const transport = new CbizTransport(mappingTo(pub.port, stalled.port));

    const read = await transport.send({ method: 'GET', url: `${pub.origin}/v1/note?id=1`, timeout: 150 });
    expect(read.status).toBe(200);
    expect(pub.seen.map((r) => r.method)).toEqual(['GET']);

    await expect(
      transport.send({ method: 'POST', url: `${pub.origin}/v1/note`, data: { title: 'a' }, timeout: 150 })
    ).rejects.toMatchObject({ code: 'ECONNABORTED' });
    // The stalled server received the write; sending it again could create a second note.
    expect(stalled.seen.filter((r) => r.method === 'POST')).toHaveLength(1);
    expect(pub.seen.map((r) => r.method)).toEqual(['GET']);
  });

  it('waits for a current route before a write, not before a read', async () => {
    const pub = await serve();
    const intranet = await serve();
    const mapping = mappingTo(pub.port, intranet.port);
    let fresh = false;
    mapping.ensureFresh.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      fresh = true;
    });
    const freshWhenSent: boolean[] = [];
    const transport = new CbizTransport(mapping);
    // isApiViaIntranet is read right after the wait (or without one).
    (mapping as { isApiViaIntranet: () => boolean }).isApiViaIntranet = () => { freshWhenSent.push(fresh); return true; };

    await transport.send({ method: 'GET', url: `${pub.origin}/a` });
    fresh = false;
    await transport.send({ method: 'PUT', url: `${pub.origin}/b`, data: {} });
    expect(freshWhenSent).toEqual([false, true]);
  });
});
