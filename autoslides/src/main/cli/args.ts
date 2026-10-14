// A small option parser driven by each command's option table, so the help
// text, `schema` and the parser cannot disagree. Pure, so it is unit-tested.
import { CliError } from './errors';

export interface OptionSpec {
  /** Without the leading dashes: `output` for `--output`. */
  long: string;
  /** One letter, without the dash: `o` for `-o`. */
  short?: string;
  /** Placeholder when the option takes a value (`dir` → `--output <dir>`); absent for a switch. */
  value?: string;
  choices?: readonly string[];
  description: string;
}

export interface ParsedArgs {
  positionals: string[];
  /** Keyed by `long`. A switch is `true`; the last of a repeated option wins. */
  options: Record<string, string | true>;
}

export type ParseResult = { ok: true; parsed: ParsedArgs } | { ok: false; message: string };

export function optionLabel(spec: OptionSpec): string {
  const flags = spec.short ? `-${spec.short}, --${spec.long}` : `    --${spec.long}`;
  return spec.value ? `${flags} <${spec.value}>` : flags;
}

export function parseArgs(args: readonly string[], specs: readonly OptionSpec[]): ParseResult {
  const positionals: string[] = [];
  const options: Record<string, string | true> = {};
  let onlyPositionals = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    // A lone `-` is a value (stdin); everything after `--` is too.
    if (onlyPositionals || arg === '-' || !arg.startsWith('-')) {
      positionals.push(arg);
      continue;
    }
    if (arg === '--') {
      onlyPositionals = true;
      continue;
    }

    // `--name=value` and `--name value` are both accepted.
    const eq = arg.startsWith('--') ? arg.indexOf('=') : -1;
    const name = eq === -1 ? arg : arg.slice(0, eq);
    const spec = name.startsWith('--')
      ? specs.find((s) => `--${s.long}` === name)
      : specs.find((s) => s.short !== undefined && `-${s.short}` === name);
    if (!spec) return { ok: false, message: `unknown option: ${name}` };

    if (!spec.value) {
      if (eq !== -1) return { ok: false, message: `${name} does not take a value` };
      options[spec.long] = true;
      continue;
    }
    const value = eq === -1 ? args[++i] : arg.slice(eq + 1);
    if (value === undefined || value === '') return { ok: false, message: `${name} needs a ${spec.value}` };
    if (spec.choices && !spec.choices.includes(value)) {
      return { ok: false, message: `${name} must be one of: ${spec.choices.join(', ')}` };
    }
    options[spec.long] = value;
  }

  return { ok: true, parsed: { positionals, options } };
}

/** A whole-number option such as `--page`, or `fallback` when absent. */
export function intOption(value: string | true | undefined, name: string, fallback: number, max = Infinity): number {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > max) {
    throw new CliError('usage', `--${name} must be a whole number from 1${max === Infinity ? '' : ` to ${max}`}`);
  }
  return n;
}
