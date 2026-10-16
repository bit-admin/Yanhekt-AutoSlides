// Which Yanhekt login token a run uses. Only personal lists need one — a
// course's sessions (`course`, `download --course`) and the account's own
// courses (`mine`); every other request is anonymous.
// Pure, so it is unit-tested.
//
// First match wins: `--token`, `--account`, the YANHEKT_TOKEN environment
// variable, then the account currently active in AutoSlides. Nothing is ever
// saved, and the token itself is never printed.
import type { StoredAccount } from '@common/types';

export const TOKEN_ENV = 'YANHEKT_TOKEN';
const TOKEN_PATTERN = /^[0-9a-f]{32}$/i;

export type TokenSource = 'flag' | 'account' | 'env' | 'app';

export const TOKEN_SOURCE_TEXT: Record<TokenSource, string> = {
  flag: 'the token passed with --token',
  account: 'an account saved in AutoSlides (--account)',
  env: `the token in ${TOKEN_ENV}`,
  app: 'the account active in AutoSlides',
};

export interface Credentials {
  token: string;
  source: TokenSource;
  /** The saved account the token belongs to, when it is one. */
  account: { badge: string; name: string } | null;
}

export interface CredentialInput {
  flagToken?: string;
  flagAccount?: string;
  envToken?: string;
  accounts: readonly StoredAccount[];
  activeToken: string | null;
}

export type CredentialResult =
  | { ok: true; credentials: Credentials }
  | { ok: false; code: 'usage' | 'auth_required'; message: string; hint?: string };

export const accountName = (a: StoredAccount): string => a.displayName || a.nickname || a.badge;

export function resolveCredentials(input: CredentialInput): CredentialResult {
  const usage = (message: string): CredentialResult => ({ ok: false, code: 'usage', message });
  const found = (token: string, source: TokenSource): CredentialResult => {
    const saved = input.accounts.find((a) => a.token === token);
    return {
      ok: true,
      credentials: { token, source, account: saved ? { badge: saved.badge, name: accountName(saved) } : null },
    };
  };

  if (input.flagToken !== undefined && input.flagAccount !== undefined) {
    return usage('--token and --account cannot be used together');
  }

  if (input.flagToken !== undefined) {
    const token = input.flagToken.trim();
    if (!TOKEN_PATTERN.test(token)) return usage('--token must be a 32-character Yanhekt login token');
    return found(token, 'flag');
  }

  if (input.flagAccount !== undefined) {
    const query = input.flagAccount.trim().toLowerCase();
    const matches = input.accounts.filter(
      (a) =>
        a.badge.toLowerCase() === query ||
        a.displayName.toLowerCase() === query ||
        a.nickname.toLowerCase() === query
    );
    if (matches.length === 1) return found(matches[0].token, 'account');
    if (matches.length > 1) return usage(`more than one saved account is called "${input.flagAccount}"; use its student number`);
    const saved = input.accounts.map((a) => `${accountName(a)} (${a.badge})`).join(', ');
    return usage(
      saved
        ? `no saved account matches "${input.flagAccount}". Saved: ${saved}`
        : `no saved account matches "${input.flagAccount}": none are saved in AutoSlides`
    );
  }

  const envToken = input.envToken?.trim();
  if (envToken) {
    if (!TOKEN_PATTERN.test(envToken)) return usage(`${TOKEN_ENV} must be a 32-character Yanhekt login token`);
    return found(envToken, 'env');
  }

  if (input.activeToken) return found(input.activeToken, 'app');

  return {
    ok: false,
    code: 'auth_required',
    message: 'this needs a Yanhekt sign-in, and none was found',
    hint: `Sign in to AutoSlides, or pass --token <token> or set ${TOKEN_ENV} for this run.`,
  };
}
