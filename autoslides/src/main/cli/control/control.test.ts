import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cliDrivesApp } from '@common/cliCommands';
import type { AppCommand } from '../app/types';
import { CliError } from '../errors';
import type { CliContext } from '../types';
import { runInApp } from './client';
import { MAX_REQUEST_BYTES, PROTOCOL_VERSION, controlSocketPath, createLineReader, encodeLine, parseRequest, type ControlMessage } from './protocol';
import { CliControlServer } from './server';

vi.mock('@main/infra/logger', () => ({
  createLogger: () => ({ debug() {}, info() {}, warn() {}, error() {} }),
  setLoggerConsoleMode: () => {},
}));

describe('which wrappers drive the app', () => {
  it('is autoslides alone; yhdl and any future alias stay in the terminal', () => {
    expect(cliDrivesApp('autoslides')).toBe(true);
    expect(cliDrivesApp('yhdl')).toBe(false);
    expect(cliDrivesApp('yanhe')).toBe(false);
  });
});

describe('controlSocketPath', () => {
  it('puts the socket in the user data folder', () => {
    expect(controlSocketPath('/Users/a/Library/Application Support/AutoSlides', { platform: 'darwin' })).toBe(
      '/Users/a/Library/Application Support/AutoSlides/cli.sock'
    );
  });

  it('moves to the temp folder when the path is too long for a Unix socket', () => {
    const long = `/home/${'x'.repeat(120)}/.config/AutoSlides`;
    const socket = controlSocketPath(long, { platform: 'linux', tmpdir: '/tmp' });
    expect(socket).toMatch(/^\/tmp\/autoslides-cli-[0-9a-f]{16}\.sock$/);
    expect(controlSocketPath(long, { platform: 'linux', tmpdir: '/tmp' })).toBe(socket);
  });

  it('measures the limit in bytes, so a Chinese folder name moves it too', () => {
    // 40 characters, 120 bytes in UTF-8: short by length, too long for sun_path.
    const chinese = `/home/a/${'课'.repeat(40)}/AutoSlides`;
    expect(chinese.length).toBeLessThan(100);
    expect(controlSocketPath(chinese, { platform: 'linux', tmpdir: '/tmp' })).toMatch(/^\/tmp\/autoslides-cli-/);
  });

  it('is a named pipe per user data folder on Windows', () => {
    const a = controlSocketPath('C:\\Users\\a\\AppData\\Roaming\\AutoSlides', { platform: 'win32' });
    const demo = controlSocketPath('C:\\Users\\a\\AppData\\Roaming\\AutoSlides-Demo', { platform: 'win32' });
    expect(a).toMatch(/^\\\\\.\\pipe\\autoslides-cli-[0-9a-f]{16}$/);
    expect(demo).not.toBe(a);
  });

  it('gives a dev build its own, beside the installed app\'s', () => {
    const userData = '/Users/a/Library/Application Support/AutoSlides';
    expect(controlSocketPath(userData, { platform: 'darwin', dev: true })).toBe(`${userData}/cli-dev.sock`);
  });
});

describe('protocol', () => {
  const request = { v: PROTOCOL_VERSION, command: 'search', program: 'autoslides', positionals: ['微积分'], options: { page: '2' }, json: true, tty: false };

  it('reads a request line', () => {
    expect(parseRequest(JSON.stringify(request))).toEqual(request);
  });

  it('refuses what is not a request of this version', () => {
    expect(parseRequest('nope')).toBeNull();
    expect(parseRequest(JSON.stringify({ ...request, v: 99 }))).toBeNull();
    expect(parseRequest(JSON.stringify({ ...request, positionals: [1] }))).toBeNull();
    expect(parseRequest(JSON.stringify({ ...request, options: { page: 2 } }))).toBeNull();
  });

  it('splits chunks into lines', () => {
    const lines: string[] = [];
    const read = createLineReader((line) => lines.push(line));
    expect(read('{"a":1}\n{"b"')).toBe(4);
    read(':2}\n\n');
    expect(lines).toEqual(['{"a":1}', '{"b":2}']);
  });

  it('keeps Chinese and emoji whole however the bytes are split', () => {
    const text = JSON.stringify({ q: '合成课程📘' });
    const lines: string[] = [];
    const read = createLineReader((line) => lines.push(line));
    for (const byte of Buffer.from(`${text}\n${text}\n`)) read(Buffer.from([byte]));
    expect(lines).toEqual([text, text]);
  });

  it('never delivers half a character left at the end of a connection', () => {
    const lines: string[] = [];
    const read = createLineReader((line) => lines.push(line));
    expect(read(Buffer.from('课').subarray(0, 2))).toBe(2);
    expect(lines).toEqual([]);
  });

  describe('with a line limit', () => {
    const reader = (max: number) => {
      const lines: string[] = [];
      let overflows = 0;
      const read = createLineReader((line) => lines.push(line), { maxLineBytes: max, onOverflow: () => overflows++ });
      return { lines, read, overflows: () => overflows };
    };

    it('refuses a whole line over the limit before handing it over', () => {
      const r = reader(MAX_REQUEST_BYTES);
      r.read(Buffer.from(`${'x'.repeat(MAX_REQUEST_BYTES + 1)}\n`));
      expect(r.lines).toEqual([]);
      expect(r.overflows()).toBe(1);
    });

    it('takes a line of exactly the limit', () => {
      const r = reader(16);
      r.read(`${'x'.repeat(16)}\n`);
      expect(r.lines).toEqual(['x'.repeat(16)]);
      expect(r.overflows()).toBe(0);
    });

    it('counts bytes, not characters', () => {
      const r = reader(16);
      // 6 characters, 18 bytes.
      r.read(`${'课'.repeat(6)}\n`);
      expect(r.lines).toEqual([]);
      expect(r.overflows()).toBe(1);
    });

    it('refuses an unfinished line once it passes the limit, across chunks', () => {
      const r = reader(16);
      r.read('x'.repeat(10));
      expect(r.overflows()).toBe(0);
      r.read('x'.repeat(7));
      expect(r.overflows()).toBe(1);
      // Nothing after that is read.
      r.read('\n{"a":1}\n');
      expect(r.lines).toEqual([]);
      expect(r.overflows()).toBe(1);
    });

    it('is not filled up by blank lines', () => {
      const r = reader(16);
      r.read('\n'.repeat(1000));
      r.read('{"a":1}\n');
      expect(r.lines).toEqual(['{"a":1}']);
      expect(r.overflows()).toBe(0);
    });
  });
});

describe('a command sent to the app', () => {
  let dir: string;
  let socketPath: string;
  let server: CliControlServer;
  let allow: boolean;
  let stdout: string[];
  let stderr: string[];
  let interruptHandler: (() => void) | null;
  let served: number;

  const echo: AppCommand = {
    summary: '',
    args: '',
    description: [],
    examples: [],
    options: [
      { long: 'page', value: 'n', description: '' },
      { long: 'stream', value: 'stream', choices: ['screen', 'camera'], description: '' },
      { long: 'force', description: '' },
    ],
    positionals: { min: 0, max: 3 },
    data: '',
    dataSchema: { type: 'object' },
    serve: async (input, ctx) => {
      served += 1;
      ctx.term.info('working');
      if (!input.json) ctx.term.out('/out/file.mp4');
      if (input.positionals[0] === 'fail') throw new CliError('sign_in_required', 'not signed in', 'Sign in.');
      if (input.positionals[0] === 'hang') await new Promise((resolve) => ctx.signal.addEventListener('abort', resolve));
      return { data: { got: input.positionals, options: input.options }, text: 'table' };
    },
  };

  const ctx = (): CliContext =>
    ({
      version: 'test',
      configService: { getConfig: () => ({ allowCliControl: allow }) },
      controlSocketPath: socketPath,
      launchApp: () => false,
      onInterrupt: (handler: () => void) => {
        interruptHandler = handler;
        return () => {
          interruptHandler = null;
        };
      },
    }) as unknown as CliContext;

  const input = (positionals: string[], json = false) => ({ program: 'autoslides', positionals, options: { json: true as const, page: '2' }, json });

  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'as-cli-'));
    socketPath = controlSocketPath(dir);
    allow = true;
    stdout = [];
    stderr = [];
    interruptHandler = null;
    served = 0;
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => (stdout.push(String(chunk)), true));
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => (stderr.push(String(chunk)), true));
    server = new CliControlServer({
      socketPath,
      configService: { getConfig: () => ({ allowCliControl: allow }) } as never,
      settings: {} as never,
      apiClient: {} as never,
      courseLookup: {} as never,
      enrolledCoursesService: {} as never,
      renderer: {} as never,
      commands: { echo },
      version: 'test',
    });
    server.applyConfig();
    for (let i = 0; i < 50 && !fs.existsSync(socketPath) && process.platform !== 'win32'; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  });

  afterEach(() => {
    server.stop();
    vi.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('runs in the app and relays its output and answer', async () => {
    const result = await runInApp('echo', input(['a', 'b']), ctx());
    expect(result.error).toBeUndefined();
    // The client keeps --json for itself; the rest is sent.
    expect(result.data).toEqual({ got: ['a', 'b'], options: { page: '2' } });
    expect(result.text).toBe('table');
    expect(stdout.join('')).toBe('/out/file.mp4\n');
    expect(stderr.join('')).toContain('working');
    if (process.platform !== 'win32') expect(fs.statSync(socketPath).mode & 0o777).toBe(0o600);
  });

  it('brings back a failure with its code and hint', async () => {
    const result = await runInApp('echo', input(['fail'], true), ctx());
    expect(result.error?.code).toBe('sign_in_required');
    expect(result.error?.hint).toBe('Sign in.');
    expect(stdout).toEqual([]);
  });

  it('refuses without starting the app when control is off', async () => {
    allow = false;
    await expect(runInApp('echo', input([]), ctx())).rejects.toMatchObject({ code: 'cli_control_disabled' });
  });

  it('says the app is not running when nothing listens and it cannot be started', async () => {
    server.stop();
    await expect(runInApp('echo', input([]), ctx())).rejects.toMatchObject({ code: 'app_not_running' });
  });

  it('does not stay open when the socket cannot be made private', async () => {
    if (process.platform === 'win32') return;
    server.stop();
    const chmod = vi.spyOn(fs, 'chmodSync').mockImplementation(() => {
      throw new Error('EPERM');
    });
    server.applyConfig();
    await new Promise((resolve) => setTimeout(resolve, 50));
    chmod.mockRestore();
    await expect(runInApp('echo', input([]), ctx())).rejects.toMatchObject({ code: 'app_not_running' });
  });

  it('creates the socket private, with no window before the chmod', async () => {
    if (process.platform === 'win32') return;
    server.stop();
    const modes: number[] = [];
    const chmod = vi.spyOn(fs, 'chmodSync').mockImplementation((target) => {
      modes.push(fs.statSync(target).mode & 0o777);
    });
    server.applyConfig();
    for (let i = 0; i < 50 && modes.length === 0; i++) await new Promise((resolve) => setTimeout(resolve, 10));
    chmod.mockRestore();
    expect(modes).toEqual([0o600]);
  });

  it('stops listening when the setting is turned off', async () => {
    allow = false;
    server.applyConfig();
    allow = true;
    await expect(runInApp('echo', input([]), ctx())).rejects.toMatchObject({ code: 'app_not_running' });
  });

  it('stops waiting on Ctrl-C and tells the app', async () => {
    const pending = runInApp('echo', input(['hang']), ctx());
    for (let i = 0; i < 50 && !interruptHandler; i++) await new Promise((resolve) => setTimeout(resolve, 10));
    await new Promise((resolve) => setTimeout(resolve, 50));
    interruptHandler!();
    const result = await pending;
    expect(result.error?.code).toBe('interrupted');
  });

  /** Talk to the socket directly, as something other than the wrapper could. */
  const sendRaw = (chunks: Array<Buffer | string>): Promise<ControlMessage[]> =>
    new Promise((resolve, reject) => {
      const messages: ControlMessage[] = [];
      const read = createLineReader((line) => messages.push(JSON.parse(line) as ControlMessage));
      const socket = net.createConnection(socketPath);
      socket.on('data', read);
      socket.on('error', reject);
      socket.on('close', () => resolve(messages));
      socket.on('connect', () => {
        // A refused request may close the connection while the rest is still being written.
        for (const chunk of chunks) if (!socket.destroyed) socket.write(chunk);
      });
    });

  const request = (over: Record<string, unknown> = {}) => ({
    v: PROTOCOL_VERSION,
    command: 'echo',
    program: 'autoslides',
    positionals: [] as string[],
    options: {},
    json: true,
    tty: false,
    ...over,
  });

  const resultOf = (messages: ControlMessage[]) => {
    const results = messages.filter((m) => m.type === 'result');
    expect(results).toHaveLength(1);
    return results[0] as Extract<ControlMessage, { type: 'result' }>;
  };

  it('refuses a command from another version of AutoSlides, without running it', async () => {
    const result = resultOf(await sendRaw([encodeLine(request({ appVersion: '9.9.9' }))]));
    expect(result.error?.code).toBe('app_version_mismatch');
    expect(result.error?.message).toContain('9.9.9');
    expect(result.error?.message).toContain('test');
    expect(served).toBe(0);
  });

  it('sends its own version, which the same app accepts', async () => {
    const result = await runInApp('echo', input(['a']), ctx());
    expect(result.error).toBeUndefined();
  });

  it('still serves a request that names no version (an older command)', async () => {
    const result = resultOf(await sendRaw([encodeLine(request())]));
    expect(result.error).toBeUndefined();
  });

  it('reads a request whose Chinese arrives split between chunks', async () => {
    const bytes = Buffer.from(encodeLine(request({ positionals: ['合成课程📘'] })));
    const result = resultOf(await sendRaw([...bytes].map((byte) => Buffer.from([byte]))));
    expect(result.data).toEqual({ got: ['合成课程📘'], options: {} });
  });

  it('refuses an option the command does not take, without running it', async () => {
    const wrong: Array<Record<string, string | true>> = [
      { output: '/tmp' },
      { page: true },
      { force: 'yes' },
      { stream: 'both' },
      { page: '' },
    ];
    for (const options of wrong) {
      const result = resultOf(await sendRaw([encodeLine(request({ options }))]));
      expect(result.error?.code, JSON.stringify(options)).toBe('usage');
    }
    expect(served).toBe(0);
  });

  it('refuses more arguments than the command takes, without running it', async () => {
    const result = resultOf(await sendRaw([encodeLine(request({ positionals: ['a', 'b', 'c', 'd'] }))]));
    expect(result.error?.code).toBe('usage');
    expect(served).toBe(0);
  });

  it('refuses a request over the size limit, without running it', async () => {
    const line = encodeLine(request({ positionals: ['x'.repeat(MAX_REQUEST_BYTES)] }));
    const result = resultOf(await sendRaw([line]));
    expect(result.error?.code).toBe('usage');
    expect(result.error?.message).toMatch(/too large/);
    expect(served).toBe(0);
  });

  it('runs only the first request of a connection', async () => {
    const result = resultOf(await sendRaw([encodeLine(request({ positionals: ['a'] })) + encodeLine(request({ positionals: ['b'] }))]));
    expect(result.data).toEqual({ got: ['a'], options: {} });
    expect(served).toBe(1);
  });
});

describe('autoslides on the command line', () => {
  const run = async (args: string[], program = 'autoslides'): Promise<{ code: number; stdout: string }> => {
    const { runCli, parseCliInvocation } = await import('../index');
    const written: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => (written.push(String(chunk)), true));
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      const code = await runCli(parseCliInvocation(['exe', `--cli=${program}`, '--', ...args])!, { version: '5.1.0' } as never);
      return { code, stdout: written.join('') };
    } finally {
      vi.restoreAllMocks();
    }
  };

  it('describes only what runs in the app, without the terminal-only flags', async () => {
    const { code, stdout } = await run(['schema']);
    expect(code).toBe(0);
    const schema = JSON.parse(stdout);
    expect(schema.runs_in).toBe('the AutoSlides app');
    expect(schema.commands.map((c: { name: string }) => c.name)).toEqual(['search', 'mine', 'course', 'session', 'download', 'downloads', 'terms', 'whoami', 'config', 'schema']);
    for (const command of schema.commands) {
      const names = command.options.map((o: { name: string }) => o.name);
      expect(names).not.toContain('--token');
      expect(names).not.toContain('--account');
    }
    const download = schema.commands.find((c: { name: string }) => c.name === 'download');
    const flags = download.options.map((o: { name: string }) => o.name);
    expect(flags).toContain('--no-wait');
    for (const flag of ['--intranet', '--interface', '--token', '--account', '--output', '--verbose']) expect(flags).not.toContain(flag);
    expect(download.token).toBe("the app's signed-in account");
    expect(schema.error_codes.sign_in_required.exit).toBe(4);
    expect(schema.exit_codes.appUnavailable).toBe(6);
  });

  it('sends yhdl to autoslides for the Download panel, which only the app has', async () => {
    const { code, stdout } = await run(['downloads', '--json'], 'yhdl');
    expect(code).toBe(2);
    const { error } = JSON.parse(stdout);
    expect(error.message).toBe('downloads needs the AutoSlides app');
    expect(error.hint).toBe("'autoslides downloads' runs it there.");
  });

  it('takes no flag to choose an account: the app\'s sign-in is the only one', async () => {
    const { code, stdout } = await run(['course', '70101', '--token', '0123456789abcdef0123456789abcdef', '--json']);
    expect(code).toBe(2);
    expect(JSON.parse(stdout).error.message).toBe('unknown option: --token');
  });
});

describe('RendererBridge requests and a client that leaves', () => {
  it('ends a request still waiting for the window when its signal aborts', async () => {
    const { RendererBridge } = await import('./rendererBridge');
    const bridge = new RendererBridge(() => null, () => {});
    const abort = new AbortController();
    const asked = bridge.request('signInState', {} as never, abort.signal).then(
      () => 'answered',
      (error: { code?: string }) => error.code,
    );
    abort.abort();
    expect(await asked).toBe('interrupted');
  });

  it('refuses at once when the signal is already aborted, and opens no window', async () => {
    const { RendererBridge } = await import('./rendererBridge');
    const openWindow = vi.fn();
    const bridge = new RendererBridge(() => null, openWindow);
    const abort = new AbortController();
    abort.abort();
    await expect(bridge.request('signInState', {} as never, abort.signal)).rejects.toMatchObject({ code: 'interrupted' });
    expect(openWindow).not.toHaveBeenCalled();
  });
});
