// Terminal output for command line runs.
//
// `process.stdout`/`stderr` directly, never `console`: production builds strip
// console calls (terser `drop_console`). stdout carries only results (the path
// of each finished file) so it can be piped; everything a person reads —
// progress, notices, errors — goes to stderr.

export const out = (text: string): void => {
  process.stdout.write(`${text}\n`);
};

export const info = (text: string): void => {
  endStatusLine();
  process.stderr.write(`${text}\n`);
};

export const fail = (program: string, text: string): void => {
  info(`${program}: ${text}`);
};

let statusLineOpen = false;

/**
 * A line that rewrites itself in place. Only on an interactive terminal: when
 * stderr is a file or a pipe, hundreds of progress lines would be noise.
 */
export function status(text: string): void {
  if (!process.stderr.isTTY) return;
  process.stderr.write(`\r\x1b[2K${text}`);
  statusLineOpen = true;
}

export function endStatusLine(): void {
  if (!statusLineOpen) return;
  process.stderr.write('\r\x1b[2K');
  statusLineOpen = false;
}

/** Exit codes shared by every command. */
export const EXIT = {
  ok: 0,
  failed: 1,
  usage: 2,
  interrupted: 130,
} as const;
