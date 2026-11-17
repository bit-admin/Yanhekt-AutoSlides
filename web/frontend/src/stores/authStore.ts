import { computed, ref } from "vue";
import {
  loginWithPassword as apiLogin,
  submitSmsCode as apiSubmitSmsCode,
  verifyToken,
  revokeToken,
  type SignInReason,
  type UserData,
} from "../lib/api";
import { invalidateAll } from "../lib/requestCache";

// Module-singleton auth state (mirrors the desktop app's useAuth shared refs).
// The token persists in localStorage; verification goes through the Worker
// proxy against /v1/user.

const STORAGE_KEY = "autoslides.token";
/**
 * Sealed remembered-device state from the Worker. Opaque here, and persisted on
 * purpose: handing it back is what lets campus SSO skip the SMS second factor.
 * Unlike the resume token below, it is useless without valid credentials.
 */
const KEEPSAKE_KEY = "autoslides.ssoDevice";

const token = ref<string | null>(localStorage.getItem(STORAGE_KEY));
const userData = ref<UserData | null>(null);
const isVerifyingToken = ref(false);
// Bookmarklet return (`?token=`): stash only — LoginPage auto-fills the paste
// field so the user can review and hit Verify. Never auto-adopt.
const pendingToken = ref<string | null>(null);

/**
 * An SMS second factor awaiting a code.
 *
 * `resumeToken` seals the mid-login CAS flow and is a genuine session secret:
 * whoever holds it plus the texted code can finish this sign-in. So it lives
 * here in memory and nowhere else — never localStorage, never sessionStorage,
 * never a log. A page reload correctly loses it and the user starts over.
 */
export interface SmsChallengeState {
  phoneHint: string;
  resumeToken: string;
  resumeNonce: string;
  /** Epoch ms after which the Worker will refuse the code. */
  expiresAt: number;
}

const smsChallenge = ref<SmsChallengeState | null>(null);

const isLoggedIn = computed(() => token.value !== null && userData.value !== null);
const userNickname = computed(() => userData.value?.nickname ?? "");
const userId = computed(() => userData.value?.badge ?? "");

/**
 * Counts identity changes: every stored-token change, so every sign-in,
 * sign-out and account switch, and a sign-in as the same account again. The
 * check of the stored token takes the number when it starts and may only
 * commit (user data, clearing the token, telling the listeners) while it is
 * still the number: an answer about a token that has since been replaced or
 * signed out says nothing about who is signed in now. Comparing tokens would
 * not do: A, B, A is three identities.
 */
let identityGeneration = 0;
/**
 * Sign-in attempts and sign-outs, for `adoptToken`: the newest attempt owns
 * the outcome, and a sign-out while one is being verified cancels it. Kept
 * apart from `identityGeneration` so that the stored-token check finishing
 * (or dropping a dead stored token) does not cancel a sign-in in progress.
 */
let adoptAttempts = 0;
let signOuts = 0;
/** How many verifications are running; `isVerifyingToken` is true while any is. */
let verifications = 0;

function beginVerification(): void {
  verifications += 1;
  isVerifyingToken.value = true;
}

function endVerification(): void {
  verifications -= 1;
  if (verifications === 0) isVerifyingToken.value = false;
}

function storeToken(value: string | null) {
  const previous = token.value;
  identityGeneration += 1;
  token.value = value;
  if (value === null) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, value);
  }
  // Cached reads are keyed on a token prefix, which is a good enough cache key
  // but not a security boundary. Clearing outright on every identity change
  // (sign-in, sign-out, account switch) is trivially correct, and these are
  // rare enough that throwing the cache away costs nothing.
  if (previous !== value) invalidateAll();
}

/**
 * Listeners fired once a token has been verified and `userData` is populated.
 *
 * This hook exists to keep the dependency arrow pointing one way. Things that
 * refresh on sign-in (the subscription list, today) need to read the token, so
 * they import authStore — which means authStore must not import them back.
 * A dynamic import used to paper over that cycle, but it never actually broke
 * it: ten eager modules import subscribedCourses statically, so the bundler
 * kept it in the entry chunk anyway and only warned about the mixed style.
 *
 * Consumers register here instead, and main.ts performs the wiring at startup.
 * A listener that throws must never take down sign-in.
 */
const identityReadyListeners = new Set<() => void>();

export function onIdentityReady(listener: () => void): void {
  identityReadyListeners.add(listener);
}

function notifyIdentityReady(): void {
  for (const listener of identityReadyListeners) {
    try {
      listener();
    } catch {
      /* a failed refresh must not block a successful sign-in */
    }
  }
}

/** Verify + adopt a token (from paste Verify, or password login). */
async function adoptToken(candidate: string): Promise<{ success: boolean; error?: string }> {
  // The newest sign-in attempt owns the outcome: a later one, or a sign-out,
  // while this is being verified makes it a no-op.
  const attempt = ++adoptAttempts;
  const signOutsBefore = signOuts;
  beginVerification();
  try {
    const result = await verifyToken(candidate);
    if (attempt !== adoptAttempts || signOutsBefore !== signOuts) {
      return { success: false, error: "Sign-in was replaced by a newer one" };
    }
    if (result.valid && result.userData) {
      storeToken(candidate);
      userData.value = result.userData;
      notifyIdentityReady();
      return { success: true };
    }
    return {
      success: false,
      error: result.networkError ? "Network error, please try again" : "Invalid token",
    };
  } finally {
    endVerification();
  }
}

/** Read + clear a one-shot bookmarklet token for the login paste field. */
function takePendingToken(): string | null {
  const value = pendingToken.value;
  pendingToken.value = null;
  return value;
}

/**
 * Startup, synchronous: a ?token= query param (bookmarklet return) is stashed
 * for the login form to auto-fill — it is never adopted here. The URL is
 * cleaned so the token never sits in the address bar or history.
 */
function consumeUrlToken(): void {
  const url = new URL(window.location.href);
  const urlToken = url.searchParams.get("token");

  if (urlToken) {
    url.searchParams.delete("token");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    pendingToken.value = urlToken;
  }
}

let storedSessionHydration: Promise<void> | null = null;

/**
 * Verify the stored token (`GET /v1/user`) so an existing session hydrates —
 * at most once per page load, and only when something first needs to know who
 * is signed in. main.ts calls this from a router guard for every route except
 * the `meta.skipSession` ones, so a cold visit to /apps or a legal page costs
 * no Worker request (and, through onIdentityReady, no subscription sync).
 *
 * `isVerifyingToken` flips synchronously, before the first await, so a view
 * set up right after the guard already sees the verifying state.
 */
function ensureStoredSession(): Promise<void> {
  if (!storedSessionHydration) storedSessionHydration = hydrateStoredSession();
  return storedSessionHydration;
}

async function hydrateStoredSession(): Promise<void> {
  // A bookmarklet token waiting for review owns the login UI — skip hydrating
  // the stored session so we don't flash the verifying overlay over the form.
  // adoptToken (on Verify) or a later visit will hydrate as usual.
  if (token.value && !pendingToken.value) {
    const generation = identityGeneration;
    beginVerification();
    try {
      const result = await verifyToken(token.value);
      // Signed out, or signed in as someone else, while the stored token was
      // being checked: this answer is about a token that is no longer the one.
      if (generation !== identityGeneration) return;
      if (result.valid && result.userData) {
        userData.value = result.userData;
        notifyIdentityReady();
      } else if (!result.networkError) {
        // Definitively invalid — clear it. On network errors keep the token
        // so a transient outage doesn't sign the user out.
        storeToken(null);
        userData.value = null;
      }
    } finally {
      endVerification();
    }
  }
}

/** Persist the sealed remembered-device blob whenever the Worker issues a new one. */
function storeKeepsake(keepsake: string | undefined) {
  if (keepsake) localStorage.setItem(KEEPSAKE_KEY, keepsake);
}

export interface SignInAttempt {
  success: boolean;
  error?: string;
  reason?: SignInReason;
  /** True when an SMS code is now required; see `smsChallenge`. */
  smsRequired?: boolean;
}

async function loginWithPassword(username: string, password: string): Promise<SignInAttempt> {
  const result = await apiLogin(username, password, localStorage.getItem(KEEPSAKE_KEY));

  // Password accepted, but campus SSO wants a texted code first.
  if (result.smsRequired) {
    smsChallenge.value = {
      phoneHint: result.smsRequired.phoneHint,
      resumeToken: result.smsRequired.resumeToken,
      resumeNonce: result.smsRequired.resumeNonce,
      expiresAt: Date.now() + result.smsRequired.expiresIn * 1000,
    };
    return { success: false, smsRequired: true };
  }

  if (!result.success || !result.token) {
    return { success: false, error: result.error || "Login failed", reason: result.reason };
  }

  storeKeepsake(result.deviceKeepsake);
  return adoptToken(result.token);
}

/** Answer the pending second factor. Keeps the challenge on a retryable failure. */
async function submitSmsCode(code: string): Promise<SignInAttempt> {
  const challenge = smsChallenge.value;
  if (!challenge) {
    return { success: false, reason: "challenge_expired", error: "Please sign in again" };
  }
  if (Date.now() >= challenge.expiresAt) {
    smsChallenge.value = null;
    return { success: false, reason: "challenge_expired", error: "Please sign in again" };
  }

  const result = await apiSubmitSmsCode(challenge.resumeToken, challenge.resumeNonce, code);

  if (result.success && result.token) {
    // Drop the resume token the moment it is spent.
    smsChallenge.value = null;
    storeKeepsake(result.deviceKeepsake);
    return adoptToken(result.token);
  }

  // The flow behind an expired/spent resume token is gone, so give up the prompt.
  if (result.reason === "challenge_expired") smsChallenge.value = null;

  return { success: false, error: result.error || "Verification failed", reason: result.reason };
}

/** Abandon a pending second factor, discarding the resume token. */
function cancelSmsChallenge() {
  smsChallenge.value = null;
}

function signOut() {
  const current = token.value;
  // Counts even with no token to drop: it cancels a sign-in still being verified.
  signOuts += 1;
  storeToken(null);
  userData.value = null;
  smsChallenge.value = null;
  // The remembered-device blob deliberately survives sign-out: it is what
  // spares the user another SMS next time. Clearing site data drops it.
  // Fire-and-forget server revoke so the UI never waits on the network.
  if (current) void revokeToken(current);
}

export const authStore = {
  token,
  userData,
  isLoggedIn,
  isVerifyingToken,
  pendingToken,
  smsChallenge,
  userNickname,
  userId,
  consumeUrlToken,
  ensureStoredSession,
  takePendingToken,
  adoptToken,
  loginWithPassword,
  submitSmsCode,
  cancelSmsChallenge,
  signOut,
};
