import { NOTES_ACCOUNT_CHANGED, OWNED_NOTE_METHODS, type NotesResult, type OwnedNoteMethod } from '@common/notesTypes';

/**
 * Note calls made for a named account.
 *
 * The renderer learns of an account switch after main has made it, and an
 * operation of several calls (provisioning the managed groups, saving while
 * switching) can be between two of them at that moment. A plain call then
 * goes out with the new account's token. A call made through here names the
 * account it was started for: when that is no longer the active one, nothing
 * is sent and the answer is `account-changed`. When it is, the whole call runs
 * with the token read at the check, so a switch during it cannot move its later
 * requests to another account either.
 */
export interface OwnedNotesDeps {
  /** The active account's token and badge, read together. Null when signed out. */
  activeAccount: () => { token: string; badge: string } | null;
  /** Run `fn` with every note request using `token` (`NotesService.withToken`). */
  withToken: <T>(token: string, fn: () => Promise<T>) => Promise<T>;
  handlers: Record<OwnedNoteMethod, (...args: never[]) => Promise<NotesResult<unknown>>>;
}

const isOwnedMethod = (method: unknown): method is OwnedNoteMethod =>
  typeof method === 'string' && (OWNED_NOTE_METHODS as readonly string[]).includes(method);

export function createOwnedNotesDispatch(deps: OwnedNotesDeps) {
  return async (badge: unknown, method: unknown, args: unknown): Promise<NotesResult<unknown>> => {
    if (typeof badge !== 'string' || !badge || !isOwnedMethod(method) || !Array.isArray(args)) {
      return { ok: false, error: 'invalid note request' };
    }
    const active = deps.activeAccount();
    if (!active) return { ok: false, error: 'not-signed-in' };
    if (active.badge !== badge) return { ok: false, error: NOTES_ACCOUNT_CHANGED };
    const handler = deps.handlers[method] as (...a: unknown[]) => Promise<NotesResult<unknown>>;
    return deps.withToken(active.token, () => handler(...args));
  };
}
