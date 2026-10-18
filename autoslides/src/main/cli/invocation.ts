// How a process start is recognised as a command line run.
//
// A wrapper starts the app as `<exe> --cli=<wrapper name> -- <args…>`, and the
// first argument names the command: `yhdl search 微积分` arrives as
// `--cli=yhdl -- search 微积分`. The wrapper name is only the program name
// help text shows; every wrapper takes the same commands. A dev run may pass a
// bare `--cli`.
//
// A Yanhekt link may stand in for the command, since it says what it is:
// `yhdl <session link>` downloads it and `yhdl <course link>` shows the course.
// A bare number may not: it could be either kind of id.
//
// The bare `--` matters: Chromium stops reading switches there, so a user's
// `--version` or `--output` is never taken for one of its own.
import {
  CLI_DEFAULT_PROGRAM,
  isCliAppCommandId,
  isCliCommandId,
  type CliAppCommandId,
  type CliCommandId,
} from '@common/cliCommands';
import { parseSessionInput } from '@common/sessionInput';

export interface CliInvocation {
  /** What the user typed to start it (`yhdl`, `autoslides`), for help and error text. */
  program: string;
  /**
   * `null` when no command was given, or the word was not one we know. Any
   * wrapper's word is taken here; the dispatcher says when this wrapper lacks it.
   */
  command: CliCommandId | CliAppCommandId | null;
  /** The word the user typed for the command, kept for the error message. Absent when a link stood in for it. */
  commandWord?: string;
  args: string[];
}

const CLI_SWITCH = '--cli';
const PROGRAM_NAME = /^[A-Za-z0-9._-]+$/;

export function parseCliInvocation(argv: readonly string[]): CliInvocation | null {
  const index = argv.findIndex((arg) => arg === CLI_SWITCH || arg.startsWith(`${CLI_SWITCH}=`));
  if (index === -1) return null;

  const named = argv[index].slice(CLI_SWITCH.length + 1);
  const program = PROGRAM_NAME.test(named) ? named : CLI_DEFAULT_PROGRAM;

  const rest = argv.slice(index + 1);
  const args = rest[0] === '--' ? rest.slice(1) : rest;

  const [word, ...commandArgs] = args;
  if (word === undefined || word.startsWith('-')) {
    // `yhdl`, `yhdl --help`, `yhdl --version`: the dispatcher handles them.
    return { program, command: null, args };
  }
  if (isCliCommandId(word) || isCliAppCommandId(word)) return { program, command: word, commandWord: word, args: commandArgs };
  if (!/^\d+$/.test(word)) {
    const link = parseSessionInput(word);
    if (link.kind === 'session') return { program, command: 'download', args };
    if (link.kind === 'course') return { program, command: 'course', args };
  }
  return { program, command: null, commandWord: word, args: commandArgs };
}
