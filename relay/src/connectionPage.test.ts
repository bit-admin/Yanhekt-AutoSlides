/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import html from '../public/index.html?raw';
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
if (!script) throw new Error('Connection page script not found');

const placement = {
  pinned: true,
  region: 'aws:ap-east-1',
  colo: 'HKG',
  city: 'Hong Kong',
  closestToOrigin: true,
  closest: { region: 'aws:ap-east-1', colo: 'HKG', city: 'Hong Kong' },
  origin: { host: 'media.example.test', address: '', where: 'Beijing' },
};

function loadPage() {
  const elements = new Map<string, { innerHTML: string }>();
  const element = (id: string) => {
    let el = elements.get(id);
    if (!el) {
      el = { innerHTML: '' };
      elements.set(id, el);
    }
    return el;
  };
  const createPage = new Function('document', 'fetch', `${script}\nreturn { renderConn, pathHint };`);
  const page = createPage(
    { getElementById: element },
    () => new Promise<never>(() => {}),
  ) as {
    renderConn: (
      trace: Record<string, string>,
      raw: string,
      network: { asn: number | null; org: string },
      place: typeof placement | null,
    ) => void;
    pathHint: (
      loc: string,
      colo: string,
      place: typeof placement | null,
    ) => { cls: string; html: string };
  };
  return { ...page, element };
}

const trace = { ip: '192.0.2.1', loc: 'CN', colo: 'AMS', http: 'http/2', tls: 'TLSv1.3' };

function accessSection(markup: string): string {
  const section = markup.match(/<div class="access">[\s\S]*?<\/div>/)?.[0];
  if (!section) throw new Error('Connection access section not found');
  return section;
}

describe('connection page', () => {
  it('shows the same availability guidance with known or missing network metadata', () => {
    const page = loadPage();
    const sections = [
      { asn: 64512, org: 'Example Network' },
      { asn: 64513, org: 'Another Network' },
      { asn: null, org: '' },
    ].map((network) => {
      page.renderConn(trace, 'ip=192.0.2.1', network, placement);
      return accessSection(page.element('conn-body').innerHTML);
    });

    expect(new Set(sections).size).toBe(1);
    expect(sections[0]).toContain('Connection Access');
    expect(sections[0]).toContain('Connections from the campus network should be allowlisted.');
    expect(sections[0]).toContain('href="mailto:info@ruc.edu.kg"');
    expect(sections[0]).toContain('Loading this page does not confirm that playback is available.');
  });

  it('preserves connection diagnostics and escapes network metadata', () => {
    const page = loadPage();
    page.renderConn(trace, 'ip=192.0.2.1', { asn: 64512, org: 'Example <Network>' }, placement);
    const markup = page.element('conn-body').innerHTML;

    expect(markup).toContain('192.0.2.1');
    expect(markup).toContain('AS64512 — Example &lt;Network&gt;');
    expect(markup).not.toContain('Example <Network>');
    expect(markup).toContain('HTTP/2 · TLSv1.3');
    expect(markup).toContain('Amsterdam (AMS)');
    expect(markup).toContain('Hong Kong (HKG)');
  });

  it('describes route length without treating it as a playback result', () => {
    const page = loadPage();
    const near = page.pathHint('CN', 'HKG', placement);
    const far = page.pathHint('CN', 'AMS', placement);
    const unknown = page.pathHint('CN', 'AMS', null);

    expect(near.cls).toBe('verdict--ok');
    expect(far.cls).toBe('verdict--warn');
    expect(far.html).toContain('That is a long way round.');
    expect(unknown.cls).toBe('verdict--muted');
    expect(unknown.html).toContain('Could not tell where the relay runs');
  });
});
