import { accountName } from '../credentials';
import { CliError } from '../errors';
import type { AppCommandContext } from './types';

export interface AppSignIn {
  token: string;
  /** The saved account the token belongs to; null when it is not among them (a pasted token). */
  account: { name: string; badge: string } | null;
}

/**
 * Every app command that talks to Yanhekt runs as the account AutoSlides is
 * signed in with, even where a request could go out without it: driving the
 * app means acting as its user. Commands that stay inside the app (`config`,
 * most of `downloads`) do not call this. There is no flag to pick another
 * account or token. Waits for the launch-time sign-in to settle, then returns
 * the token. Settings → Network "prefer anonymous" still decides, per request,
 * whether the token is sent.
 */
export async function requireSignIn(ctx: AppCommandContext): Promise<AppSignIn> {
  const { signedIn } = await ctx.renderer.request('signInState', {});
  const token = ctx.configService.getAuthToken();
  if (!signedIn || !token) {
    throw new CliError(
      'sign_in_required',
      'AutoSlides is not signed in to Yanhekt',
      'Sign in in the AutoSlides window, then run the command again.'
    );
  }
  const saved = (ctx.configService.getConfig().accounts ?? []).find((a) => a.token === token);
  return { token, account: saved ? { name: accountName(saved), badge: saved.badge } : null };
}
