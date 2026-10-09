// How a process start is recognised as a command line run.
//
// A wrapper starts the app as `<exe> --cli[=<command>] -- <args…>`:
//   - `--cli=download -- 123456`  → the `download` command (the `yhdl` wrapper)
//   - `--cli -- download 123456`  → the umbrella wrapper; the command is args[0]
//
// The bare `--` matters: Chromium stops reading switches there, so a user's
// `--version` or `--output` is never taken for one of its own.
import { isCliCommandId, type CliCommandId } from '@common/cliCommands';

export interface CliInvocation {
  /** `null` when the command name was not one we know — the dispatcher reports it. */
  command: CliCommandId | null;
  /** The word the user typed for the command, when it came from the umbrella wrapper. */
  commandWord?: string;
  /** True when started through a wrapper bound to one command (`yhdl`). */
  bound: boolean;
  args: string[];
}

const CLI_SWITCH = '--cli';

export function parseCliInvocation(argv: readonly string[]): CliInvocation | null {
  const index = argv.findIndex((arg) => arg === CLI_SWITCH || arg.startsWith(`${CLI_SWITCH}=`));
  if (index === -1) return null;

  const rest = argv.slice(index + 1);
  const args = rest[0] === '--' ? rest.slice(1) : rest;

  const switchArg = argv[index];
  if (switchArg !== CLI_SWITCH) {
    const word = switchArg.slice(CLI_SWITCH.length + 1);
    return { command: isCliCommandId(word) ? word : null, commandWord: word, bound: true, args };
  }

  const [word, ...commandArgs] = args;
  if (word === undefined || word.startsWith('-')) {
    // `autoslides --help` / `--version`: no command, the dispatcher handles the flags.
    return { command: null, bound: false, args };
  }
  return { command: isCliCommandId(word) ? word : null, commandWord: word, bound: false, args: commandArgs };
}
