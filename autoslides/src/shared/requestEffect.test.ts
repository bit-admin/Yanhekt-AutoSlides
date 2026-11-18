import { describe, expect, it } from 'vitest';
import { requestEffect } from './requestEffect';

describe('requestEffect', () => {
  it('counts every non-GET as a write', () => {
    for (const method of ['POST', 'PUT', 'DELETE', 'patch']) {
      expect(requestEffect(method, 'https://cbiz.yanhekt.cn/v1/note')).toBe('write');
    }
  });

  it('knows the Yanhe 2.0 GETs that write', () => {
    expect(requestEffect('GET', 'https://aita.yanhekt.cn/courseapi/v3/course-collect/down?course_id=1')).toBe('write');
    expect(requestEffect('GET', 'https://aita.yanhekt.cn/courseapi/v3/course-collect/down?course_id=1&cancel=1')).toBe('write');
    expect(requestEffect('GET', 'https://aita.yanhekt.cn/pptnote/v1/searchlist?title=a')).toBe('write');
    expect(requestEffect('GET', 'https://aita.yanhekt.cn/courseapi/v2/learn-record/learn-record?x=1')).toBe('write');
    expect(requestEffect('GET', 'https://aita.yanhekt.cn//courseapi/v3/course-collect/down')).toBe('write');
  });

  it('leaves ordinary reads, and other hosts, as reads', () => {
    expect(requestEffect('GET', 'https://aita.yanhekt.cn/courseapi/v3/course-collect/lists')).toBe('read');
    expect(requestEffect('GET', 'https://aita.yanhekt.cn/courseapi/v3/course-collect/downloads')).toBe('read');
    expect(requestEffect('GET', 'https://cbiz.yanhekt.cn/pptnote/v1/searchlist')).toBe('read');
    expect(requestEffect('GET', 'not a url')).toBe('read');
  });
});
