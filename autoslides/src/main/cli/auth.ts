// The token for a command that reads a personal list (sessions, enrolled courses) or the online Index, read from the flags, the
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

const USE_TEXT = {
  sessions: 'Listing sessions',
  courses: 'Listing courses',
  index: 'Searching the AutoSlides Index',
} as const;

/** One stderr line naming whose sign-in the run uses. Never the token. */
export function announceCredentials(credentials: Credentials, what: keyof typeof USE_TEXT = 'sessions'): void {
  const who = credentials.account ? ` (${credentials.account.name})` : '';
  info(`${USE_TEXT[what]} with ${TOKEN_SOURCE_TEXT[credentials.source]}${who}.`);
}

/** The `auth` part of a JSON answer. */
export function credentialsJson(credentials: Credentials): { source: string; account: string | null } {
  return { source: credentials.source, account: credentials.account?.name ?? null };
}
