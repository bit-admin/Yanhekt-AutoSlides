// Terminal output for command line runs.
//
// `process.stdout`/`stderr` directly, never `console`: production builds strip
// console calls (terser `drop_console`). stdout carries only results — a
// command's table, the path of each finished file, or with `--json` one JSON
// document — so it can be piped; everything a person reads while it runs
// (progress, notices, errors) goes to stderr.

export const out = (text: string): void => {
  process.stdout.write(`${text}\n`);
};

let noticesWritten = false;

export const info = (text: string): void => {
  endStatusLine();
  process.stderr.write(`${text}\n`);
  noticesWritten = true;
};

/**
 * A blank line on stderr between notices and what follows, so a table does not
 * sit flush against "Listing … with …". Never on stdout, which stays pipeable.
 */
export function separate(): void {
  if (noticesWritten) process.stderr.write('\n');
  noticesWritten = false;
}

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
