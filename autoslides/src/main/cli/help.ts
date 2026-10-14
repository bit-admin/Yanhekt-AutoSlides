// Help text and the `schema` document, both generated from the command table
// so they cannot drift from what the parser accepts. Pure.
import type { CliCommandId } from '@common/cliCommands';
import { optionLabel, type OptionSpec } from './args';
import { TOKEN_ENV } from './credentials';
import { CLI_ERROR_CODES, EXIT } from './errors';
import type { CliCommand } from './types';

export const JSON_OPTION: OptionSpec = {
  long: 'json',
  description: 'Print one JSON object to stdout: {"ok":true,"data":…} or {"ok":false,"error":…}',
};
const VERBOSE_OPTION: OptionSpec = { long: 'verbose', short: 'v', description: 'Print diagnostic logs to stderr' };
const HELP_OPTION: OptionSpec = { long: 'help', short: 'h', description: 'Show this help' };
const NETWORK_OPTIONS: OptionSpec[] = [
  { long: 'intranet', description: 'Use the campus intranet route (default: public network)' },
  {
    long: 'interface',
    value: 'if',
    description: 'With --intranet: send from this interface (name such as en1, or its IPv4 address) instead of the one set in AutoSlides',
  },
];
const TOKEN_OPTIONS: OptionSpec[] = [
  { long: 'token', value: 'token', description: `Use this login token for this run (or set ${TOKEN_ENV}); never saved` },
  { long: 'account', value: 'name', description: 'Use an account saved in AutoSlides (name or student number)' },
];

/** Every option a command accepts, in help order. */
export function commandOptions(command: CliCommand): OptionSpec[] {
  return [
    ...command.options,
    ...(command.tokenUse ? TOKEN_OPTIONS : []),
    ...(command.network ? NETWORK_OPTIONS : []),
    JSON_OPTION,
    VERBOSE_OPTION,
    HELP_OPTION,
  ];
}

const fill = (text: string, program: string): string => text.replace(/\{program\}/g, program);

export function commandHelp(id: CliCommandId, command: CliCommand, program: string): string {
  const options = commandOptions(command);
  const width = Math.max(...options.map((o) => optionLabel(o).length));
  return [
    `Usage: ${program} ${id}${command.args ? ` ${command.args}` : ''} [options]`,
    '',
    ...command.description,
    '',
    'Examples:',
    ...command.examples.map((e) => `  ${program} ${fill(e, program)}`),
    '',
    'Options:',
    ...options.map((o) => `  ${optionLabel(o).padEnd(width)}  ${o.description}`),
  ].join('\n');
}

export function programHelp(commands: Record<CliCommandId, CliCommand>, program: string, opensApp: boolean): string {
  const ids = Object.keys(commands) as CliCommandId[];
  const width = Math.max(...ids.map((id) => id.length));
  return [
    `Usage: ${program} <command> [options]`,
    '',
    'Look up and download Yanhekt recordings. Only the personal lists (a',
    'course\'s sessions, your own courses) use a sign-in; everything else is anonymous.',
    '',
    'Commands:',
    ...ids.map((id) => `  ${id.padEnd(width)}  ${commands[id].summary}`),
    '',
    `A Yanhekt link works on its own: '${program} <session link>' downloads it,`,
    `'${program} <course link>' shows the course. A bare id needs its command.`,
    '',
    'Every command takes --json for one machine-readable answer on stdout.',
    `Exit codes: 0 ok, 1 failed, 2 usage, 3 not found, 4 sign-in needed, 5 network, 130 interrupted.`,
    '',
    `Run '${program} <command> --help' for a command's options, or '${program} schema' for all of it as JSON.`,
    ...(opensApp ? [`Run '${program}' with no arguments to open the app.`] : []),
  ].join('\n');
}

export function buildSchema(commands: Record<CliCommandId, CliCommand>, program: string, version: string) {
  return {
    program,
    version,
    output: {
      json: 'With --json, stdout is exactly one JSON object: {"ok":true,"data":…} or {"ok":false,"error":{"code","message","hint"?},"data"?}. Progress and notices go to stderr.',
      text: 'Without --json, stdout carries only results (tables, or the path of each downloaded file).',
      ids: 'Every id is a string.',
    },
    exit_codes: EXIT,
    error_codes: Object.fromEntries(Object.entries(CLI_ERROR_CODES).map(([code, v]) => [code, v])),
    auth: {
      env: TOKEN_ENV,
      order: ['--token', '--account', TOKEN_ENV, 'the account signed in to AutoSlides'],
      note: 'Only the personal lists send a token: a course\'s sessions (course, download --course) and the account\'s courses (mine). Search, course details, session lookups and video downloads are anonymous.',
    },
    arguments: {
      session: 'A session id or https://www.yanhekt.cn/session/<id>',
      course: 'A course id or https://www.yanhekt.cn/course/<id>',
      bare_number: 'Means whatever the command expects; a link says which it is.',
      link_alone: 'A link may replace the command: a session link runs download, a course link runs course. A bare number may not.',
    },
    commands: (Object.keys(commands) as CliCommandId[]).map((id) => {
      const c = commands[id];
      return {
        name: id,
        usage: `${program} ${id}${c.args ? ` ${c.args}` : ''} [options]`,
        summary: c.summary,
        description: c.description.filter(Boolean).join(' '),
        token: c.tokenUse ?? 'never',
        options: commandOptions(c)
          .filter((o) => o.long !== 'help')
          .map((o) => ({
            name: `--${o.long}`,
            ...(o.short ? { short: `-${o.short}` } : {}),
            ...(o.value ? { value: o.value } : {}),
            ...(o.choices ? { choices: o.choices } : {}),
            description: o.description,
          })),
        examples: c.examples.map((e) => `${program} ${fill(e, program)}`),
        data: c.data,
      };
    }),
  };
}
