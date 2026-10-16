// The `autoslides` process's end: send one command to the running app, show
// what it reports, and hand back its answer.
//
// When nothing listens, the app is started and given a while to come up. With
// command-line control turned off it is not started at all: the setting is
// read from the app's saved config first.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import { CliError } from '../errors';
import { endStatusLine, info, out, status } from '../terminal';
import type { CliContext, CommandInput, CommandResult } from '../types';
import { PROTOCOL_VERSION, createLineReader, encodeLine, type ControlMessage, type ControlRequest } from './protocol';

const LAUNCH_TIMEOUT_MS = 30_000;
const RETRY_MS = 250;

/** Options the client handles itself and never sends. */
const CLIENT_OPTIONS = new Set(['json', 'help']);

const isNotListening = (error: NodeJS.ErrnoException): boolean =>
  error.code === 'ENOENT' || error.code === 'ECONNREFUSED';

function connect(socketPath: string): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    socket.once('connect', () => {
      socket.removeAllListeners('error');
      resolve(socket);
    });
    socket.once('error', reject);
  });
}

async function connectOrLaunch(ctx: CliContext): Promise<net.Socket> {
  try {
    return await connect(ctx.controlSocketPath);
  } catch (error) {
    if (!isNotListening(error as NodeJS.ErrnoException)) throw error;
  }

  if (!ctx.launchApp()) {
    throw new CliError('app_not_running', 'AutoSlides is not running', 'Start AutoSlides, then run the command again.');
  }
  info('Starting AutoSlides…');
  const deadline = Date.now() + LAUNCH_TIMEOUT_MS;
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
    try {
      return await connect(ctx.controlSocketPath);
    } catch (error) {
      if (!isNotListening(error as NodeJS.ErrnoException)) throw error;
      if (Date.now() > deadline) {
        throw new CliError('app_not_running', 'AutoSlides did not answer after starting', 'Open AutoSlides, then run the command again.');
      }
    }
  }
}

/** `-` among the arguments: the ids come from this process's stdin, which the app cannot read. */
async function expandStdin(positionals: string[]): Promise<string[]> {
  if (!positionals.includes('-')) return positionals;
  if (process.stdin.isTTY) throw new CliError('usage', '"-" reads session ids from stdin, but stdin is a terminal');
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  const words = Buffer.concat(chunks).toString('utf8').split(/[\s,]+/).filter(Boolean);
  if (words.length === 0) throw new CliError('usage', 'no session ids on stdin');
  return [...positionals.filter((p) => p !== '-'), ...words];
}

export async function runInApp(command: string, input: CommandInput, ctx: CliContext): Promise<CommandResult> {
  if (ctx.configService.getConfig().allowCliControl === false) {
    throw new CliError(
      'cli_control_disabled',
      'command-line control is turned off in AutoSlides',
      `Turn on Allow Command-Line Control in Settings > Add-ons > Command Line, or use 'yhdl ${command}', which runs in the terminal.`
    );
  }

  const request: ControlRequest = {
    v: PROTOCOL_VERSION,
    command,
    program: input.program,
    positionals: await expandStdin(input.positionals),
    options: Object.fromEntries(Object.entries(input.options).filter(([key]) => !CLIENT_OPTIONS.has(key))),
    json: input.json,
    tty: process.stderr.isTTY === true,
  };

  const socket = await connectOrLaunch(ctx);
  return new Promise<CommandResult>((resolve, reject) => {
    let settled = false;
    const finish = (result: CommandResult | Error): void => {
      if (settled) return;
      settled = true;
      stopListening();
      endStatusLine();
      if (result instanceof Error) reject(result);
      else resolve(result);
    };

    // Ctrl-C stops waiting, not the work: what the app queued stays queued.
    const stopListening = ctx.onInterrupt(() => {
      socket.destroy();
      finish({
        data: undefined,
        error: new CliError('interrupted', 'stopped waiting', 'Anything already queued keeps going in AutoSlides.'),
      });
    });

    const read = createLineReader((line) => {
      let message: ControlMessage;
      try {
        message = JSON.parse(line) as ControlMessage;
      } catch {
        return;
      }
      switch (message.type) {
        case 'info':
          info(message.text);
          break;
        case 'status':
          status(message.text);
          break;
        case 'end-status':
          endStatusLine();
          break;
        case 'out':
          out(message.text);
          break;
        case 'result': {
          const error = message.error ? new CliError(message.error.code, message.error.message, message.error.hint) : undefined;
          finish({ data: message.data, text: message.text, hints: message.hints, error });
          break;
        }
      }
    });
    socket.on('data', read);
    socket.on('error', (error) => finish(new CliError('app_not_running', `lost the connection to AutoSlides (${error.message})`)));
    socket.on('close', () => finish(new CliError('app_not_running', 'AutoSlides closed the connection without an answer')));
    socket.write(encodeLine(request));
  });
}

/**
 * Start the app in the background, detached from this process. Not from a dev
 * build, whose executable is the bare Electron binary.
 */
export function launchApp(isPackaged: boolean): boolean {
  if (!isPackaged) return false;
  // An AppImage's executable lives in a mount that goes away with this process.
  const exe = process.env.APPIMAGE || process.execPath;
  if (!fs.existsSync(exe)) return false;
  const child = spawn(exe, [], { detached: true, stdio: 'ignore' });
  child.unref();
  return true;
}
