import { describe, expect, it } from 'vitest';
import { buildUrl, parseQuery, readEnvelope } from './useApiLab';
import { YANHE2, YANHE2_API_PRESETS, YANHE2_PRESET_GROUPS } from './yanhe2ApiPresets';
import { YANHEKT_API_PRESETS, presetUrl } from './yanhektApiPresets';

describe('query round trip', () => {
  it('parses half-typed and encoded queries', () => {
    expect(parseQuery('a=1&b=&c&d=%E6%B3%9B+x')).toEqual([
      { key: 'a', value: '1' },
      { key: 'b', value: '' },
      { key: 'c', value: '' },
      { key: 'd', value: '泛 x' },
    ]);
    expect(parseQuery('bad=%E0')).toEqual([{ key: 'bad', value: '%E0' }]);
  });

  it('builds only enabled, named rows', () => {
    expect(buildUrl('https://h/p', [
      { key: 'id', value: '1', enabled: true },
      { key: 'off', value: 'x', enabled: false },
      { key: ' ', value: 'y', enabled: true },
      { key: 'kw', value: '泛函', enabled: true },
    ])).toBe('https://h/p?id=1&kw=%E6%B3%9B%E5%87%BD');
    expect(buildUrl('https://h/p', [])).toBe('https://h/p');
  });
});

describe('readEnvelope', () => {
  it('names a known code, string or number', () => {
    expect(readEnvelope('{"code":"61101113","message":"用户未登录"}')).toMatchObject({ code: '61101113', meaning: expect.stringContaining('Not signed in') });
    expect(readEnvelope('{"code":0}')).toMatchObject({ code: '0', meaning: 'OK' });
    expect(readEnvelope('<html>')).toBeNull();
    expect(readEnvelope('[]')).toBeNull();
  });

  it('reads every Yanhe 2.0 envelope', () => {
    const y2 = (body: unknown) => readEnvelope(JSON.stringify(body), 'yanhe2');
    expect(y2({ code: 0, msg: 'success', data: {} })).toMatchObject({ code: '0', ok: true });
    expect(y2({ code: 200, message: '查询成功', params: {} })).toMatchObject({ code: '200', ok: true, message: '查询成功' });
    expect(y2({ code: 1000, status: 200, params: {} })).toMatchObject({ code: '1000', ok: true });
    expect(y2({ code: 10000, data: {} })).toMatchObject({ code: '10000', ok: true });
    expect(y2({ success: true, result: { code: 200, msg: '', list: [] } })).toMatchObject({ code: '200', ok: true });
    expect(y2({ success: true, result: { code: 400, msg: '课表为空' } })).toMatchObject({ code: '400', ok: false, message: '课表为空' });
    expect(y2({ success: true, result: { err: 201, errMsg: '重复收藏' } })).toMatchObject({ code: '201', ok: true, meaning: expect.stringContaining('Already') });
    expect(y2({ success: true, data: { code: 200, msg: '', data: {} } })).toMatchObject({ code: '200', ok: true });
    expect(y2({ code: 10002, msg: '未查询到语音数据' })).toMatchObject({ code: '10002', ok: false });
    expect(y2({ code: -1, msg: '没有数据' })).toMatchObject({ code: '-1', ok: false });
    expect(readEnvelope('', 'yanhe2')).toBeNull();
  });
});

describe('presets', () => {
  it('have unique ids and cbiz URLs', () => {
    const ids = YANHEKT_API_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of YANHEKT_API_PRESETS) {
      expect(presetUrl(p).startsWith('https://cbiz.yanhekt.cn/v')).toBe(true);
      if (p.body) expect(() => JSON.parse(p.body as string)).not.toThrow();
      if (p.write) expect(p.method).not.toBe('GET');
    }
  });

  it('Yanhe 2.0: unique ids, aita URLs, every group listed', () => {
    const ids = [...YANHEKT_API_PRESETS, ...YANHE2_API_PRESETS].map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of YANHE2_API_PRESETS) {
      expect(presetUrl(p, YANHE2).startsWith('https://aita.yanhekt.cn/')).toBe(true);
      expect(YANHE2_PRESET_GROUPS).toContain(p.group);
      expect(p.auth).toBe('auth');
    }
    // aita GETs that change the account are marked by effect.
    const writes = YANHE2_API_PRESETS.filter((p) => p.write).map((p) => p.path);
    expect(writes).toContain('/courseapi/v3/course-collect/down');
    expect(writes).toContain('/pptnote/v1/searchlist');
  });
});
