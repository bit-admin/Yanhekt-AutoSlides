// The wrapper files written to the user's PATH. Pure text generation and
// classification — the service next door does the disk work.
//
// A wrapper is a few lines that start the app binary in command line mode:
//   <exe> --cli[=<command>] -- <the user's arguments>
// The bare `--` stops Chromium reading the user's flags as its own switches.
//
// Every wrapper carries `WRAPPER_MARKER`. It is how the installer tells its own
// files from anything else that happens to have the same name: a file without
// the marker is never overwritten and never removed.
import type { CliWrapper, CliWrapperState } from '@common/cliCommands';

export const WRAPPER_MARKER = 'autoslides-cli-wrapper';

export type WrapperPlatform = 'posix' | 'win32';

/** File name of a wrapper on disk. */
export function wrapperFileName(wrapper: CliWrapper, platform: WrapperPlatform): string {
  return platform === 'win32' ? `${wrapper.name}.cmd` : wrapper.name;
}

const MISSING_APP_MESSAGE =
  'AutoSlides was not found. Open AutoSlides and reinstall the commands in Settings > Add-ons.';

/** Single-quote for POSIX sh: the only character that needs care is `'` itself. */
function shQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function posixScript(wrapper: CliWrapper, exePath: string): string {
  const lines = [
    '#!/bin/sh',
    `# ${WRAPPER_MARKER}: installed by AutoSlides (Settings > Add-ons > Command Line).`,
    '# Remove it there, or delete this file.',
    `APP=${shQuote(exePath)}`,
    'if [ ! -x "$APP" ]; then',
    `  echo ${shQuote(`${wrapper.name}: ${MISSING_APP_MESSAGE}`)} >&2`,
    '  exit 127',
    'fi',
  ];
  if (wrapper.command === null) {
    // The umbrella command with no arguments opens the app, like `code`.
    lines.push('if [ "$#" -eq 0 ]; then', '  exec "$APP"', 'fi', 'exec "$APP" --cli -- "$@"');
  } else {
    lines.push(`exec "$APP" --cli=${wrapper.command} -- "$@"`);
  }
  return `${lines.join('\n')}\n`;
}

/** `%` is the one character a batch file expands inside a quoted `set`. */
function cmdEscape(value: string): string {
  return value.replace(/%/g, '%%');
}

function windowsScript(wrapper: CliWrapper, exePath: string): string {
  const lines = [
    '@echo off',
    `rem ${WRAPPER_MARKER}: installed by AutoSlides (Settings ^> Add-ons ^> Command Line).`,
    'rem Remove it there, or delete this file.',
    'setlocal',
    `set "APP=${cmdEscape(exePath)}"`,
    'if not exist "%APP%" (',
    `  echo ${wrapper.name}: ${MISSING_APP_MESSAGE.replace(/>/g, '^>')} 1>&2`,
    '  exit /b 127',
    ')',
  ];
  if (wrapper.command === null) {
    lines.push(
      'if "%~1"=="" (',
      '  start "" "%APP%"',
      '  exit /b 0',
      ')',
      '"%APP%" --cli -- %*'
    );
  } else {
    lines.push(`"%APP%" --cli=${wrapper.command} -- %*`);
  }
  lines.push('exit /b %ERRORLEVEL%');
  // Batch files want CRLF; cmd.exe mis-parses labels and blocks with bare LF.
  return `${lines.join('\r\n')}\r\n`;
}

export function buildWrapperScript(wrapper: CliWrapper, exePath: string, platform: WrapperPlatform): string {
  return platform === 'win32' ? windowsScript(wrapper, exePath) : posixScript(wrapper, exePath);
}

/**
 * What the file currently at a wrapper's path is. `existing` is its text, or
 * `null` when nothing is there.
 */
export function classifyWrapper(existing: string | null, expected: string): CliWrapperState {
  if (existing === null) return 'not_installed';
  if (existing === expected) return 'installed';
  return existing.includes(WRAPPER_MARKER) ? 'outdated' : 'foreign';
}

/** Whether `dir` is one of the entries of a PATH string. */
export function isDirOnPath(dir: string, pathValue: string, platform: WrapperPlatform): boolean {
  const separator = platform === 'win32' ? ';' : ':';
  const normalize = (entry: string): string => {
    const trimmed = entry.trim().replace(/[\\/]+$/, '');
    return platform === 'win32' ? trimmed.toLowerCase() : trimmed;
  };
  const target = normalize(dir);
  return pathValue.split(separator).some((entry) => entry.trim() !== '' && normalize(entry) === target);
}

/**
 * One command the user can paste to put the bin folder on PATH — so the hint
 * in Settings never asks anyone to edit a profile by hand. `shell` is `$SHELL`.
 *
 * The profile differs per shell: zsh reads `~/.zshrc`; bash reads
 * `~/.bash_profile` for the login shells macOS terminals start and `~/.bashrc`
 * for the interactive ones Linux terminals start; fish has its own command.
 * Each also applies the change to the terminal it is pasted into, by
 * re-reading that profile.
 */
export function buildPathCommand(
  shell: string | undefined,
  os: 'darwin' | 'linux' | 'win32',
  binDir: string
): string {
  if (os === 'win32') {
    const dir = binDir.replace(/'/g, "''");
    return `[Environment]::SetEnvironmentVariable('Path', [Environment]::GetEnvironmentVariable('Path', 'User') + ';${dir}', 'User')`;
  }

  const name = shell ? shell.slice(shell.lastIndexOf('/') + 1) : '';
  if (name === 'fish') return 'fish_add_path ~/.local/bin';

  const profile =
    name === 'zsh' ? '~/.zshrc'
    : name === 'bash' ? (os === 'darwin' ? '~/.bash_profile' : '~/.bashrc')
    // Anything else: the macOS default shell is zsh; elsewhere ~/.profile is the common denominator.
    : os === 'darwin' && !name ? '~/.zshrc' : '~/.profile';
  // Re-reading the profile is the short way to apply it to the open terminal
  // (the hint has to fit one row). `source` is not POSIX, so plain sh gets `.`.
  const reload = name === 'zsh' || name === 'bash' || profile === '~/.zshrc' ? 'source' : '.';
  return `echo 'export PATH="$HOME/.local/bin:$PATH"' >> ${profile} && ${reload} ${profile}`;
}
