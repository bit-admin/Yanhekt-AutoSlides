// Exit codes and error codes every command shares. Part of the interface
// scripts and agents rely on (`schema` prints both tables): add, never renumber.

export const EXIT = {
  ok: 0,
  failed: 1,
  usage: 2,
  notFound: 3,
  auth: 4,
  network: 5,
  interrupted: 130,
} as const;

export const CLI_ERROR_CODES = {
  usage: { exit: EXIT.usage, meaning: 'The command line was wrong; nothing was requested' },
  not_found: { exit: EXIT.notFound, meaning: 'Yanhekt has no course or session with that id' },
  no_recording: { exit: EXIT.notFound, meaning: 'The session exists but has no recording (yet), or not the stream asked for' },
  auth_required: { exit: EXIT.auth, meaning: 'A personal list (a course\'s sessions, your enrolled courses) needs a Yanhekt token and none was found' },
  network: { exit: EXIT.network, meaning: 'Yanhekt could not be reached' },
  failed: { exit: EXIT.failed, meaning: 'Anything else; the message says what' },
  interrupted: { exit: EXIT.interrupted, meaning: 'Stopped by Ctrl-C; run the same command again to resume a download' },
} as const;

export type CliErrorCode = keyof typeof CLI_ERROR_CODES;

/** A failure a command reports on purpose, with an optional next step. */
export class CliError extends Error {
  constructor(readonly code: CliErrorCode, message: string, readonly hint?: string) {
    super(message);
    this.name = 'CliError';
  }

  get exit(): number {
    return CLI_ERROR_CODES[this.code].exit;
  }

  toJSON(): { code: CliErrorCode; message: string; hint?: string } {
    return this.hint ? { code: this.code, message: this.message, hint: this.hint } : { code: this.code, message: this.message };
  }
}
