import { describe, it, expect } from 'vitest';
import type { SemesterOption } from '@common/apiTypes';
import type { StoredAccount } from '@common/types';
import { intOption, parseArgs, type OptionSpec } from './args';
import { resolveCredentials } from './credentials';
import { CliError } from './errors';
import { displayWidth, englishTitle, formatDuration, table } from './format';
import { buildSchema, commandHelp } from './help';
import { parseCliInvocation } from './invocation';
import { findInterfaceByAddress, resolveCliInterface } from './networkInterface';
import { parseCourseTarget, parseSessionTarget } from './targets';
import { matchTerm, termKey } from './terms';
import type { CliCommand } from './types';

describe('parseCliInvocation', () => {
  it('is null for an ordinary app start', () => {
    expect(parseCliInvocation(['/Applications/AutoSlides.app/Contents/MacOS/AutoSlides'])).toBeNull();
    expect(parseCliInvocation(['electron', '.', '--demo-mode'])).toBeNull();
  });

  it('takes the program from the switch and the command from the first argument', () => {
    expect(parseCliInvocation(['exe', '--cli=yhdl', '--', 'search', '微积分', '--json'])).toEqual({
      program: 'yhdl',
      command: 'search',
      commandWord: 'search',
      args: ['微积分', '--json'],
    });
  });

  it('falls back to the default program name for a bare switch', () => {
    expect(parseCliInvocation(['electron', '.', '--cli', '--', 'download', '1'])).toMatchObject({
      program: 'autoslides',
      command: 'download',
      args: ['1'],
    });
  });

  it('takes a link in place of the command', () => {
    expect(parseCliInvocation(['exe', '--cli=yhdl', '--', 'https://www.yanhekt.cn/session/850101', '-s', 'both'])).toEqual({
      program: 'yhdl',
      command: 'download',
      args: ['https://www.yanhekt.cn/session/850101', '-s', 'both'],
    });
    expect(parseCliInvocation(['exe', '--cli=yhdl', '--', 'www.yanhekt.cn/course/70101', '--json'])).toMatchObject({
      command: 'course',
      args: ['www.yanhekt.cn/course/70101', '--json'],
    });
  });

  it('keeps an unknown command word for the error message', () => {
    // A bare id is not a command: `download` has to be said.
    const invocation = parseCliInvocation(['exe', '--cli=yhdl', '--', '123456']);
    expect(invocation?.command).toBeNull();
    expect(invocation?.commandWord).toBe('123456');
  });

  it('passes program flags through without a command', () => {
    expect(parseCliInvocation(['exe', '--cli=yhdl', '--', '--version'])).toEqual({
      program: 'yhdl',
      command: null,
      args: ['--version'],
    });
    expect(parseCliInvocation(['exe', '--cli=yhdl', '--'])).toEqual({ program: 'yhdl', command: null, args: [] });
  });
});

describe('parseArgs', () => {
  const specs: OptionSpec[] = [
    { long: 'stream', short: 's', value: 'which', choices: ['screen', 'camera', 'both'], description: '' },
    { long: 'output', short: 'o', value: 'dir', description: '' },
    { long: 'force', short: 'f', description: '' },
    { long: 'no-sessions', description: '' },
  ];
  const parse = (...args: string[]) => {
    const result = parseArgs(args, specs);
    if (!result.ok) throw new Error(result.message);
    return result.parsed;
  };

  it('reads options in either form and any position', () => {
    expect(parse('--stream=both', '-o', '/tmp/x', '123', '-f', '456')).toEqual({
      positionals: ['123', '456'],
      options: { stream: 'both', output: '/tmp/x', force: true },
    });
    expect(parse('--no-sessions', '1').options).toEqual({ 'no-sessions': true });
  });

  it('keeps "-" and everything after "--" as arguments', () => {
    expect(parse('-', '--', '-f').positionals).toEqual(['-', '-f']);
  });

  it('reports usage errors', () => {
    expect(parseArgs(['--nope'], specs)).toEqual({ ok: false, message: 'unknown option: --nope' });
    expect(parseArgs(['-o'], specs).ok).toBe(false);
    expect(parseArgs(['--stream', 'audio'], specs).ok).toBe(false);
    expect(parseArgs(['--force=yes'], specs).ok).toBe(false);
  });
});

describe('intOption', () => {
  it('reads a page or limit, with a default and a ceiling', () => {
    expect(intOption(undefined, 'page', 1)).toBe(1);
    expect(intOption('3', 'page', 1)).toBe(3);
    expect(() => intOption('0', 'page', 1)).toThrow(CliError);
    expect(() => intOption('2.5', 'page', 1)).toThrow(/whole number/);
    expect(() => intOption('101', 'limit', 20, 100)).toThrow(/1 to 100/);
  });
});

describe('targets', () => {
  it('reads a bare number as what the command expects', () => {
    expect(parseSessionTarget('850101', 'yhdl')).toBe('850101');
    expect(parseCourseTarget('70101', 'yhdl')).toBe('70101');
  });

  it('reads links, with or without the scheme', () => {
    expect(parseSessionTarget('https://www.yanhekt.cn/session/850101', 'yhdl')).toBe('850101');
    expect(parseCourseTarget('www.yanhekt.cn/course/70101', 'yhdl')).toBe('70101');
  });

  it('points the wrong kind of link at the command that takes it', () => {
    const asSession = () => parseSessionTarget('https://www.yanhekt.cn/course/70101', 'yhdl');
    expect(asSession).toThrow(CliError);
    expect(asSession).toThrow(/course link/);
    try {
      parseCourseTarget('https://www.yanhekt.cn/session/850101', 'yhdl');
    } catch (error) {
      expect((error as CliError).code).toBe('usage');
      expect((error as CliError).hint).toContain('yhdl session 850101');
    }
    expect(() => parseSessionTarget('https://example.com/session/1', 'yhdl')).toThrow(/not a session id/);
  });
});

describe('resolveCredentials', () => {
  const alice: StoredAccount = { badge: 'student-a', nickname: 'alice', displayName: 'Alice', token: 'a'.repeat(32), addedAt: 0, lastUsedAt: 0 };
  const bob: StoredAccount = { badge: 'student-b', nickname: 'bob', displayName: '', token: 'b'.repeat(32), addedAt: 0, lastUsedAt: 0 };
  const base = { accounts: [alice, bob], activeToken: alice.token };
  const ok = (input: Parameters<typeof resolveCredentials>[0]) => {
    const result = resolveCredentials(input);
    if (!result.ok) throw new Error(result.message);
    return result.credentials;
  };

  it('takes the app\'s active account when nothing else is given', () => {
    expect(ok(base)).toEqual({ token: alice.token, source: 'app', account: { badge: alice.badge, name: 'Alice' } });
  });

  it('prefers --token, then --account, then the environment', () => {
    const env = 'c'.repeat(32);
    expect(ok({ ...base, flagToken: 'd'.repeat(32), envToken: env }).source).toBe('flag');
    expect(ok({ ...base, flagAccount: 'bob', envToken: env })).toMatchObject({ token: bob.token, source: 'account' });
    expect(ok({ ...base, envToken: env })).toEqual({ token: env, source: 'env', account: null });
  });

  it('finds a saved account by badge or name, ignoring case', () => {
    expect(ok({ ...base, flagAccount: 'STUDENT-B' }).token).toBe(bob.token);
    expect(ok({ ...base, flagAccount: 'ALICE' }).token).toBe(alice.token);
  });

  it('names the account behind a passed token when it is a saved one', () => {
    expect(ok({ ...base, flagToken: bob.token }).account?.name).toBe('bob');
  });

  it('refuses malformed input before anything is sent', () => {
    expect(resolveCredentials({ ...base, flagToken: 'short' })).toMatchObject({ ok: false, code: 'usage' });
    expect(resolveCredentials({ ...base, envToken: 'nope' })).toMatchObject({ ok: false, code: 'usage' });
    expect(resolveCredentials({ ...base, flagToken: alice.token, flagAccount: 'bob' })).toMatchObject({ ok: false, code: 'usage' });
    expect(resolveCredentials({ ...base, flagAccount: 'carol' })).toMatchObject({ ok: false, code: 'usage' });
  });

  it('asks for a sign-in when there is none', () => {
    expect(resolveCredentials({ accounts: [], activeToken: null })).toMatchObject({ ok: false, code: 'auth_required' });
  });
});

describe('terms', () => {
  const options: SemesterOption[] = [
    { id: 100, label: '2025-2026 第一学期', labelEn: '2025 Fall', schoolYear: 2025, semester: 1 },
    { id: 96, label: '2024-2025 第二学期', labelEn: '2025 Spring', schoolYear: 2024, semester: 2 },
  ];

  it('builds one key from either shape of school year', () => {
    expect(termKey('2025-2026', '1')).toBe('2025-2026-1');
    expect(termKey(2024, 2)).toBe('2024-2025-2');
    expect(termKey(undefined, '1')).toBe('');
  });

  it('accepts the key, either name, or the tag id', () => {
    expect(matchTerm('2025-2026-1', options)?.id).toBe(100);
    expect(matchTerm('2024-2025  第二学期', options)?.id).toBe(96);
    expect(matchTerm('2025 fall', options)?.id).toBe(100);
    expect(matchTerm('96', options)?.id).toBe(96);
    expect(matchTerm('2030-2031-1', options)).toBeNull();
  });
});

describe('format', () => {
  it('counts Chinese characters as two columns', () => {
    expect(displayWidth('泛函分析')).toBe(8);
    expect(table(['ID', 'Course', 'Term'], [['1', '泛函分析', 'x'], ['22', 'Calc', 'y']])).toBe(
      ['ID  Course    Term', '1   泛函分析  x', '22  Calc      y'].join('\n')
    );
  });

  it('drops placeholder and Chinese English titles, and unescapes the rest', () => {
    expect(englishTitle('待完善')).toBeNull();
    expect(englishTitle('泛函分析')).toBeNull();
    expect(englishTitle('Development &#97;nd Practice')).toBe('Development and Practice');
    expect(englishTitle('Literature Retrieval（English）')).toBe('Literature Retrieval（English）');
  });

  it('prints lengths as h:mm:ss', () => {
    expect(formatDuration(5720)).toBe('1:35:20');
    expect(formatDuration(2825)).toBe('47:05');
    expect(formatDuration(0)).toBe('');
  });
});

describe('help and schema', () => {
  const command: CliCommand = {
    summary: 'Show a course',
    args: '<course>',
    description: ['Line one.'],
    examples: ['course 1 | {program} download -'],
    options: [{ long: 'no-sessions', description: 'Skip the list' }],
    positionals: { min: 1, max: 1 },
    network: true,
    tokenUse: 'To list sessions',
    data: '{}',
    run: async () => ({ data: null }),
  };
  const quiet: CliCommand = { ...command, network: false, tokenUse: undefined, options: [] };
  const commands = { search: quiet, mine: quiet, course: command, session: quiet, download: quiet, terms: quiet, whoami: quiet, schema: quiet };

  it('lists the shared options a command takes, and only those', () => {
    const help = commandHelp('course', command, 'yhdl');
    expect(help).toContain('Usage: yhdl course <course> [options]');
    expect(help).toContain('yhdl course 1 | yhdl download -');
    for (const flag of ['--no-sessions', '--token', '--account', '--intranet', '--interface', '--json']) expect(help).toContain(flag);
    const plain = commandHelp('terms', quiet, 'yhdl');
    expect(plain).not.toContain('--token');
    expect(plain).not.toContain('--intranet');
  });

  it('describes every command for agents', () => {
    const schema = buildSchema(commands, 'yhdl', '5.1.0', 'terminal');
    expect(schema.commands.map((c) => c.name)).toEqual(Object.keys(commands));
    const course = schema.commands.find((c) => c.name === 'course')!;
    expect(course.token).toBe('To list sessions');
    expect(course.options.map((o) => o.name)).toContain('--token');
    expect(schema.commands.find((c) => c.name === 'terms')!.token).toBe('never');
    expect(schema.exit_codes.auth).toBe(4);
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
