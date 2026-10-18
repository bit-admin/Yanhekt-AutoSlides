// The command line surface, shared by both processes.
//
// The packaged app is its own CLI: a wrapper script on PATH starts the app
// binary with `--cli=<wrapper name> -- <args>` (see `@main/cli`). This file is
// the one table both sides read: main dispatches on the command ids, the
// installer writes one wrapper per `CLI_WRAPPERS` row, and Settings → Add-ons
// lists the same rows.
//
// Two kinds of wrapper:
// - terminal only (`yhdl`): the command runs in that process, with no window,
//   anonymous where it can be and with its own route flags.
// - driving the app (`autoslides`): the command is sent to the running app
//   (started if need be) and runs there, signed in and under its settings.
//
// Adding a terminal feature = one command in `@main/cli/commands` and its id in
// `CLI_COMMAND_IDS`; an app feature = one in `@main/cli/app` and its id in
// `CLI_APP_COMMAND_IDS`.

export const CLI_COMMAND_IDS = ['search', 'mine', 'course', 'session', 'download', 'terms', 'whoami', 'schema'] as const;
export type CliCommandId = (typeof CLI_COMMAND_IDS)[number];

/**
 * What the app-driving wrapper takes: the same words, run in the app (`schema`
 * answers in the terminal), plus what only the app has (`downloads`, its
 * Download panel; `config`, its settings). Its own list, so a terminal command can exist before its
 * app counterpart does.
 */
export const CLI_APP_COMMAND_IDS = ['search', 'mine', 'course', 'session', 'download', 'downloads', 'terms', 'whoami', 'config', 'schema'] as const;
export type CliAppCommandId = (typeof CLI_APP_COMMAND_IDS)[number];

export interface CliWrapper {
  /** File name on PATH (`.cmd` is appended on Windows). It is also the program name help text shows. */
  name: string;
  /**
   * Commands run inside the app instead of in the terminal. With no arguments
   * it also opens the app (like `code`) instead of printing help.
   */
  drivesApp: boolean;
}

/** Program name when the switch carries none (a dev run). */
export const CLI_DEFAULT_PROGRAM = 'autoslides';

export const CLI_WRAPPERS: readonly CliWrapper[] = [
  { name: 'autoslides', drivesApp: true },
  { name: 'yhdl', drivesApp: false },
];

/** Whether this program name drives the app. Any name not in the table (a future alias) stays terminal only. */
export function cliDrivesApp(program: string): boolean {
  return CLI_WRAPPERS.some((w) => w.name === program && w.drivesApp);
}

export function isCliCommandId(value: string): value is CliCommandId {
  return (CLI_COMMAND_IDS as readonly string[]).includes(value);
}

export function isCliAppCommandId(value: string): value is CliAppCommandId {
  return (CLI_APP_COMMAND_IDS as readonly string[]).includes(value);
}

/** The program name of the wrapper that drives the app, for hints from the other ones. */
export const CLI_APP_PROGRAM = CLI_WRAPPERS.find((w) => w.drivesApp)?.name ?? CLI_DEFAULT_PROGRAM;

// ── Install status (main → Settings) ─────────────────────────────────────────

/**
 * - `installed`: our wrapper, pointing at this app.
 * - `outdated`: our wrapper, but written by another copy/version of the app.
 * - `foreign`: some other file has that name; it is never overwritten or removed.
 */
export type CliWrapperState = 'not_installed' | 'installed' | 'outdated' | 'foreign';

export interface CliWrapperStatus {
  name: string;
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
  /** The agent skill the app ships; null when this build carries none. */
  skill: CliSkillStatus | null;
}

/** The agent skill for the commands (repo `skills/autoslides-cli`), kept by the app at a fixed path. */
export interface CliSkillStatus {
  /** The folder an agent links to; refreshed on every launch. */
  path: string;
  /** What Settings copies for the user to paste into an agent. */
  prompt: string;
}

export interface CliInstallResult {
  success: boolean;
  error?: string;
  status: CliInstallStatus;
}
