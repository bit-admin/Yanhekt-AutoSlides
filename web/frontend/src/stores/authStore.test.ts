import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { valid: boolean; userData?: { badge: string; nickname: string }; networkError?: boolean };
const pending: Array<{ token: string; answer: (result: Result) => void }> = [];

vi.mock("../lib/api", () => ({
  verifyToken: (token: string) => new Promise<Result>((resolve) => pending.push({ token, answer: resolve })),
  revokeToken: async () => {},
  loginWithPassword: async () => ({ success: false }),
  submitSmsCode: async () => ({ success: false }),
}));
vi.mock("../lib/requestCache", () => ({ invalidateAll: () => {} }));

const user = (badge: string): Result => ({ valid: true, userData: { badge, nickname: badge } });
const TOKEN_A = "a".repeat(32);
const TOKEN_B = "b".repeat(32);

/** A fresh store per test: its state is module-level, and hydration runs once per load. */
async function freshStore(stored: string | null) {
  vi.resetModules();
  pending.length = 0;
  localStorage.clear();
  if (stored) localStorage.setItem("autoslides.token", stored);
  const { authStore, onIdentityReady } = await import("./authStore");
  const ready: string[] = [];
  onIdentityReady(() => ready.push(authStore.userId.value));
  return { authStore, ready };
}

beforeEach(() => {
  pending.length = 0;
});

describe("identity across overlapping verifications", () => {
  it("an old token's answer after signing out does not sign the user back in", async () => {
    const { authStore, ready } = await freshStore(TOKEN_A);
    const hydration = authStore.ensureStoredSession();
    authStore.signOut();
    pending[0].answer(user("A"));
    await hydration;
    expect(authStore.isLoggedIn.value).toBe(false);
    expect(authStore.userData.value).toBeNull();
    expect(authStore.token.value).toBeNull();
    expect(ready).toEqual([]);
  });

  it("an old token found invalid does not clear the account signed in since", async () => {
    const { authStore } = await freshStore(TOKEN_A);
    const hydration = authStore.ensureStoredSession();
    const adopt = authStore.adoptToken(TOKEN_B);
    pending[1].answer(user("B"));
    expect(await adopt).toEqual({ success: true });

    pending[0].answer({ valid: false });
    await hydration;
    expect(authStore.token.value).toBe(TOKEN_B);
    expect(authStore.userId.value).toBe("B");
    expect(localStorage.getItem("autoslides.token")).toBe(TOKEN_B);
  });

  it("an old token's user data does not replace the account signed in since", async () => {
    const { authStore, ready } = await freshStore(TOKEN_A);
    const hydration = authStore.ensureStoredSession();
    const adopt = authStore.adoptToken(TOKEN_B);
    pending[1].answer(user("B"));
    await adopt;
    pending[0].answer(user("A"));
    await hydration;
    expect(authStore.userId.value).toBe("B");
    expect(ready).toEqual(["B"]);
  });

  it("of two sign-ins answered out of order, the later one wins", async () => {
    const { authStore, ready } = await freshStore(null);
    const first = authStore.adoptToken(TOKEN_A);
    const second = authStore.adoptToken(TOKEN_B);
    pending[1].answer(user("B"));
    expect(await second).toEqual({ success: true });
    pending[0].answer(user("A"));
    expect((await first).success).toBe(false);
    expect(authStore.token.value).toBe(TOKEN_B);
    expect(authStore.userId.value).toBe("B");
    expect(ready).toEqual(["B"]);
  });

  it("a sign-out while a sign-in is being verified cancels it", async () => {
    const { authStore } = await freshStore(null);
    const adopt = authStore.adoptToken(TOKEN_A);
    authStore.signOut();
    pending[0].answer(user("A"));
    expect((await adopt).success).toBe(false);
    expect(authStore.isLoggedIn.value).toBe(false);
    expect(localStorage.getItem("autoslides.token")).toBeNull();
  });

  it("a dead stored token being dropped does not cancel a sign-in in progress", async () => {
    const { authStore } = await freshStore(TOKEN_A);
    const hydration = authStore.ensureStoredSession();
    const adopt = authStore.adoptToken(TOKEN_B);
    pending[0].answer({ valid: false });
    await hydration;
    pending[1].answer(user("B"));
    expect(await adopt).toEqual({ success: true });
    expect(authStore.userId.value).toBe("B");
  });

  it("a network failure keeps the stored session", async () => {
    const { authStore } = await freshStore(TOKEN_A);
    const hydration = authStore.ensureStoredSession();
    pending[0].answer({ valid: false, networkError: true });
    await hydration;
    expect(authStore.token.value).toBe(TOKEN_A);
  });

  it("stays in the verifying state until every verification has ended", async () => {
    const { authStore } = await freshStore(TOKEN_A);
    const hydration = authStore.ensureStoredSession();
    const adopt = authStore.adoptToken(TOKEN_B);
    pending[0].answer(user("A"));
    await hydration;
    expect(authStore.isVerifyingToken.value).toBe(true);
    pending[1].answer(user("B"));
    await adopt;
    expect(authStore.isVerifyingToken.value).toBe(false);
  });
});
