import { beforeEach, describe, expect, it, vi } from 'vitest';

type Pending = { name: string; args: unknown[]; answer: (value: unknown) => void };
const pending = vi.hoisted(() => [] as Pending[]);

vi.mock('../../lib/notes/notesClient', () => {
  const wait = (name: string) => (...args: unknown[]) =>
    new Promise((answer) => pending.push({ name, args, answer }));
  return {
    notesClient: {
      list: wait('list'),
      groupList: wait('groupList'),
      get: wait('get'),
      updateContent: wait('updateContent'),
      moveToGroup: wait('moveToGroup'),
    },
  };
});
vi.mock('../../stores/cloudStorageStore', () => ({ cloudStorageStore: { adoptFromGroups: () => {} } }));
vi.mock('../../lib/notes/noteErrors', () => ({ noteErrorText: (error: string) => error }));

import { useCloudNotes } from './useCloudNotes';

const row = (id: number, title: string) => ({ id, title, note_group_id: 0 });
const page = (...rows: unknown[]) => ({ ok: true, data: { data: rows, last_page: 1 } });
const take = (name: string): Pending => {
  const index = pending.findIndex((call) => call.name === name);
  expect(index).toBeGreaterThanOrEqual(0);
  return pending.splice(index, 1)[0];
};
const flush = async (): Promise<void> => {
  for (let i = 0; i < 6; i += 1) await Promise.resolve();
};

beforeEach(() => {
  pending.length = 0;
});

describe('the web Notes page across a change of identity', () => {
  it('writes nothing that was asked for under the previous identity', async () => {
    const cn = useCloudNotes();
    const first = cn.init();
    const opening = cn.openNote(7);
    const oldList = take('list');
    const oldGroups = take('groupList');
    const oldNote = take('get');

    cn.resetForIdentity();
    expect(cn.busy.value).toBe(false);
    const second = cn.init();
    await flush();

    oldList.answer(page(row(1, 'theirs')));
    oldGroups.answer({ ok: true, data: [{ id: 3, name: 'theirs' }] });
    oldNote.answer({ ok: true, data: { ...row(7, 'theirs'), content: '' } });
    await first;
    expect(await opening).toBeNull();
    expect(cn.allNotes.value).toEqual([]);
    expect(cn.groups.value).toEqual([]);
    expect(cn.selectedNote.value).toBeNull();
    // The new identity's load is still running: its spinner stays.
    expect(cn.busy.value).toBe(true);

    take('list').answer(page(row(2, 'mine')));
    take('groupList').answer({ ok: true, data: [] });
    await second;
    expect(cn.allNotes.value.map((n) => n.title)).toEqual(['mine']);
    expect(cn.busy.value).toBe(false);
    expect(cn.loading.value).toBe(false);
  });

  it('empties the page at once, and ignores an old refusal', async () => {
    const cn = useCloudNotes();
    const load = cn.loadAll();
    take('list').answer(page(row(1, 'one')));
    await load;
    cn.keyword.value = 'x';
    const saving = cn.saveContent(1, '{}');

    cn.resetForIdentity();
    expect(cn.allNotes.value).toEqual([]);
    expect(cn.notes.value).toEqual([]);
    expect(cn.keyword.value).toBe('');
    take('updateContent').answer({ ok: false, error: 'refused' });
    expect(await saving).toBe(false);
    expect(cn.error.value).toBe('');
  });

  it('keeps the list it has when a later page fails', async () => {
    const cn = useCloudNotes();
    const load = cn.loadAll();
    take('list').answer(page(row(1, 'one'), row(2, 'two')));
    await load;

    const reload = cn.loadAll();
    take('list').answer({ ok: true, data: { data: [row(1, 'one')], last_page: 2 } });
    await flush();
    take('list').answer({ ok: false, error: 'network' });
    await reload;
    expect(cn.allNotes.value.map((n) => n.title)).toEqual(['one', 'two']);
    expect(cn.error.value).toBe('network');
  });

  it('shows both notes when an ungroup could not delete the original', async () => {
    const cn = useCloudNotes();
    const load = cn.loadAll();
    take('list').answer(page({ ...row(1, 'one'), note_group_id: 3 }));
    await load;

    const moving = cn.moveNoteToGroup(1, 0);
    take('moveToGroup').answer({ ok: false, error: 'ungroup-kept-both' });
    await flush();
    take('list').answer(page({ ...row(1, 'one'), note_group_id: 3 }, row(900, 'one')));
    expect(await moving).toBeNull();
    expect(cn.allNotes.value.map((n) => n.id)).toEqual([1, 900]);
    expect(cn.error.value).toBe('ungroup-kept-both');
  });
});
