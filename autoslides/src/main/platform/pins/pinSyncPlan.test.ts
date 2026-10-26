import { describe, expect, it } from 'vitest';
import type { PinnedCourse } from '@common/types';
import { planPinSync, type PinEntry, type PinSiteState } from './pinSyncPlan';

const CURRENT = '2026-2027-1';
const NOW: [string, string] = ['2026-2027', '1'];
const PAST: [string, string] = ['2024-2025', '1'];

function entry(
  id: string,
  opts: { y2?: string; term?: [string, string]; local?: boolean } = {},
): PinEntry {
  const pin: PinnedCourse = {
    id,
    title: `课程${id}`,
    ...(opts.y2 ? { yanhe2Id: opts.y2 } : {}),
    ...(opts.term ? { school_year: opts.term[0], semester: opts.term[1] } : {}),
  };
  return { pin, local: opts.local ?? true, originKeys: [id] };
}

const site = (remote: string[] | null, base: string[] | null = null): PinSiteState => ({
  remote: remote ? new Set(remote) : null,
  base: base ? new Set(base) : null,
});

const off = site(null);
const keys = (plan: ReturnType<typeof planPinSync>) => plan.kept.map((e) => e.pin.id);
const pushes = (plan: ReturnType<typeof planPinSync>) =>
  plan.pushes.map((p) => `${p.site}:${p.on ? '+' : '-'}${p.courseId}`).sort();

describe('planPinSync', () => {
  it('first sync is the union of both sites and here, and fills each site in', () => {
    const plan = planPinSync(
      [
        entry('1', { y2: 'a1', term: NOW }), // here only
        entry('2', { y2: 'a2', term: NOW, local: false }), // Yanhekt only
        entry('yanhe2:a3', { y2: 'a3', local: false }), // Yanhe 2.0 only
      ],
      { yanhekt: site(['2']), yanhe2: site(['a3']) },
      CURRENT,
    );
    expect(keys(plan)).toEqual(['1', '2', 'yanhe2:a3']);
    expect(pushes(plan)).toEqual(['yanhe2:+a1', 'yanhe2:+a2', 'yanhekt:+1']);
  });

  it('removes a course removed on one site from here and from the other site', () => {
    const plan = planPinSync(
      [entry('1', { y2: 'a1', term: NOW })],
      { yanhekt: site(['1'], ['1']), yanhe2: site([], ['a1']) },
      CURRENT,
    );
    expect(keys(plan)).toEqual([]);
    expect(pushes(plan)).toEqual(['yanhekt:-1']);
  });

  it('sends an unpin made here (signed out at the time) to both sites', () => {
    const plan = planPinSync(
      [entry('1', { y2: 'a1', term: NOW, local: false })],
      { yanhekt: site(['1'], ['1']), yanhe2: site(['a1'], ['a1']) },
      CURRENT,
    );
    expect(keys(plan)).toEqual([]);
    expect(pushes(plan)).toEqual(['yanhe2:-a1', 'yanhekt:-1']);
  });

  it('keeps earlier-term pins away from Yanhekt but syncs them with Yanhe 2.0', () => {
    const plan = planPinSync(
      [entry('5', { y2: 'a5', term: PAST })],
      { yanhekt: site([], []), yanhe2: site([], []) },
      CURRENT,
    );
    expect(keys(plan)).toEqual(['5']);
    expect(pushes(plan)).toEqual(['yanhe2:+a5']);
  });

  it('drops an earlier-term pin removed on Yanhe 2.0 even though Yanhekt never lists it', () => {
    const plan = planPinSync(
      [entry('5', { y2: 'a5', term: PAST })],
      { yanhekt: site([], []), yanhe2: site([], ['a5']) },
      CURRENT,
    );
    expect(keys(plan)).toEqual([]);
    expect(pushes(plan)).toEqual([]);
  });

  it('changes nothing on a site that was not reached', () => {
    const plan = planPinSync(
      [entry('1', { y2: 'a1', term: NOW }), entry('yanhe2:a9', { y2: 'a9' })],
      { yanhekt: site(['1'], ['1']), yanhe2: off },
      CURRENT,
    );
    expect(keys(plan)).toEqual(['1', 'yanhe2:a9']);
    expect(pushes(plan)).toEqual([]);
  });

  it('lets an add win over a removal of the same course', () => {
    // Removed here, but bookmarked on Yanhe 2.0 since the last sync.
    const plan = planPinSync(
      [entry('1', { y2: 'a1', term: NOW, local: false })],
      { yanhekt: site(['1'], ['1']), yanhe2: site(['a1'], []) },
      CURRENT,
    );
    expect(keys(plan)).toEqual(['1']);
    expect(pushes(plan)).toEqual([]);
  });

  it('covers a Yanhekt course of unknown term only once Yanhekt lists it', () => {
    const plan = planPinSync(
      [entry('7')],
      { yanhekt: site([], []), yanhe2: off },
      CURRENT,
    );
    expect(keys(plan)).toEqual(['7']);
    expect(pushes(plan)).toEqual([]);
  });

  it('still covers an earlier-term course Yanhekt happens to list', () => {
    const plan = planPinSync(
      [entry('5', { term: PAST, local: false })],
      { yanhekt: site(['5'], ['5']), yanhe2: off },
      CURRENT,
    );
    expect(keys(plan)).toEqual([]);
    expect(pushes(plan)).toEqual(['yanhekt:-5']);
  });
});
