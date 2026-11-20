import { describe, expect, it } from 'vitest';
import { UNGROUP_KEPT_BOTH, ungroupByRecreate, type UngroupOps } from './noteUngroup';

/** A notes server that fails at the named step; records every call in order. */
function server(failAt?: string) {
  const calls: string[] = [];
  const step = async <T>(name: string, value: T): Promise<T> => {
    calls.push(name);
    if (name === failAt) throw new Error(`${name} failed`);
    return value;
  };
  const ops: UngroupOps = {
    create: () => step('create', 900),
    setTitle: (id) => step(`title:${id}`, undefined),
    setContent: (id) => step(`content:${id}`, undefined),
    readContent: (id) => step(`read:${id}`, '{"blocks":[1]}'),
    remove: (id) => step(`remove:${id}`, undefined),
    warn: () => {},
  };
  return { ops, calls };
}
const note = { id: 41, title: 'AS · 课程', content: '{"blocks":[1]}' };

describe('ungrouping a note by recreating it', () => {
  it('deletes the original only after the copy was read back', async () => {
    const { ops, calls } = server();
    expect(await ungroupByRecreate(ops, note)).toBe(900);
    expect(calls).toEqual(['create', 'title:900', 'content:900', 'read:900', 'remove:41']);
  });

  it('changes nothing when the copy cannot be created', async () => {
    const { ops, calls } = server('create');
    await expect(ungroupByRecreate(ops, note)).rejects.toThrow('create failed');
    expect(calls).toEqual(['create']);
  });

  it.each(['title:900', 'content:900', 'read:900'])(
    'removes the unfinished copy and keeps the original when %s fails',
    async (failAt) => {
      const { ops, calls } = server(failAt);
      await expect(ungroupByRecreate(ops, note)).rejects.toThrow(`${failAt} failed`);
      expect(calls.at(-1)).toBe('remove:900');
      expect(calls).not.toContain('remove:41');
    },
  );

  it('keeps the original when the copy reads back empty', async () => {
    const { ops, calls } = server();
    ops.readContent = async (id) => {
      calls.push(`read:${id}`);
      return '';
    };
    await expect(ungroupByRecreate(ops, note)).rejects.toThrow('came back empty');
    expect(calls).toEqual(['create', 'title:900', 'content:900', 'read:900', 'remove:900']);
  });

  it('reports the original error even when the copy cannot be removed', async () => {
    const { ops, calls } = server('title:900');
    ops.remove = async (id) => {
      calls.push(`remove:${id}`);
      throw new Error('remove failed');
    };
    await expect(ungroupByRecreate(ops, note)).rejects.toThrow('title:900 failed');
  });

  it('says both notes were kept when the original cannot be deleted', async () => {
    const { ops, calls } = server('remove:41');
    await expect(ungroupByRecreate(ops, note)).rejects.toThrow(UNGROUP_KEPT_BOTH);
    // The complete copy is not removed: it holds the content too.
    expect(calls).not.toContain('remove:900');
  });

  it('copies a note without content, still checking the copy exists', async () => {
    const { ops, calls } = server();
    await ungroupByRecreate(ops, { ...note, content: '' });
    expect(calls).toEqual(['create', 'title:900', 'read:900', 'remove:41']);
  });
});
