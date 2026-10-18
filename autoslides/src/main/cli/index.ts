// Command line entry: dispatch one invocation to its command.
//
// Reached from `main.ts` when the process was started by a wrapper (see
// `invocation.ts`); no window, IPC or menu exists in such a run. The wrapper
// decides which table answers (`@common/cliCommands`): `yhdl` runs `COMMANDS`
// here, `autoslides` sends `APP_COMMANDS` to the running app over its socket
// (`control/client.ts`). Both tables are typed by their id lists, so an id
// added there fails to compile until it has an implementation.
//
// Every command answers the same way: a result (or a thrown error) becomes
// either text on stdout, or with `--json` exactly one JSON object.
import { CLI_APP_PROGRAM, cliDrivesApp, type CliAppCommandId, type CliCommandId } from '@common/cliCommands';
import { setLoggerConsoleMode } from '@main/infra/logger';
import { APP_COMMANDS, type AppCommand } from './app';
import { parseArgs } from './args';
import { toCliError } from './classifyError';
import { courseCommand } from './commands/course';
import { downloadCommand } from './commands/download';
import { mineCommand } from './commands/mine';
import { searchCommand } from './commands/search';
import { sessionCommand } from './commands/session';
import { termsCommand } from './commands/terms';
import { whoamiCommand } from './commands/whoami';
import { runInApp } from './control/client';
import { CliError, EXIT } from './errors';
import { buildSchema, commandHelp, commandOptions, programHelp, type CliMode } from './help';
import type { CliInvocation } from './invocation';
import { pinRoute } from './route';
import { fail, info, out, separate } from './terminal';
import type { CliCommand, CliContext, CommandResult } from './types';

export { parseCliInvocation, type CliInvocation } from './invocation';
export { createCliInterrupts } from './interrupts';
export { APP_COMMANDS } from './app';
export { CliControlServer } from './control/server';
export { RendererBridge } from './control/rendererBridge';
export { controlSocketPath } from './control/protocol';
export { launchApp } from './control/client';
export { EXIT as CLI_EXIT } from './errors';
export type { CliContext } from './types';

function schemaCommand(mode: CliMode): CliCommand {
  return {
    summary: 'Describe every command, option, exit code and JSON shape, as JSON',
    args: '',
    description: ['Print a description of this command line as JSON, for scripts and AI agents.'],
    examples: ['schema'],
    options: [],
    positionals: { min: 0, max: 0 },
    network: false,
    data: 'This document',
    run: async (input, ctx) => {
      const schema = buildSchema(TABLES[mode], input.program, ctx.version, mode);
      return { data: schema, text: JSON.stringify(schema, null, 2) };
    },
  };
}

const COMMANDS: Record<CliCommandId, CliCommand> = {
  search: searchCommand,
  mine: mineCommand,
  course: courseCommand,
  session: sessionCommand,
  download: downloadCommand,
  terms: termsCommand,
  whoami: whoamiCommand,
  schema: schemaCommand('terminal'),
};

/** The terminal end of an app command: parsed and described here, run in the app. */
function sentToApp(id: string, command: AppCommand): CliCommand {
  const { serve: _serve, ...spec } = command;
  return { ...spec, network: false, runsInApp: true, run: (input, ctx) => runInApp(id, input, ctx) };
}

const CLIENT_APP_COMMANDS: Record<CliAppCommandId, CliCommand> = {
  ...(Object.fromEntries(Object.entries(APP_COMMANDS).map(([id, command]) => [id, sentToApp(id, command)])) as Record<
    keyof typeof APP_COMMANDS,
    CliCommand
  >),
  schema: schemaCommand('app'),
};

const TABLES: Record<CliMode, Readonly<Record<string, CliCommand>>> = {
  terminal: COMMANDS,
  app: CLIENT_APP_COMMANDS,
};

const modeOf = (program: string): CliMode => (cliDrivesApp(program) ? 'app' : 'terminal');

function report(program: string, json: boolean, result: CommandResult): number {
  const { data, error } = result;
  if (json) {
    out(JSON.stringify(error ? { ok: false, error: error.toJSON(), data } : { ok: true, data }));
  } else {
    if (result.text) {
      separate();
      out(result.text);
      if (result.hints?.length) {
        process.stderr.write('\n');
        result.hints.forEach(info);
      }
    }
    if (error) {
      fail(program, error.message);
      if (error.hint) info(error.hint);
    }
  }
  return error ? error.exit : EXIT.ok;
}

function reportError(program: string, json: boolean, error: CliError, helpTopic?: string): number {
  if (json) {
    out(JSON.stringify({ ok: false, error: error.toJSON() }));
  } else {
    fail(program, error.message);
    if (error.hint) info(error.hint);
    else if (error.code === 'usage') info(`Try '${program} ${helpTopic ? `${helpTopic} ` : ''}--help'.`);
  }
  return error.exit;
}

function unknownWordHint(word: string, program: string): string {
  if (/^\d+$/.test(word)) {
    return `A number can be a session or a course id, so say which: '${program} download ${word}', '${program} session ${word}' or '${program} course ${word}'.`;
  }
  return `Run '${program} --help' for the commands.`;
}

async function runCommand(
  id: string,
  args: readonly string[],
  program: string,
  ctx: CliContext
): Promise<number> {
  // Known before parsing, so even a usage error answers in JSON.
  const json = args.includes('--json');
  const mode = modeOf(program);
  const command = TABLES[mode][id];
  if (!command) {
    // A terminal command the app wrapper does not take yet, or an app-only one.
    const error =
      mode === 'app'
        ? new CliError('usage', `${id} is not an ${program} command yet`, `'yhdl ${id}' runs it in the terminal, without the app.`)
        : new CliError('usage', `${id} needs the AutoSlides app`, `'${CLI_APP_PROGRAM} ${id}' runs it there.`);
    return reportError(program, json, error);
  }

  const parsed = parseArgs(args, commandOptions(command));
  if (!parsed.ok) return reportError(program, json, new CliError('usage', parsed.message), id);
  const { positionals, options } = parsed.parsed;

  if (options.help === true) {
    out(commandHelp(id, command, program));
    return EXIT.ok;
  }
  if (options.verbose === true) ctx.setVerbose();

  try {
    if (positionals.length > command.positionals.max) {
      throw new CliError('usage', command.positionals.max === 0 ? `${id} takes no arguments` : `too many arguments: ${positionals.join(' ')}`);
    }
    if (positionals.length < command.positionals.min) {
      throw new CliError('usage', `missing ${command.args}`);
    }
    if (command.network) {
      // Only intranet traffic is ever bound to an interface, in the app as here.
      if (options.interface !== undefined && options.intranet !== true) {
        throw new CliError('usage', '--interface only applies together with --intranet');
      }
      await pinRoute(
        { intranet: options.intranet === true, interface: typeof options.interface === 'string' ? options.interface : undefined },
        ctx
      );
    }
    const result = await command.run({ program, positionals, options, json }, ctx);
    return report(program, json, result);
  } catch (error) {
    return reportError(program, json, toCliError(error), id);
  }
}

export async function runCli(invocation: CliInvocation, ctx: CliContext): Promise<number> {
  // The terminal belongs to the command; service logs appear only with --verbose.
  setLoggerConsoleMode('silent');
  const { program } = invocation;
  const mode = modeOf(program);
  const table = TABLES[mode];

  if (invocation.command) return runCommand(invocation.command, invocation.args, program, ctx);

  const word = invocation.commandWord;
  if (word === 'help') {
    const topic = invocation.args[0];
    if (topic && table[topic]) out(commandHelp(topic, table[topic], program));
    else out(programHelp(table, program, mode));
    return EXIT.ok;
  }

  const json = invocation.args.includes('--json');
  if (word !== undefined) {
    // A bare id as the first word: the command has to be said (a link would
    // have been taken as one in `parseCliInvocation`).
    const hint = unknownWordHint(word, program);
    return reportError(program, json, new CliError('usage', `unknown command: ${word}`, hint));
  }

  const flag = invocation.args[0];
  if (flag === '-V' || flag === '--version') {
    out(ctx.version);
    return EXIT.ok;
  }
  if (flag === undefined || flag === '-h' || flag === '--help') {
    out(programHelp(table, program, mode));
    return EXIT.ok;
  }
  return reportError(program, json, new CliError('usage', `unknown option: ${flag}`, `Run '${program} --help' for the commands.`));
}
