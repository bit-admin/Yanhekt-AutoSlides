// Command line entry: dispatch one invocation to its command.
//
// Reached from `main.ts` when the process was started by a wrapper (see
// `invocation.ts`); no window, IPC or menu exists in such a run. Commands are
// registered in `COMMANDS` — typed by `CliCommandId`, so an id added to
// `@common/cliCommands` fails to compile until it has an implementation.
import { CLI_UMBRELLA_NAME, type CliCommandId } from '@common/cliCommands';
import { setLoggerConsoleMode } from '@main/infra/logger';
import { downloadHelp, runDownload } from './commands/download';
import type { CliInvocation } from './invocation';
import { EXIT, fail, info, out } from './terminal';
import type { CliCommand, CliContext } from './types';

export { parseCliInvocation, type CliInvocation } from './invocation';
export { createCliInterrupts } from './interrupts';
export { EXIT as CLI_EXIT } from './terminal';
export type { CliContext } from './types';

const COMMANDS: Record<CliCommandId, CliCommand> = {
  download: {
    summary: 'Download a recorded Yanhekt lecture',
    help: downloadHelp,
    run: runDownload,
  },
};

function umbrellaHelp(): string {
  const names = Object.keys(COMMANDS) as CliCommandId[];
  const width = Math.max(...names.map((name) => name.length));
  return [
    `Usage: ${CLI_UMBRELLA_NAME} <command> [options]`,
    '',
    'Commands:',
    ...names.map((name) => `  ${name.padEnd(width)}  ${COMMANDS[name].summary}`),
    '',
    `Run '${CLI_UMBRELLA_NAME} <command> --help' for a command's options.`,
    `Run '${CLI_UMBRELLA_NAME}' with no arguments to open the app.`,
  ].join('\n');
}

export async function runCli(invocation: CliInvocation, ctx: CliContext): Promise<number> {
  // The terminal belongs to the command; service logs appear only with --verbose.
  setLoggerConsoleMode('silent');

  if (invocation.command) {
    try {
      return await COMMANDS[invocation.command].run(invocation.args, ctx);
    } catch (error) {
      fail(invocation.command, error instanceof Error ? error.message : String(error));
      return EXIT.failed;
    }
  }

  if (invocation.commandWord === 'help') {
    out(umbrellaHelp());
    return EXIT.ok;
  }

  if (invocation.commandWord !== undefined) {
    fail(CLI_UMBRELLA_NAME, `unknown command: ${invocation.commandWord}`);
    info(`Try '${CLI_UMBRELLA_NAME} --help'.`);
    return EXIT.usage;
  }

  const flag = invocation.args[0];
  if (flag === '-V' || flag === '--version') {
    out(ctx.version);
    return EXIT.ok;
  }
  if (flag === undefined || flag === '-h' || flag === '--help') {
    out(umbrellaHelp());
    return EXIT.ok;
  }
  fail(CLI_UMBRELLA_NAME, `unknown option: ${flag}`);
  info(`Try '${CLI_UMBRELLA_NAME} --help'.`);
  return EXIT.usage;
}
