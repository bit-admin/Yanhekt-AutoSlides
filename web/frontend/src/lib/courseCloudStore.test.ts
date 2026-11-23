import { describe, expect, it, vi } from 'vitest';
import { CourseCloudStore, type CourseCloudSend } from './courseCloudStore';

const title = (id: string) => `AS1|${id}||2025-2026-1|N${id}|Course ${id}`;

function fakeSend(notes: Array<{ id: number; title: string; note_group_id: number }>) {
  return async (method: string, path: string) => {
    if (method === 'GET' && path.startsWith('/v1/note/group/list')) return [{ id: 7, name: 'ASsubs' }, { id: 8, name: 'Mine' }];
    if (method === 'GET') return { data: notes, last_page: 1 };
    if (method === 'POST') return { id: 99 };
    return null;
  };
}
const asSend = (fn: (method: string, path: string) => Promise<unknown>) => vi.fn(fn) as unknown as CourseCloudSend;

describe('CourseCloudStore', () => {
  it('reads only AutoSlides notes in the group', async () => {
    const send = asSend(fakeSend([
      { id: 1, title: title('11'), note_group_id: 7 },
      { id: 2, title: 'my own note', note_group_id: 7 },
      { id: 3, title: title('33'), note_group_id: 8 },
    ]));
    const snapshot = await new CourseCloudStore(send).read('t', 'subscribed');
    expect(snapshot.groupId).toBe(7);
    expect(snapshot.notes.map((n) => n.id)).toEqual([1]);
  });

  it('keeps a note whose delete failed in the result', async () => {
    const base = fakeSend([{ id: 1, title: title('11'), note_group_id: 7 }]);
    const send = asSend(async (method, path) => {
      if (method === 'DELETE') throw new Error('nope');
      return base(method, path);
    });
    const store = new CourseCloudStore(send);
    const held = await store.reconcile('t', 'subscribed', [], await store.read('t', 'subscribed'));
    expect(held).toEqual(['11']);
  });
});
