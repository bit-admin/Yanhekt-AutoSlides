// What a command accepts, checked from its record. The terminal checks its
// own arguments with these; the app checks every request again, because
// anything that can open the socket can send one without the wrapper. Pure.
import type { OptionSpec } from './args';
import { CliError } from './errors';
import type { CliCommand } from './types';

/** Throws a usage error when the count of arguments is outside what the command takes. */
export function checkPositionals(
  id: string,
  command: Pick<CliCommand, 'positionals' | 'args'>,
  positionals: readonly string[],
): void {
  if (positionals.length > command.positionals.max) {
    throw new CliError(
      'usage',
      command.positionals.max === 0 ? `${id} takes no arguments` : `too many arguments: ${positionals.join(' ')}`,
    );
  }
  if (positionals.length < command.positionals.min) {
    throw new CliError('usage', `missing ${command.args}`);
  }
}

/**
 * Throws a usage error unless every option is one of `specs`, in the form
 * `parseArgs` would have produced: `true` for a switch, a non-empty value
 * (one of `choices`, when it has them) otherwise.
 */
export function checkOptions(options: Readonly<Record<string, string | true>>, specs: readonly OptionSpec[]): void {
  for (const [long, value] of Object.entries(options)) {
    const name = `--${long}`;
    const spec = specs.find((s) => s.long === long);
    if (!spec) throw new CliError('usage', `unknown option: ${name}`);
    if (!spec.value) {
      if (value !== true) throw new CliError('usage', `${name} does not take a value`);
      continue;
    }
    if (value === true || value === '') throw new CliError('usage', `${name} needs a ${spec.value}`);
    if (spec.choices && !spec.choices.includes(value)) {
      throw new CliError('usage', `${name} must be one of: ${spec.choices.join(', ')}`);
    }
  }
}
