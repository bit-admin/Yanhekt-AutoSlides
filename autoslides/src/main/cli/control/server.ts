// The running app's end of `autoslides`: a local socket that takes one command
// per connection and runs it here, under the app's settings and sign-in.
//
// Listens only while Settings → Add-ons → Command Line → Allow command-line
// control is on (`allowCliControl`). Only this user can connect: a Unix socket
// in the user data folder with mode 0600, or a named pipe on Windows. The app
// holds the single-instance lock before this starts, so a socket file left
// behind by a crash is safe to replace.
import fs from 'node:fs';
import net from 'node:net';
import type { ApiClient } from '@main/platform/apiClient';
import type { CourseLookup } from '@main/platform/courseIndex/courseLookup';
import type { ConfigService } from '@main/platform/configService';
import type { EnrolledCoursesService } from '@main/platform/enrolled/enrolledCoursesService';
import { createLogger } from '@main/infra/logger';
import type { AppCommand, AppCommandContext, AppSettingsWriter } from '../app/types';
import { toCliError } from '../classifyError';
import { CliError } from '../errors';
import type { CommandInput } from '../types';
import { MAX_REQUEST_BYTES, createLineReader, encodeLine, parseRequest, type ControlMessage } from './protocol';
import type { RendererBridge } from './rendererBridge';

const log = createLogger('CliControl');

export interface CliControlServerDeps {
  socketPath: string;
  configService: ConfigService;
  settings: AppSettingsWriter;
  apiClient: ApiClient;
  courseLookup: CourseLookup;
  enrolledCoursesService: EnrolledCoursesService;
  renderer: RendererBridge;
  commands: Readonly<Record<string, AppCommand>>;
}

export class CliControlServer {
  private server: net.Server | null = null;
  private connections = new Set<net.Socket>();

  constructor(private readonly deps: CliControlServerDeps) {}

  /** Start or stop listening to match the setting. Call at launch and whenever it changes. */
  applyConfig(): void {
    const wanted = this.deps.configService.getConfig().allowCliControl !== false;
    if (wanted && !this.server) this.start();
    else if (!wanted && this.server) this.stop();
  }

  private start(): void {
    const { socketPath } = this.deps;
    const isPipe = process.platform === 'win32';
    if (!isPipe) fs.rmSync(socketPath, { force: true });

    const server = net.createServer((socket) => this.handle(socket));
    server.on('error', (error) => {
      log.error('Command-line control socket failed:', error);
      if (this.server === server) this.server = null;
    });
    server.listen(socketPath, () => {
      if (!isPipe) {
        try {
          fs.chmodSync(socketPath, 0o600);
        } catch (error) {
          log.warn('Could not restrict the command-line control socket:', error);
        }
      }
      log.info(`Command-line control listening on ${socketPath}`);
    });
    this.server = server;
  }

  stop(): void {
    const server = this.server;
    if (!server) return;
    this.server = null;
    server.close();
    for (const socket of this.connections) {
      this.send(socket, {
        type: 'result',
        error: new CliError('cli_control_disabled', 'command-line control was turned off in AutoSlides').toJSON(),
      });
      socket.end();
    }
    this.connections.clear();
    if (process.platform !== 'win32') fs.rmSync(this.deps.socketPath, { force: true });
  }

  private send(socket: net.Socket, message: ControlMessage): void {
    if (!socket.destroyed && socket.writable) socket.write(encodeLine(message));
  }

  private handle(socket: net.Socket): void {
    this.connections.add(socket);
    const abort = new AbortController();
    let started = false;

    const read = createLineReader((line) => {
      if (started) return;
      started = true;
      void this.run(socket, line, abort.signal).finally(() => {
        this.connections.delete(socket);
        socket.end();
      });
    });
    socket.on('data', (chunk) => {
      if (read(chunk) > MAX_REQUEST_BYTES) socket.destroy();
    });
    socket.on('error', (error) => log.debug('Command-line control connection error:', error));
    socket.on('close', () => {
      this.connections.delete(socket);
      abort.abort();
    });
  }

  private async run(socket: net.Socket, line: string, signal: AbortSignal): Promise<void> {
    const request = parseRequest(line);
    if (!request) {
      const error = new CliError('usage', 'AutoSlides did not understand the request', 'The command and the app may be from different versions; reinstall the commands in Settings > Add-ons.');
      this.send(socket, { type: 'result', error: error.toJSON() });
      return;
    }
    const command = this.deps.commands[request.command];
    if (!command) {
      this.send(socket, { type: 'result', error: new CliError('usage', `unknown command: ${request.command}`).toJSON() });
      return;
    }

    const ctx: AppCommandContext = {
      configService: this.deps.configService,
      settings: this.deps.settings,
      apiClient: this.deps.apiClient,
      courseLookup: this.deps.courseLookup,
      enrolledCoursesService: this.deps.enrolledCoursesService,
      renderer: this.deps.renderer,
      signal,
      term: {
        info: (text) => this.send(socket, { type: 'info', text }),
        status: (text) => {
          if (request.tty) this.send(socket, { type: 'status', text });
        },
        endStatusLine: () => {
          if (request.tty) this.send(socket, { type: 'end-status' });
        },
        out: (text) => this.send(socket, { type: 'out', text }),
      },
    };
    const input: CommandInput = {
      program: request.program,
      positionals: request.positionals,
      options: request.options,
      json: request.json,
    };

    log.info(`Command-line control: ${request.command}`);
    try {
      const result = await command.serve(input, ctx);
      this.send(socket, {
        type: 'result',
        data: result.data,
        text: result.text,
        hints: result.hints,
        error: result.error?.toJSON(),
      });
    } catch (error) {
      this.send(socket, { type: 'result', error: toCliError(error).toJSON() });
    }
  }
}
