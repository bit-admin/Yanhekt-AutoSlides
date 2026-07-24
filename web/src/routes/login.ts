/**
 * Password login, in one or two requests.
 *
 *   POST /login      { username, password, deviceKeepsake? }
 *     → 200 { success: true, token, deviceKeepsake? }
 *     → 401 { success: false, error, reason? }
 *     → 202 { status: "sms_required", phoneHint, resumeToken, resumeNonce, expiresIn }
 *
 *   POST /login/sms  { resumeToken, resumeNonce, code }
 *     → 200 { success: true, token, deviceKeepsake? }
 *     → 401 { success: false, error, reason }
 *
 * The CAS protocol lives in ../lib/campusSso. The reason login is split in two
 * is that campus SSO frequently demands an SMS code, and a Worker cannot hold a
 * half-finished flow open while the user reads a text. Instead the flow's state
 * comes back to the browser sealed (../lib/resumeSeal) and is posted in again
 * with the code. The browser can never do these hops itself: sso.bit.edu.cn
 * sends no CORS headers, which is why password login is proxied at all.
 *
 * Without SSO_RESUME_KEY there is nothing to seal with, so a second-factor page
 * degrades to the same "sign in with token" error as before this existed —
 * a deployment that never sets the secret keeps working, minus SMS.
 */
import { Hono } from "hono";
import type { Env } from "../env";
import {
  CasSignInError,
  finishSecondFactor,
  startPasswordSignIn,
  type DurableCookie,
  type SecondFactorContext,
} from "../lib/campusSso";
import {
  KEEPSAKE_TTL_SECONDS,
  RESUME_TTL_SECONDS,
  Sealer,
  randomNonce,
} from "../lib/resumeSeal";

export const loginRouter = new Hono<{ Bindings: Env }>();

interface LoginBody {
  username?: unknown;
  password?: unknown;
  deviceKeepsake?: unknown;
}

interface SmsBody {
  resumeToken?: unknown;
  resumeNonce?: unknown;
  code?: unknown;
}

loginRouter.post("/login", async (c) => {
  const body = await readJsonBody<LoginBody>(c.req.raw);
  if (!body) return c.json({ success: false, error: "Invalid JSON body" }, 400);

  const { username, password } = body;
  if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
    return c.json({ success: false, error: "username and password are required" }, 400);
  }

  const sealer = await Sealer.from(c.env.SSO_RESUME_KEY);
  const trustedCookies = await openKeepsake(sealer, body.deviceKeepsake);

  try {
    const outcome = await startPasswordSignIn(username, password, trustedCookies);

    if (outcome.kind === "token") {
      return c.json({
        success: true,
        token: outcome.token,
        deviceKeepsake: await sealKeepsake(sealer, outcome.durableCookies),
      });
    }

    // The credentials were fine and the code was sent, but with no secret bound
    // there is nothing to seal the flow with, so it cannot be resumed. Distinct
    // from `unsupported_page` (which means CAS served something we could not
    // parse): this one is a deployment gap, and only the operator can fix it.
    if (!sealer) {
      console.warn(
        "SSO_RESUME_KEY is not bound: an SMS second factor was reached but cannot be completed. " +
          "Set it with `wrangler secret put SSO_RESUME_KEY`, or add it to .dev.vars for local dev.",
      );
      return c.json(
        {
          success: false,
          error: "Verification by SMS is unavailable here. Please sign in with token instead.",
          reason: "sms_unavailable",
        },
        401,
      );
    }

    // 202: the credentials were accepted, but the sign-in is not done yet.
    const resumeNonce = randomNonce();
    return c.json(
      {
        status: "sms_required",
        phoneHint: outcome.phoneHint,
        resumeToken: await sealer.seal(outcome.context, RESUME_TTL_SECONDS, resumeNonce),
        resumeNonce,
        expiresIn: RESUME_TTL_SECONDS,
      },
      202,
    );
  } catch (error) {
    return c.json(failureBody(error), 401);
  }
});

loginRouter.post("/login/sms", async (c) => {
  const body = await readJsonBody<SmsBody>(c.req.raw);
  if (!body) return c.json({ success: false, error: "Invalid JSON body" }, 400);

  const { resumeToken, resumeNonce, code } = body;
  if (typeof resumeToken !== "string" || typeof code !== "string" || !resumeToken || !code) {
    return c.json({ success: false, error: "resumeToken and code are required" }, 400);
  }
  if (!/^\d{4,8}$/.test(code)) {
    return c.json(
      { success: false, error: "Enter the code from the message.", reason: "code_rejected" },
      401,
    );
  }

  const sealer = await Sealer.from(c.env.SSO_RESUME_KEY);
  if (!sealer) {
    return c.json(
      {
        success: false,
        error: "Verification by SMS is unavailable here. Please sign in with token instead.",
        reason: "sms_unavailable",
      },
      401,
    );
  }

  // One answer for expired, tampered, replayed-with-the-wrong-nonce, and
  // sealed-under-a-rotated-key: none of them can be distinguished by a client,
  // and all of them require starting over.
  const context = await sealer.open<SecondFactorContext>(
    resumeToken,
    typeof resumeNonce === "string" ? resumeNonce : undefined,
  );
  if (!context) {
    return c.json(
      {
        success: false,
        error: "This verification request has expired. Please sign in again.",
        reason: "challenge_expired",
      },
      401,
    );
  }

  try {
    const { token, durableCookies } = await finishSecondFactor(context, code);
    return c.json({
      success: true,
      token,
      deviceKeepsake: await sealKeepsake(sealer, durableCookies),
    });
  } catch (error) {
    return c.json(failureBody(error), 401);
  }
});

async function readJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

/** Unseal a remembered-device blob, ignoring anything that no longer opens. */
async function openKeepsake(
  sealer: Sealer | null,
  keepsake: unknown,
): Promise<DurableCookie[]> {
  if (!sealer || typeof keepsake !== "string" || !keepsake) return [];
  return (await sealer.open<DurableCookie[]>(keepsake)) ?? [];
}

/**
 * Seal the remembered-device cookies for the browser to hold. Undefined when
 * there is nothing to remember, so the client keeps whatever it already has
 * rather than overwriting it with an empty one.
 */
async function sealKeepsake(
  sealer: Sealer | null,
  cookies: DurableCookie[],
): Promise<string | undefined> {
  if (!sealer || cookies.length === 0) return undefined;
  return sealer.seal(cookies, KEEPSAKE_TTL_SECONDS);
}

function failureBody(error: unknown): { success: false; error: string; reason: string } {
  if (error instanceof CasSignInError) {
    return { success: false, error: error.message, reason: error.reason };
  }
  // Deliberately not the raw error: a fetch failure can carry request detail,
  // and this string goes to the client.
  return {
    success: false,
    error: "Network error or server exception. If this persists, please sign in with token.",
    reason: "network",
  };
}
