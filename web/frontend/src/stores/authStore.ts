import { computed, ref } from "vue";
import { loginWithPassword as apiLogin, verifyToken, type UserData } from "../lib/api";

// Module-singleton auth state (mirrors the desktop app's useAuth shared refs).
// The token persists in localStorage; verification goes through the Worker
// proxy against /v1/user.

const STORAGE_KEY = "autoslides.token";

const token = ref<string | null>(localStorage.getItem(STORAGE_KEY));
const userData = ref<UserData | null>(null);
const isVerifyingToken = ref(false);
// Bookmarklet return (`?token=`): stash only — LoginPage auto-fills the paste
// field so the user can review and hit Verify. Never auto-adopt.
const pendingToken = ref<string | null>(null);

const isLoggedIn = computed(() => token.value !== null && userData.value !== null);
const userNickname = computed(() => userData.value?.nickname ?? "");
const userId = computed(() => userData.value?.badge ?? "");

function storeToken(value: string | null) {
  token.value = value;
  if (value === null) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, value);
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

async function loginWithPassword(
  username: string,
  password: string,
): Promise<{ success: boolean; error?: string }> {
  const result = await apiLogin(username, password);
  if (!result.success || !result.token) {
    return { success: false, error: result.error || "Login failed" };
  }
  return adoptToken(result.token);
}

function signOut() {
  storeToken(null);
  userData.value = null;
}

export const authStore = {
  token,
  userData,
  isLoggedIn,
  isVerifyingToken,
  pendingToken,
  userNickname,
  userId,
  initFromUrlOrStorage,
  takePendingToken,
  adoptToken,
  loginWithPassword,
  signOut,
};
