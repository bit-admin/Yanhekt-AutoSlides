import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AxiosResponse } from 'axios';
import { YANHE2_READ_PATHS, getYanhe2Json, readYanhe2, routeYanhe2Through, type Yanhe2Send } from './yanhe2Http';
import { fetchYanhe2Profile } from './yanhe2Api';

const answer = (status: number, data: unknown = '') => ({ status, data }) as AxiosResponse;

/** Install a sender that records what it was asked and replies with `reply`. */
function route(reply: AxiosResponse | Error) {
  const sender = vi.fn<Yanhe2Send>(async () => {
    if (reply instanceof Error) throw reply;
    return reply;
  });
  routeYanhe2Through(sender);
  return sender;
}

afterEach(() => {
  // Never leave a test's sender installed: the default would hit the network.
  routeYanhe2Through(async () => { throw new Error('no sender installed'); });
});

describe('Yanhe 2.0 JSON requests', () => {
  it('all go through the installed sender, to the public URL, without following redirects', async () => {
    const sender = route(answer(200, { code: 200 }));
    await readYanhe2('jwt', YANHE2_READ_PATHS.courseDetail, { course_id: '200101' });
    await fetchYanhe2Profile('jwt');

    expect(sender).toHaveBeenCalledTimes(2);
    const [detail, profile] = sender.mock.calls.map(([config]) => config);
    // The transport decides the address; callers always name the public host.
    expect(detail.url).toBe('https://aita.yanhekt.cn/courseapi/v3/multi-search/get-course-detail?course_id=200101');
    expect(profile.url).toBe('https://aita.yanhekt.cn/userapi/v1/infosimple');
    for (const config of [detail, profile]) {
      expect(config.method).toBe('GET');
      expect(config.maxRedirects).toBe(0);
      expect(config.headers).toMatchObject({ Authorization: 'Bearer jwt', 'tenant-id': '21' });
    }
  });

  it('reports no answer as null, and a status as itself', async () => {
    route(new Error('socket hang up'));
    expect(await getYanhe2Json('jwt', 'https://aita.yanhekt.cn/x')).toBeNull();
    route(answer(302));
    expect(await getYanhe2Json('jwt', 'https://aita.yanhekt.cn/x')).toEqual({ status: 302, data: '' });
  });

  it('sorts a read into ok, rejected, network and failed', async () => {
    const read = () => readYanhe2('jwt', YANHE2_READ_PATHS.dayList, {});
    route(answer(200, { success: true }));
    expect(await read()).toEqual({ kind: 'ok', data: { success: true } });
    route(answer(403));
    expect(await read()).toEqual({ kind: 'rejected' });
    route(new Error('timeout'));
    expect(await read()).toEqual({ kind: 'network' });
    route(answer(502, '<html>'));
    expect(await read()).toMatchObject({ kind: 'failed' });
    // A 200 that is not JSON (a login page, say) is not data.
    route(answer(200, '<html>'));
    expect(await read()).toMatchObject({ kind: 'failed' });
  });

  it('reads the profile the same way', async () => {
    route(answer(200, { code: 200, params: { id: 10003, tenant_id: 21, phone: '10000000000' } }));
    expect(await fetchYanhe2Profile('jwt')).toEqual({
      kind: 'ok',
      profile: { userId: 10003, tenantId: 21, playSigningPhone: '10000000000' },
    });
    route(answer(403));
    expect(await fetchYanhe2Profile('jwt')).toEqual({ kind: 'rejected' });
    route(new Error('offline'));
    expect(await fetchYanhe2Profile('jwt')).toEqual({ kind: 'network' });
  });
});
