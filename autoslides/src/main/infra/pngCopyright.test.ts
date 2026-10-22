import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { withPngCopyright } from './pngCopyright';
import { COPYRIGHT_SHORT } from '@common/copyrightNotice';

async function tinyPng(): Promise<Buffer> {
  return sharp({ create: { width: 4, height: 3, channels: 3, background: '#336699' } }).png().toBuffer();
}

describe('withPngCopyright', () => {
  it('adds a Copyright text chunk that decoders accept and pixels survive', async () => {
    const src = await tinyPng();
    const out = Buffer.from(withPngCopyright(src));
    expect(out.length).toBeGreaterThan(src.length);
    expect(out.toString('latin1')).toContain(`Copyright\0${COPYRIGHT_SHORT}`);

    const a = await sharp(src).raw().toBuffer();
    const b = await sharp(out).raw().toBuffer();
    expect(b.equals(a)).toBe(true);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe('png');
    expect(meta.comments?.some((c) => c.keyword === 'Copyright')).toBe(true);
  });

  it('is idempotent', async () => {
    const once = withPngCopyright(await tinyPng());
    const twice = withPngCopyright(once);
    expect(twice).toBe(once);
  });

  it('leaves non-PNG bytes alone', () => {
    const jpegish = Uint8Array.of(0xff, 0xd8, 0xff, 0xe0, ...new Array(40).fill(0));
    expect(withPngCopyright(jpegish)).toBe(jpegish);
  });
});
