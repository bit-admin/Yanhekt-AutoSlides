// The token for a command that reads a personal list (sessions, enrolled courses), read from the flags, the
// environment and the app's saved accounts (see credentials.ts).
import { CliError } from './errors';
import { TOKEN_ENV, TOKEN_SOURCE_TEXT, resolveCredentials, type Credentials } from './credentials';
import { info } from './terminal';
import type { CliContext, CommandInput } from './types';

export function readCredentials(input: CommandInput, ctx: CliContext): Credentials {
  const flag = (name: string): string | undefined => {
    const value = input.options[name];
    return typeof value === 'string' ? value : undefined;
  };
  const result = resolveCredentials({
    flagToken: flag('token'),
    flagAccount: flag('account'),
    envToken: process.env[TOKEN_ENV],
    accounts: ctx.configService.getConfig().accounts ?? [],
    activeToken: ctx.configService.getAuthToken(),
  });
  if (!result.ok) throw new CliError(result.code, result.message, result.hint);
  return result.credentials;
}

/** One stderr line naming whose sign-in lists the sessions. Never the token. */
export function announceCredentials(credentials: Credentials, what: 'sessions' | 'courses' = 'sessions'): void {
  const who = credentials.account ? ` (${credentials.account.name})` : '';
  info(`Listing ${what} with ${TOKEN_SOURCE_TEXT[credentials.source]}${who}.`);
}

/** The `auth` part of a JSON answer. */
export function credentialsJson(credentials: Credentials): { source: string; account: string | null } {
  return { source: credentials.source, account: credentials.account?.name ?? null };
}
