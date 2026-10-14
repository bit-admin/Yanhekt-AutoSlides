import { describe, expect, it } from 'vitest';
import { isYanhe2SlideImageUrl, parseYanhe2Slides } from './yanhe2Slides';

const DIR = 'https://aita.yanhekt.cn/ai-nginx/ai3/ppt/20260921/a9b53472-2d31-4cfc-bcdd-f21535c152fe';

const row = (file: string, created: number, extra: Record<string, unknown> = {}) => ({
  sub_id: '3000101',
  course_id: '200101',
  created_sec: created,
  content: JSON.stringify({
    detecttype: 'ppt',
    is_key: false,
    pptimgurl: `${DIR}/${file}`,
    pptthumb: `${DIR}/${file}`,
    created,
    status: 'running',
    ...extra,
  }),
});

describe('parseYanhe2Slides', () => {
  it('reads the image and the time out of each row', () => {
    const slides = parseYanhe2Slides({ code: 0, msg: 'success', total: 2, list: [row('0.jpg', 0), row('680900.jpg', 681)] });
    expect(slides).toEqual([
      { seconds: 0, url: `${DIR}/0.jpg` },
      { seconds: 681, url: `${DIR}/680900.jpg` },
    ]);
  });

  it('puts rows in time order', () => {
    const slides = parseYanhe2Slides({ code: 0, list: [row('b.jpg', 900), row('a.jpg', 30)] });
    expect(slides?.map((slide) => slide.seconds)).toEqual([30, 900]);
  });

  it('treats a lecture without slides as an empty list', () => {
    expect(parseYanhe2Slides({ code: 0, msg: 'success', total: 0, list: [] })).toEqual([]);
    expect(parseYanhe2Slides({ code: 0, total: 0 })).toEqual([]);
  });

  it('drops rows it cannot use', () => {
    const slides = parseYanhe2Slides({
      code: 0,
      list: [
        { content: 'not json' },
        { content: JSON.stringify({ pptimgurl: 'https://example.com/ai-nginx/a.jpg', created: 5 }) },
        null,
        row('ok.jpg', 12),
      ],
    });
    expect(slides).toEqual([{ seconds: 12, url: `${DIR}/ok.jpg` }]);
  });

  it('refuses another envelope', () => {
    expect(parseYanhe2Slides({ code: -1, msg: '没有数据' })).toBeNull();
    expect(parseYanhe2Slides(null)).toBeNull();
  });
});

describe('isYanhe2SlideImageUrl', () => {
  it('accepts images under /ai-nginx/', () => {
    expect(isYanhe2SlideImageUrl(`${DIR}/0.jpg`)).toBe(true);
  });

  it('refuses other hosts, other trees and other files', () => {
    expect(isYanhe2SlideImageUrl('https://example.com/ai-nginx/a.jpg')).toBe(false);
    expect(isYanhe2SlideImageUrl('http://aita.yanhekt.cn/ai-nginx/a.jpg')).toBe(false);
    expect(isYanhe2SlideImageUrl('https://aita.yanhekt.cn/play/a.jpg')).toBe(false);
    expect(isYanhe2SlideImageUrl('https://aita.yanhekt.cn/ai-nginx/../courseapi/a.jpg')).toBe(false);
    expect(isYanhe2SlideImageUrl('https://aita.yanhekt.cn/ai-nginx/a.mp4')).toBe(false);
    expect(isYanhe2SlideImageUrl('not a url')).toBe(false);
  });
});
