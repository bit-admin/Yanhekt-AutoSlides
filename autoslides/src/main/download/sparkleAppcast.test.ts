import { describe, it, expect, beforeAll } from 'vitest';
import * as crypto from 'crypto';
import * as path from 'path';
import { pathToFileURL } from 'url';

interface SparkleScript {
  singleItemFeed(xml: string, version: string): string;
  sparkleSeedOf(privateKey: crypto.KeyObject): string;
  publicEdKey(): string;
}

const scriptUrl = pathToFileURL(path.resolve(__dirname, '../../../scripts/sparkle.mjs')).href;
let script: SparkleScript;

beforeAll(async () => {
  script = (await import(scriptUrl)) as SparkleScript;
});

const item = (version: string, prefix: string) => `
        <item>
            <sparkle:version>${version}</sparkle:version>
            <sparkle:shortVersionString>${version}</sparkle:shortVersionString>
            <enclosure url="${prefix}AutoSlides-${version}-macOS-arm64.dmg" length="1" sparkle:edSignature="x"/>
            <sparkle:deltas>
                <enclosure url="${prefix}AutoSlides${version}-5.2.3.delta" sparkle:deltaFrom="5.2.3" length="1" sparkle:edSignature="y"/>
            </sparkle:deltas>
        </item>`;

describe('scripts/sparkle.mjs', () => {
  it('keeps only the new version and names files relative to the feed', () => {
    const xml = `<?xml version="1.0"?>\n<rss><channel><title>AutoSlides</title>${item('5.3.0', 'https://example.com/dl/')}${item('5.2.3', '')}\n    </channel>\n</rss>\n`;
    const feed = script.singleItemFeed(xml, '5.3.0');
    expect(feed.match(/<item>/g)).toHaveLength(1);
    expect(feed).toContain('url="AutoSlides-5.3.0-macOS-arm64.dmg"');
    expect(feed).toContain('url="AutoSlides5.3.0-5.2.3.delta"');
    expect(feed).not.toContain('example.com');
    expect(feed).not.toContain('<sparkle:version>5.2.3<');
    expect(feed.trim().endsWith('</rss>')).toBe(true);
  });

  it('refuses a feed without the new version', () => {
    expect(() => script.singleItemFeed(`<rss>${item('5.2.3', '')}</rss>`, '5.3.0')).toThrow(/no item for 5\.3\.0/);
  });

  it('exports the seed Sparkle signs with, for the key the app ships', () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
    const seed = Buffer.from(script.sparkleSeedOf(privateKey), 'base64');
    expect(seed).toHaveLength(32);
    // Rebuild the key from the seed alone: it must be the same key.
    const pkcs8Prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
    const rebuilt = crypto.createPrivateKey({ key: Buffer.concat([pkcs8Prefix, seed]), format: 'der', type: 'pkcs8' });
    expect(crypto.createPublicKey(rebuilt).export({ format: 'der', type: 'spki' }))
      .toEqual(publicKey.export({ format: 'der', type: 'spki' }));
    expect(Buffer.from(script.publicEdKey(), 'base64')).toHaveLength(32);
  });
});
