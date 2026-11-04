import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CasProbe } from '@main/platform/campusSso/casProbe';
import type { DevSsoSnapshot } from '@common/devSso';

const flow = vi.hoisted(() => ({
  start: vi.fn(),
  finish: vi.fn(),
}));

vi.mock('@main/platform/campusSso/casFlow', () => ({
  CasSignInError: class extends Error {
    constructor(message: string, readonly reason: string) { super(message); }
  },
  startPasswordSignIn: flow.start,
  finishSecondFactor: flow.finish,
}));

import { DevSsoLab } from './devSsoLab';
import type { ConfigService } from '@main/platform/configService';

const config = { getSsoDeviceCookies: () => [] } as unknown as ConfigService;
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const request = { username: 'u', password: 'p', target: 'yanhekt' as const, useTrustedDevice: false, stepMode: false };

/** A fake flow: two steps, then the SMS gate, then a second-factor handle. */
function fakeSecondFactorFlow(sent: string[]) {
  flow.start.mockImplementation(async (_u: string, _p: string, _seed: unknown, _opts: unknown, probe: CasProbe) => {
    await probe.beforeStep('load_login_page');
    await probe.beforeStep('submit_password');
    const decision = await probe.confirmSmsSend('138****0000');
    if (decision === 'send') {
      await probe.beforeStep('send_sms');
      sent.push('sms');
    }
    return { kind: 'second_factor', handle: { phoneHint: '138****0000', probe } };
  });
}

describe('DevSsoLab', () => {
  let lab: DevSsoLab;
  let last: DevSsoSnapshot | null;

  beforeEach(() => {
    flow.start.mockReset();
    flow.finish.mockReset();
    lab = new DevSsoLab(config, () => true);
    last = null;
    lab.subscribe((s) => { last = s; });
  });

  it('refuses outside developer mode', () => {
    const off = new DevSsoLab(config, () => false);
    expect(() => off.start(request)).toThrow(/Developer mode/);
  });

  it('never sends the SMS until told to', async () => {
    const sent: string[] = [];
    fakeSecondFactorFlow(sent);
    lab.start(request);
    await tick();
    expect(last?.status).toBe('awaiting_sms_send');
    await tick();
    expect(sent).toEqual([]);

    lab.sendSms('send');
    await tick();
    expect(sent).toEqual(['sms']);
    expect(last?.status).toBe('awaiting_code');
    expect(last?.steps.map((s) => s.id)).toEqual(['load_login_page', 'submit_password', 'send_sms']);
  });

  it('skips the send when a code is already in hand', async () => {
    const sent: string[] = [];
    fakeSecondFactorFlow(sent);
    lab.start(request);
    await tick();
    lab.sendSms('skip');
    await tick();
    expect(sent).toEqual([]);
    expect(last?.status).toBe('awaiting_code');
  });

  it('pauses before each step in step mode and runs one at a time', async () => {
    fakeSecondFactorFlow([]);
    lab.start({ ...request, stepMode: true });
    await tick();
    expect(last?.status).toBe('paused');
    expect(last?.steps.at(-1)).toMatchObject({ id: 'load_login_page', state: 'waiting' });

    lab.control('step');
    await tick();
    expect(last?.status).toBe('paused');
    expect(last?.steps.map((s) => [s.id, s.state])).toEqual([['load_login_page', 'done'], ['submit_password', 'waiting']]);

    lab.control('resume');
    await tick();
    expect(last?.status).toBe('awaiting_sms_send');
  });

  it('stops wherever it is and ignores the flow afterwards', async () => {
    fakeSecondFactorFlow([]);
    lab.start({ ...request, stepMode: true });
    await tick();
    lab.control('stop');
    await tick();
    expect(last?.status).toBe('stopped');
    expect(flow.finish).not.toHaveBeenCalled();
  });

  it('finishes with masked tokens after the code', async () => {
    fakeSecondFactorFlow([]);
    flow.finish.mockResolvedValue({ tokens: { yanhekt: '0123456789abcdef0123456789abcdef' }, durableCookies: [] });
    lab.start(request);
    await tick();
    lab.sendSms('skip');
    await tick();
    lab.submitCode('123456');
    await tick();
    expect(flow.finish).toHaveBeenCalledWith(expect.anything(), '123456');
    expect(last?.status).toBe('succeeded');
    expect(last?.result?.yanhekt).toBe('0123…cdef');
    expect(JSON.stringify(last)).not.toContain('0123456789abcdef0123456789abcdef');
  });

  it('shows raw values only while reveal is on, in both directions', async () => {
    const token = '0123456789abcdef0123456789abcdef';
    flow.start.mockImplementation(async (_u: string, _p: string, _seed: unknown, _opts: unknown, probe: CasProbe) => {
      await probe.beforeStep('exchange_ticket');
      probe.onExchange({
        method: 'GET',
        url: `https://www.yanhekt.cn/?token=${token}`,
        requestHeaders: { Cookie: 'TGC=cookie-secret' },
        startedAt: 0,
        durationMs: 1,
      });
      return { kind: 'signed_in', tokens: { yanhekt: token }, durableCookies: [{ name: 'TGC', value: 'cookie-secret', host: 'bit.edu.cn', path: '/', expiresAt: Date.now() + 1000 }] };
    });
    lab.start(request);
    await tick();
    expect(last?.status).toBe('succeeded');
    expect(JSON.stringify(last)).not.toContain(token);
    expect(JSON.stringify(last)).not.toContain('cookie-secret');

    lab.setReveal(true);
    expect(last?.reveal).toBe(true);
    expect(last?.result?.yanhekt).toBe(token);
    expect(last?.result?.durableCookies[0].value).toBe('cookie-secret');
    expect(last?.steps[0].exchanges[0].url).toContain(token);
    expect(last?.steps[0].exchanges[0].requestHeaders.Cookie).toBe('TGC=cookie-secret');

    lab.setReveal(false);
    expect(JSON.stringify(last)).not.toContain(token);
    expect(JSON.stringify(last)).not.toContain('cookie-secret');
  });
});
