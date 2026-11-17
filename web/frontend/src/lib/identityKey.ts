// Cache keys must tell accounts apart without holding the token itself (a key
// can end up in a log). A prefix of the token is not enough: two tokens may
// share one. So each token seen in this page gets a number of its own, and
// the key carries that number. Kept in memory only; a reload starts over,
// which is fine because the caches it keys are in memory too.
const ids = new Map<string, number>();

/** `anon` without a token, else `id<n>`, the same for the same token in this page. */
export function identityKey(token: string | null | undefined): string {
  if (!token) return "anon";
  let id = ids.get(token);
  if (id === undefined) {
    id = ids.size + 1;
    ids.set(token, id);
  }
  return `id${id}`;
}
