import { describe, it, expect } from 'vitest';
import { parseCliInvocation } from './invocation';
import { parseDownloadArgs } from './downloadArgs';
import { findInterfaceByAddress, resolveCliInterface } from './networkInterface';

describe('parseCliInvocation', () => {
  it('is null for an ordinary app start', () => {
    expect(parseCliInvocation(['/Applications/AutoSlides.app/Contents/MacOS/AutoSlides'])).toBeNull();
    expect(parseCliInvocation(['electron', '.', '--demo-mode'])).toBeNull();
  });

  it('reads a wrapper bound to one command', () => {
    expect(parseCliInvocation(['exe', '--cli=download', '--', '123456', '--stream', 'both'])).toEqual({
      command: 'download',
      commandWord: 'download',
      bound: true,
      args: ['123456', '--stream', 'both'],
    });
  });

  it('reads the command from the umbrella wrapper', () => {
    expect(parseCliInvocation(['exe', '--cli', '--', 'download', '123456'])).toEqual({
      command: 'download',
      commandWord: 'download',
      bound: false,
      args: ['123456'],
    });
  });

  it('keeps an unknown command word for the error message', () => {
    const invocation = parseCliInvocation(['exe', '--cli', '--', 'extract', 'x']);
    expect(invocation?.command).toBeNull();
    expect(invocation?.commandWord).toBe('extract');
  });

  it('passes umbrella flags through without a command', () => {
    expect(parseCliInvocation(['exe', '--cli', '--', '--version'])).toEqual({
      command: null,
      bound: false,
      args: ['--version'],
    });
  });

  it('finds the switch after dev-mode arguments', () => {
    expect(parseCliInvocation(['electron', '.', '--cli=download', '--', '1'])?.args).toEqual(['1']);
  });
});

describe('parseDownloadArgs', () => {
  const run = (...args: string[]) => {
    const result = parseDownloadArgs(args);
    if (result.kind !== 'run') throw new Error(`expected run, got ${JSON.stringify(result)}`);
    return result.options;
  };

  it('accepts a bare id and defaults to the screen stream', () => {
    expect(run('123456')).toEqual({
      sessionId: '123456',
      streams: ['screen'],
      outputDir: undefined,
      intranet: false,
      interface: undefined,
      force: false,
      verbose: false,
    });
  });

  it('accepts a session link', () => {
    expect(run('https://www.yanhekt.cn/session/123456').sessionId).toBe('123456');
  });

  it('reads options in either form and any position', () => {
    const options = run('--stream=both', '-o', '/tmp/x', '123456', '--intranet', '-f');
    expect(options.streams).toEqual(['screen', 'camera']);
    expect(options.outputDir).toBe('/tmp/x');
    expect(options.intranet).toBe(true);
    expect(options.force).toBe(true);
    expect(run('1', '--output=/a', '-s', 'camera')).toMatchObject({ outputDir: '/a', streams: ['camera'] });
  });

  it('reports usage errors', () => {
    expect(parseDownloadArgs([]).kind).toBe('error');
    expect(parseDownloadArgs(['1', '2']).kind).toBe('error');
    expect(parseDownloadArgs(['1', '--stream', 'audio']).kind).toBe('error');
    expect(parseDownloadArgs(['1', '-o']).kind).toBe('error');
    expect(parseDownloadArgs(['1', '--nope']).kind).toBe('error');
    expect(parseDownloadArgs(['1', '--intranet', '--interface']).kind).toBe('error');
    // Only intranet traffic is bound to an interface.
    expect(parseDownloadArgs(['1', '--interface', 'en1']).kind).toBe('error');
    expect(parseDownloadArgs(['https://example.com/session/1']).kind).toBe('error');
    expect(parseDownloadArgs(['https://www.yanhekt.cn/course/64333']).kind).toBe('error');
  });

  it('answers help and version without a session', () => {
    expect(parseDownloadArgs(['-h']).kind).toBe('help');
    expect(parseDownloadArgs(['1', '--version']).kind).toBe('version');
  });
});

describe('--interface', () => {
  const nic = (address: string, family = 'IPv4', internal = false) =>
    ({ address, family, internal }) as never;
  const table = {
    lo0: [nic('127.0.0.1', 'IPv4', true)],
    en0: [nic('fe80::1', 'IPv6'), nic('192.168.1.228')],
    en1: [nic('192.168.31.58')],
    awdl0: [nic('fe80::2', 'IPv6')],
  };

  it('is read with --intranet in either form', () => {
    const parsed = parseDownloadArgs(['1', '--intranet', '--interface=en1']);
    expect(parsed.kind === 'run' && parsed.options.interface).toBe('en1');
    const spaced = parseDownloadArgs(['--interface', '192.168.31.58', '--intranet', '1']);
    expect(spaced.kind === 'run' && spaced.options.interface).toBe('192.168.31.58');
  });

  it('resolves a name or one of the machine\'s addresses', () => {
    expect(resolveCliInterface('en1', table)).toEqual({ ok: true, iface: { name: 'en1', address: '192.168.31.58' } });
    expect(resolveCliInterface('192.168.1.228', table)).toEqual({ ok: true, iface: { name: 'en0', address: '192.168.1.228' } });
  });

  it('explains what is wrong and lists what exists', () => {
    const noV4 = resolveCliInterface('awdl0', table);
    expect(noV4.ok === false && noV4.message).toContain('has no IPv4 address');
    const unknown = resolveCliInterface('en9', table);
    expect(unknown.ok === false && unknown.message).toContain('en1 (192.168.31.58)');
    // Loopback is never offered.
    expect(resolveCliInterface('lo0', table).ok).toBe(false);
  });

  it('names the interface behind a saved address', () => {
    expect(findInterfaceByAddress('192.168.31.58', table)).toEqual({ name: 'en1', address: '192.168.31.58' });
    expect(findInterfaceByAddress('10.9.9.9', table)).toBeNull();
  });
});
