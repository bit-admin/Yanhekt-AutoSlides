/**
 * Which request of a kind is the newest one.
 *
 * `begin()` starts a request and returns its check: true until a later
 * `begin()` or a `cancel()`. A request reads the check after every await,
 * before it writes a result, an error or a loading flag, so an answer that
 * arrives late (another account, another keyword, a signed-out page) writes
 * nothing. Each page keeps its own: there is no global one, because what makes
 * a request stale differs per page.
 *
 * Not an abort: the request itself still completes, and a write that already
 * reached a server stays written.
 */
export interface Latest {
  begin(): () => boolean
  cancel(): void
}

export function createLatest(): Latest {
  let newest = 0
  return {
    begin() {
      const mine = ++newest
      return () => mine === newest
    },
    cancel() {
      newest += 1
    },
  }
}
