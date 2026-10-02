import { describe, expect, it } from 'vitest';
import { formatLogArg, formatLogArgs, redactLogText, MAX_ARG_CHARS } from './logFormat';

describe('formatLogArg', () => {
  it('uses the stack for errors', () => {
    const text = formatLogArg(new Error('boom'));
    expect(text).toContain('Error: boom');
    expect(text).toContain('logFormat.test');
  });

  it('serializes objects, cycles and nested errors', () => {
    const obj: Record<string, unknown> = { a: 1, err: new Error('inner') };
    obj.self = obj;
    const text = formatLogArg(obj);
    expect(text).toContain('"a":1');
    expect(text).toContain('[Circular]');
    expect(text).toContain('inner');
  });

  it('truncates huge arguments', () => {
    const text = formatLogArg('x'.repeat(MAX_ARG_CHARS + 100));
    expect(text.length).toBeLessThan(MAX_ARG_CHARS + 30);
    expect(text).toContain('[+100 chars]');
  });

  it('joins arguments with spaces', () => {
    expect(formatLogArgs(['a', 1, null, undefined])).toBe('a 1 null undefined');
  });
});

describe('redactLogText', () => {
  const token = '0123456789abcdef0123456789abcdef';

  it('masks bare 32-hex tokens and query params', () => {
    expect(redactLogText(`http://127.0.0.1/p?t=${token}&x=1`)).toBe('http://127.0.0.1/p?t=****cdef&x=1');
  });

  it('masks Bearer values without mangling the scheme', () => {
    expect(redactLogText('Authorization: Bearer abc.def.ghi1')).toBe('Authorization: Bearer ****ghi1');
    expect(redactLogText('{"Authorization":"Bearer secretvalue"}')).toBe('{"Authorization":"Bearer ****alue"}');
  });

  it('masks header-style secrets and passwords', () => {
    expect(redactLogText('{"Xvideo_Token":"abcdefgh"}')).toBe('{"Xvideo_Token":"****efgh"}');
    expect(redactLogText('{"password":"hunter2"}')).toBe('{"password":"****"}');
  });

  it('masks bare JWTs and mobile numbers', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJhY2NvdW50IjoiMTEyMCJ9.c2lnbmF0dXJlX3ZhbHVl';
    expect(redactLogText(`url?token=${jwt}&x=1`)).toBe('url?token=****bHVl&x=1');
    expect(redactLogText('{"phone":"13800138000"}')).toBe('{"phone":"****8000"}');
    expect(redactLogText('ts 1790663933123 id 1120231903')).toBe('ts 1790663933123 id 1120231903');
  });

  it('leaves ordinary text alone', () => {
    expect(redactLogText('Slide_0012.png kept, ssim=0.93')).toBe('Slide_0012.png kept, ssim=0.93');
  });
});
