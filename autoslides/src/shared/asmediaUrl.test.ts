import { describe, it, expect } from 'vitest';
import { fromAsmediaUrl, toAsmediaUrl } from './asmediaUrl';

describe('asmediaUrl', () => {
  it('round-trips paths with Chinese, spaces, and Emby brackets', () => {
    const abs =
      '/Volumes/SN5000/Downloads/Test2/泛函分析 - S01E01 - 第1周 星期三 第2大节 [yhid=c62313s751843] [vtype=camera].mp4';
    const url = toAsmediaUrl(abs);
    expect(url.startsWith('asmedia://local/')).toBe(true);
    expect(url).not.toContain(' ');
    expect(fromAsmediaUrl(url)).toBe(abs);
  });

  it('round-trips Windows-style paths', () => {
    const abs = 'C:\\Users\\kate\\Videos\\screen_foo__c1s2.mp4';
    expect(fromAsmediaUrl(toAsmediaUrl(abs))).toBe(abs);
  });

  it('rejects non-asmedia urls', () => {
    expect(fromAsmediaUrl('file:///tmp/a.mp4')).toBeNull();
    expect(fromAsmediaUrl('http://localhost/x')).toBeNull();
    expect(fromAsmediaUrl('asmedia://other/x')).toBeNull();
  });

  it('throws on empty path', () => {
    expect(() => toAsmediaUrl('')).toThrow();
  });
});
