import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cliDrivesApp } from '@common/cliCommands';
import type { AppCommand } from '../app/types';
import { CliError } from '../errors';
import type { CliContext } from '../types';
import { runInApp } from './client';
import { PROTOCOL_VERSION, controlSocketPath, createLineReader, parseRequest } from './protocol';
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
});

describe('a command sent to the app', () => {
  let dir: string;
  let socketPath: string;
  let server: CliControlServer;
  let allow: boolean;
  let stdout: string[];
  let stderr: string[];
  let interruptHandler: (() => void) | null;

  const echo: AppCommand = {
    summary: '',
    args: '',
    description: [],
    examples: [],
    options: [],
    positionals: { min: 0, max: Infinity },
    data: '',
    serve: async (input, ctx) => {
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
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => (stdout.push(String(chunk)), true));
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => (stderr.push(String(chunk)), true));
    server = new CliControlServer({
      socketPath,
      configService: { getConfig: () => ({ allowCliControl: allow }) } as never,
      settings: {} as never,
      apiClient: {} as never,
      courseLookup: {} as never,
      renderer: {} as never,
      commands: { echo },
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
