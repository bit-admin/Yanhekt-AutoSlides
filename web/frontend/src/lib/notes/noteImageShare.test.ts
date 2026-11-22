import { describe, expect, it } from 'vitest';
import { createNoteImageShare } from './noteImageShare';
import { decodeSharePayload, shareImageRefs } from './shareLink';

const text = { type: 'paragraph', data: { text: 'Private note text' } };
const image = (url: string) => ({ type: 'image', data: { file: { url }, caption: 'Private caption' } });
const publicImage = image(`https://coss.yanhekt.cn/images/2026/11/${'a'.repeat(32)}.png`);
const otherImage = image('https://example.test/diagram.png');
const oldTimeline = {
  events: [{ id: 'first', changeAt: 12, initialFile: 'Slide_001.png' }],
  resolutions: { first: { state: 'canonical', file: 'Slide_001.png' } },
};
const legacyBlock = { type: 'code', data: { code: JSON.stringify({ autoslides: { timeline: oldTimeline } }) } };
const doc = (...blocks: unknown[]) => JSON.stringify({ blocks });
const payloadOf = (url: string) => decodeSharePayload(new URL(url).hash);

describe('Notes image sharing', () => {
  it('shares only uploaded images, with no note text, title or folder dependency', () => {
    const share = createNoteImageShare('Private title', doc(text, otherImage, publicImage));
    expect(share.imageCount).toBe(1);
    const payload = payloadOf(share.url);
    expect(payload).toEqual({ v: 2, p: '2026/11', n: 7, h: 'aaaaaaa' });
    expect(payload && shareImageRefs(payload)).toEqual([{ index: 0, prefix: '2026/11', short: 'aaaaaaa' }]);
  });

  it('keeps the lecture IDs and cues in a link rebuilt from a legacy import', () => {
    const share = createNoteImageShare('c501s601 · Example lecture', doc(publicImage, legacyBlock));
    expect(payloadOf(share.url)).toMatchObject({ v: 3, c: '501', s: '601', t: '0:12' });
  });

  it('omits legacy cues if some images will not be present in the link', () => {
    const share = createNoteImageShare('c501s601 · Example lecture', doc(otherImage, publicImage, legacyBlock));
    expect(payloadOf(share.url)).toMatchObject({ v: 2, c: '501', s: '601' });
  });

  it('omits legacy cues after an image was deleted from the note', () => {
    const timeline = {
      events: [
        { id: 'first', changeAt: 12, initialFile: 'Slide_001.png' },
        { id: 'second', changeAt: 40, initialFile: 'Slide_002.png' },
      ],
      resolutions: {
        first: { state: 'canonical', file: 'Slide_001.png' },
        second: { state: 'canonical', file: 'Slide_002.png' },
      },
    };
    const block = { type: 'code', data: { code: JSON.stringify({ autoslides: { timeline } }) } };
    const payload = payloadOf(createNoteImageShare('c501s601 · Example lecture', doc(publicImage, block)).url);
    expect(payload).toMatchObject({ v: 2, c: '501', s: '601' });
    expect(payload).not.toHaveProperty('t');
  });

  it('does not read an ordinary title as a lecture id', () => {
    for (const title of ['l2 regularization', 'c3 review', 'l2', 'c3s4']) {
      const payload = payloadOf(createNoteImageShare(title, doc(publicImage)).url);
      expect(payload).not.toHaveProperty('c');
      expect(payload).not.toHaveProperty('l');
    }
  });

  it('does not generate a link without shareable images', () => {
    expect(createNoteImageShare('Title', doc(text, otherImage))).toEqual({ imageCount: 0, url: '' });
  });
});
