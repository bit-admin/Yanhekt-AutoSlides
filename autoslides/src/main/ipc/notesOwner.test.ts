import { AsyncLocalStorage } from 'node:async_hooks';
import { describe, expect, it } from 'vitest';
import { NOTES_ACCOUNT_CHANGED, type NotesResult } from '@common/notesTypes';
import { createOwnedNotesDispatch, type OwnedNotesDeps } from './notesOwner';

/** Main as the dispatch sees it: an active account, and a note service that sends with a token. */
function fakeMain() {
  const tokens: Record<string, string> = { A: 'token-a', B: 'token-b' };
  let active: string | null = 'A';
  const pinned = new AsyncLocalStorage<string>();
  const sent: Array<{ call: string; token: string }> = [];
  const send = (call: string): void => {
    sent.push({ call, token: pinned.getStore() ?? (active ? tokens[active] : '') });
  };
  let release: (() => void) | null = null;

  const ok = async (call: string): Promise<NotesResult<unknown>> => {
    send(call);
    return { ok: true, data: call };
  };
  const handlers = {
    list: () => ok('list'),
    get: (id: number) => ok(`get ${id}`),
    create: () => ok('create'),
    updateTitle: () => ok('updateTitle'),
    updateContent: (id: number) => ok(`updateContent ${id}`),
    // Two requests with a wait between them, like the real move.
    moveToGroup: async () => {
      send('move: create');
      await new Promise<void>((resolve) => (release = resolve));
      send('move: delete');
      return { ok: true as const, data: 1 };
    },
    delete: () => ok('delete'),
    groupList: () => ok('groupList'),
    groupCreate: () => ok('groupCreate'),
    groupDelete: () => ok('groupDelete'),
    uploadImage: () => ok('uploadImage'),
  } as unknown as OwnedNotesDeps['handlers'];

  const dispatch = createOwnedNotesDispatch({
    activeAccount: () => (active ? { token: tokens[active], badge: active } : null),
    withToken: (token, fn) => pinned.run(token, fn),
    handlers,
  });
  return { dispatch, sent, switchTo: (badge: string | null) => (active = badge), release: () => release?.() };
}

describe('a note call made for a named account', () => {
  it('goes out with that account\'s token while it is the active one', async () => {
    const main = fakeMain();
    expect(await main.dispatch('A', 'get', [5])).toEqual({ ok: true, data: 'get 5' });
    expect(main.sent).toEqual([{ call: 'get 5', token: 'token-a' }]);
  });

  it('is not sent once another account is active', async () => {
    const main = fakeMain();
    main.switchTo('B');
    expect(await main.dispatch('A', 'updateContent', [5, '{}'])).toEqual({ ok: false, error: NOTES_ACCOUNT_CHANGED });
    expect(main.sent).toEqual([]);
  });

  it('is not sent after signing out', async () => {
    const main = fakeMain();
    main.switchTo(null);
    expect(await main.dispatch('A', 'create', [])).toEqual({ ok: false, error: 'not-signed-in' });
    expect(main.sent).toEqual([]);
  });

  it('finishes with the account it started as when a switch lands between its requests', async () => {
    const main = fakeMain();
    const move = main.dispatch('A', 'moveToGroup', [5, 0, 't']);
    await Promise.resolve();
    main.switchTo('B');
    main.release();
    await move;
    expect(main.sent).toEqual([
      { call: 'move: create', token: 'token-a' },
      { call: 'move: delete', token: 'token-a' },
    ]);
  });

  it('refuses a method outside the list, a missing account and arguments that are not a list', async () => {
    const main = fakeMain();
    for (const [badge, method, args] of [
      ['A', 'downloadImageToFolder', []],
      ['A', 'constructor', []],
      ['', 'get', [1]],
      ['A', 'get', 'x'],
    ] as const) {
      expect((await main.dispatch(badge, method, args)).ok).toBe(false);
    }
    expect(main.sent).toEqual([]);
  });
});
