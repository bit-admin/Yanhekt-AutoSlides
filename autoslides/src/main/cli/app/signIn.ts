import { CliError } from '../errors';
import type { AppCommandContext } from './types';

/**
 * Every app command runs as the account AutoSlides is signed in with, even
 * where a request could go out without it: driving the app means acting as
 * its user. Waits for the launch-time sign-in to settle, then returns the
 * token. Settings → Network "prefer anonymous" still decides, per request,
 * whether the token is sent.
 */
export async function requireSignIn(ctx: AppCommandContext): Promise<string> {
  const { signedIn } = await ctx.renderer.request('signInState', {});
  const token = ctx.configService.getAuthToken();
  if (!signedIn || !token) {
    throw new CliError(
      'sign_in_required',
      'AutoSlides is not signed in to Yanhekt',
      'Sign in in the AutoSlides window, then run the command again.'
    );
  }
  return token;
}
