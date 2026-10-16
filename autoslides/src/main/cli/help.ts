// Help text and the `schema` document, both generated from the command table
// so they cannot drift from what the parser accepts. Pure.
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
    ...(command.runsInApp ? [] : [VERBOSE_OPTION]),
    HELP_OPTION,
  ];
}

/** Which kind of program the help describes (see `@common/cliCommands`). */
export type CliMode = 'terminal' | 'app';

type CommandTable = Readonly<Record<string, CliCommand>>;

const INTRO: Record<CliMode, string[]> = {
  terminal: [
    'Look up and download Yanhekt recordings. Only the personal lists (a',
    'course\'s sessions, your own courses) use a sign-in; everything else is anonymous.',
  ],
  app: [
    'Drive the AutoSlides app. Commands run inside the app, which starts if it',
    'is not running and must be signed in to Yanhekt. They follow its settings:',
    'network route, anonymous requests, output folder, auto-extraction.',
  ],
};

const EXIT_LINE = 'Exit codes: 0 ok, 1 failed, 2 usage, 3 not found, 4 sign-in needed, 5 network, 6 app unavailable, 130 interrupted.';

const fill = (text: string, program: string): string => text.replace(/\{program\}/g, program);

export function commandHelp(id: string, command: CliCommand, program: string): string {
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

export function programHelp(commands: CommandTable, program: string, mode: CliMode): string {
  const ids = Object.keys(commands);
  const width = Math.max(...ids.map((id) => id.length));
  return [
    `Usage: ${program} <command> [options]`,
    '',
    ...INTRO[mode],
    '',
    'Commands:',
    ...ids.map((id) => `  ${id.padEnd(width)}  ${commands[id].summary}`),
    '',
    ...(mode === 'terminal'
      ? [
          `A Yanhekt link works on its own: '${program} <session link>' downloads it,`,
          `'${program} <course link>' shows the course. A bare id needs its command.`,
        ]
      : [`A session link works on its own: '${program} <session link>' downloads it.`]),
    '',
    'Every command takes --json for one machine-readable answer on stdout.',
    EXIT_LINE,
    '',
    `Run '${program} <command> --help' for a command's options, or '${program} schema' for all of it as JSON.`,
    ...(mode === 'app'
      ? [
          `Run '${program}' with no arguments to open the app.`,
          "Commands that run in the terminal without the app: 'yhdl --help'.",
        ]
      : []),
  ].join('\n');
}

const AUTH: Record<CliMode, object> = {
  terminal: {
    env: TOKEN_ENV,
    order: ['--token', '--account', TOKEN_ENV, 'the account signed in to AutoSlides'],
    note: 'Only the personal lists send a token: a course\'s sessions (course, download --course) and the account\'s courses (mine). Search, course details, session lookups and video downloads are anonymous.',
  },
  app: {
    note: 'Every command runs inside AutoSlides (started if it is not running) as the account it is signed in with; signed out is error sign_in_required. Requests follow its Settings > Network (route, prefer anonymous requests). Command-line control can be turned off in Settings > Add-ons > Command Line (error cli_control_disabled).',
  },
};

export function buildSchema(commands: CommandTable, program: string, version: string, mode: CliMode) {
  return {
    program,
    version,
    runs_in: mode === 'app' ? 'the AutoSlides app' : 'this terminal process',
    output: {
      json: 'With --json, stdout is exactly one JSON object: {"ok":true,"data":…} or {"ok":false,"error":{"code","message","hint"?},"data"?}. Progress and notices go to stderr.',
      text: 'Without --json, stdout carries only results (tables, or the path of each downloaded file).',
      ids: 'Every id is a string.',
    },
    exit_codes: EXIT,
    error_codes: Object.fromEntries(Object.entries(CLI_ERROR_CODES).map(([code, v]) => [code, v])),
    auth: AUTH[mode],
    arguments: {
      session: 'A session id or https://www.yanhekt.cn/session/<id>',
      course: 'A course id or https://www.yanhekt.cn/course/<id>',
      bare_number: 'Means whatever the command expects; a link says which it is.',
      link_alone:
        mode === 'app'
          ? 'A session link may replace the command and runs download. A bare number may not.'
          : 'A link may replace the command: a session link runs download, a course link runs course. A bare number may not.',
    },
    commands: Object.keys(commands).map((id) => {
      const c = commands[id];
      return {
        name: id,
        usage: `${program} ${id}${c.args ? ` ${c.args}` : ''} [options]`,
        summary: c.summary,
        description: c.description.filter(Boolean).join(' '),
        token: c.runsInApp ? 'the app\'s signed-in account' : (c.tokenUse ?? 'never'),
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
