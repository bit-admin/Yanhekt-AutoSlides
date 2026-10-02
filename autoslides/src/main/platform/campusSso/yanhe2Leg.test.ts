import { describe, expect, it } from 'vitest';
import type { AxiosResponse } from 'axios';
import { YANHE2_CASAPI_CAS_URL, YANHE2_CASAPI_ENTRY_URL } from '@common/yanhe2';
import type { CasTransport } from './casTransport';
import { Yanhe2LegError, mintYanhe2WithSession } from './yanhe2Leg';

const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJhY2NvdW50IjoiMTEyMCJ9.c2lnbmF0dXJl';
const SERVICE = 'https://aita.yanhekt.cn/casapi/index.php?auType=cas&forward=x&r=auth/login&tenant_code=21';
const CAS_LOGIN = `https://sso.bit.edu.cn/cas/login?service=${encodeURIComponent(SERVICE)}`;

type Reply = { status: number; location?: string; setCookie?: string[] };

/** Scripted stand-in for CasTransport: one reply per URL, and a log of what was asked. */
function fakeTransport(replies: Record<string, Reply>) {
  const requested: string[] = [];
  const transport = {
    setReferer() {},
    async request(url: string) {
      requested.push(url);
      const reply = replies[url];
      if (!reply) throw new Error(`unexpected request ${url}`);
      const headers: Record<string, unknown> = {};
      if (reply.location) headers.location = reply.location;
      if (reply.setCookie) headers['set-cookie'] = reply.setCookie;
      return { status: reply.status, headers, data: '' } as unknown as AxiosResponse<string>;
    },
  };
  return { transport: transport as unknown as CasTransport, requested };
}

const casapiHops: Record<string, Reply> = {
  [YANHE2_CASAPI_ENTRY_URL]: { status: 302, location: '/yjlogin/#/?tenant_code=21' },
  [YANHE2_CASAPI_CAS_URL]: {
    status: 302,
    location: `https://login.bit.edu.cn/authserver/login?service=${encodeURIComponent(SERVICE)}`,
  },
};

describe('mintYanhe2WithSession', () => {
  it('reuses the CAS session: service from casapi, ticket, then _token', async () => {
    const ticketUrl = `${SERVICE}&ticket=ST-1`;
    const { transport, requested } = fakeTransport({
      ...casapiHops,
      [CAS_LOGIN]: { status: 302, location: ticketUrl },
      [ticketUrl]: { status: 302, location: SERVICE },
      [SERVICE]: {
        status: 302,
        location: 'https://aita.yanhekt.cn/course',
        setCookie: [`_token=${'ab'.repeat(32)}${encodeURIComponent(`s:1:"${JWT}";`)}; Max-Age=57600`],
      },
    });
    await expect(mintYanhe2WithSession(transport)).resolves.toBe(JWT);
    // Never follows the final redirect back to the SPA.
    expect(requested).toEqual([YANHE2_CASAPI_ENTRY_URL, YANHE2_CASAPI_CAS_URL, CAS_LOGIN, ticketUrl, SERVICE]);
  });

  it('refuses to prompt when CAS shows its login page', async () => {
    const { transport } = fakeTransport({ ...casapiHops, [CAS_LOGIN]: { status: 200 } });
    await expect(mintYanhe2WithSession(transport)).rejects.toMatchObject({ code: 'no_session' });
  });

  it('fails cleanly when the ticket never yields a token', async () => {
    const ticketUrl = `${SERVICE}&ticket=ST-2`;
    const { transport } = fakeTransport({
      ...casapiHops,
      [CAS_LOGIN]: { status: 302, location: ticketUrl },
      [ticketUrl]: { status: 302, location: 'https://aita.yanhekt.cn/course' },
    });
    const error = await mintYanhe2WithSession(transport).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Yanhe2LegError);
    expect((error as Yanhe2LegError).code).toBe('no_token');
  });
});
