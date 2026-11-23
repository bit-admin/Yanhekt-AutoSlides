import { describe, expect, it, vi } from 'vitest';

vi.mock('@main/infra/logger', () => ({ createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

import { encodeCourseTitle, type CloudCourse } from '@common/courseCloud';
import { CourseCloudStore } from './courseCloudStore';

// Fabricated ids and names.
const c = (id: string): CloudCourse => ({ yanhektId: id, yanhe2Id: '', school_year: '2025', semester: '1', number: '', title: '课程' });

function server(opts: { failDelete?: boolean; lastPage?: number } = {}) {
  const groups = [{ id: 9, name: 'ASsubs' }];
  const notes = [
    { id: 1, title: encodeCourseTitle(c('10')) as string, note_group_id: 9 },
    { id: 2, title: '我自己的笔记', note_group_id: 9 },
    { id: 3, title: encodeCourseTitle(c('30')) as string, note_group_id: 5 },
  ];
  const send = vi.fn(async ({ method, url }: { method: string; url: string }) => {
    const ok = (data: unknown) => ({ status: 200, data: { code: 0, data } });
    if (url.includes('/group/list')) return ok(groups);
    if (url.includes('/note/list')) return ok({ data: notes, last_page: opts.lastPage ?? 1 });
    if (method === 'DELETE' && opts.failDelete) return { status: 200, data: { code: 12101114, data: [] } };
    return ok({ id: 50 });
  });
  return new CourseCloudStore({ getCourseCloudSync: () => true }, { send } as never);
}

describe('CourseCloudStore', () => {
  it('reads only its own notes in its own group', async () => {
    const snapshot = await server().read('t', 'subscribed');
    expect(snapshot.notes.map((n) => n.id)).toEqual([1]);
  });
  it('refuses a list it cannot read whole', async () => {
    await expect(server({ lastPage: 21 }).read('t', 'subscribed')).rejects.toThrow();
  });
  it('still counts a note whose delete failed', async () => {
    expect(await server({ failDelete: true }).reconcile('t', 'subscribed', [])).toEqual(['10']);
  });
  it('drops a note once it is deleted', async () => {
    expect(await server().reconcile('t', 'subscribed', [])).toEqual([]);
  });
});
