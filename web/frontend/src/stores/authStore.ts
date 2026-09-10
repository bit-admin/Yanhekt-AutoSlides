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

function storeToken(value: string | null) {
  const previous = token.value;
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
  isVerifyingToken.value = true;
  try {
    const result = await verifyToken(candidate);
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
    isVerifyingToken.value = false;
  }
}

/** Read + clear a one-shot bookmarklet token for the login paste field. */
function takePendingToken(): string | null {
  const value = pendingToken.value;
  pendingToken.value = null;
  return value;
}

/**
 * Startup: a ?token= query param (bookmarklet return) is stashed for the
 * login form to auto-fill — it is never adopted here. The URL is cleaned so
 * the token never sits in the address bar or history. A stored token is then
 * verified as usual so an existing session still hydrates.
 */
async function initFromUrlOrStorage(): Promise<void> {
  const url = new URL(window.location.href);
  const urlToken = url.searchParams.get("token");

  if (urlToken) {
    url.searchParams.delete("token");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    pendingToken.value = urlToken;
  }

  // A bookmarklet token waiting for review owns the login UI — skip hydrating
  // the stored session so we don't flash the verifying overlay over the form.
  // adoptToken (on Verify) or a later visit will hydrate as usual.
  if (token.value && !pendingToken.value) {
    isVerifyingToken.value = true;
    try {
      const result = await verifyToken(token.value);
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
      isVerifyingToken.value = false;
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
  initFromUrlOrStorage,
  takePendingToken,
  adoptToken,
  loginWithPassword,
  submitSmsCode,
  cancelSmsChallenge,
  signOut,
};
