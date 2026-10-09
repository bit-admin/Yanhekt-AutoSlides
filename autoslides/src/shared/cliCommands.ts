// The command line surface, shared by both processes.
//
// The packaged app is its own CLI: a wrapper script on PATH starts the app
// binary with `--cli[=<command>] -- <args>`, and `main.ts` runs that command
// without opening a window (see `@main/cli`). This file is the one table both
// sides read: main dispatches on `CLI_COMMAND_IDS`, the installer writes one
// wrapper per `CLI_WRAPPERS` row, and Settings → Add-ons lists the same rows.
//
// Adding a feature = one command in `@main/cli/commands`, its id here, and
// (only if it deserves a short name of its own) one more wrapper row.

export const CLI_COMMAND_IDS = ['download'] as const;
export type CliCommandId = (typeof CLI_COMMAND_IDS)[number];

export interface CliWrapper {
  /** File name on PATH (`.cmd` is appended on Windows). */
  name: string;
  /**
   * The command this wrapper is bound to, or `null` for the umbrella command,
   * which takes the command as its first argument (`autoslides download …`)
   * and opens the app when run with no arguments.
   */
  command: CliCommandId | null;
}

export const CLI_UMBRELLA_NAME = 'autoslides';

export const CLI_WRAPPERS: readonly CliWrapper[] = [
  { name: CLI_UMBRELLA_NAME, command: null },
  { name: 'yhdl', command: 'download' },
];

/** The name a command is advertised under in its own help text. */
export function cliProgramName(command: CliCommandId | null): string {
  if (command === null) return CLI_UMBRELLA_NAME;
  const wrapper = CLI_WRAPPERS.find((w) => w.command === command);
  return wrapper ? wrapper.name : `${CLI_UMBRELLA_NAME} ${command}`;
}

export function isCliCommandId(value: string): value is CliCommandId {
  return (CLI_COMMAND_IDS as readonly string[]).includes(value);
}

// ── Install status (main → Settings) ─────────────────────────────────────────

/**
 * - `installed`: our wrapper, pointing at this app.
 * - `outdated`: our wrapper, but written by another copy/version of the app.
 * - `foreign`: some other file has that name; it is never overwritten or removed.
 */
export type CliWrapperState = 'not_installed' | 'installed' | 'outdated' | 'foreign';

export interface CliWrapperStatus {
  name: string;
  command: CliCommandId | null;
  /** Full path of the wrapper file. */
  path: string;
  state: CliWrapperState;
}

/**
 * Why the commands cannot be installed from this copy of the app:
 * - `dev`: an unpackaged build, whose executable is the bare Electron binary.
 * - `translocated`: macOS is running the app from a randomized read-only path
 *   (it was opened without being moved out of Downloads), which changes on
 *   every launch.
 */
export type CliUnsupportedReason = 'dev' | 'translocated';

export interface CliInstallStatus {
  supported: boolean;
  reason?: CliUnsupportedReason;
  /** Folder the wrappers are written to. */
  binDir: string;
  /** Whether `binDir` is on the user's PATH; `null` when it could not be determined. */
  onPath: boolean | null;
  /** A command the user can paste into a terminal to put `binDir` on PATH. */
  pathCommand: string;
  wrappers: CliWrapperStatus[];
}

export interface CliInstallResult {
  success: boolean;
  error?: string;
  status: CliInstallStatus;
}
