import { describe, expect, it } from 'vitest';
import { planSubscriptionSync, type SubscriptionPlanInput } from './subscriptionSyncPlan';

const NOW = '2026-2027-1';
const PAST = '2025-2026-2';
const side = (remote: string[], base: string[] | null = remote) => ({
  remote: new Set(remote),
  base: base ? new Set(base) : null,
});
const plan = (over: Partial<SubscriptionPlanInput>) =>
  planSubscriptionSync({
    local: new Set<string>(),
    yanhekt: side([]),
    cloud: side([]),
    termOf: (id) => (id.startsWith('p') ? PAST : NOW),
    currentTerm: NOW,
    ...over,
  });

describe('planSubscriptionSync', () => {
  it('merges every side on a first sync', () => {
    const result = plan({ local: new Set(['1']), yanhekt: side(['2'], null), cloud: side(['3', 'p4'], null) });
    expect(result.kept.sort()).toEqual(['1', '2', '3', 'p4']);
    expect(result.subscribe.sort()).toEqual(['1', '3']);
    expect(result.unsubscribe).toEqual([]);
  });

  it('unsubscribes a course removed from the notes elsewhere', () => {
    const result = plan({ local: new Set(['1']), yanhekt: side(['1']), cloud: side([], ['1']) });
    expect(result.kept).toEqual([]);
    expect(result.unsubscribe).toEqual(['1']);
  });

  it('removes a course unsubscribed in this browser', () => {
    const result = plan({ local: new Set(), yanhekt: side([], ['1']), cloud: side(['1']) });
    expect(result.kept).toEqual([]);
  });

  it('keeps a past course Yanhekt stopped listing and does not send it', () => {
    const result = plan({ local: new Set(['p1']), yanhekt: side([], ['p1']), cloud: side(['p1']) });
    expect(result.kept).toEqual(['p1']);
    expect(result.subscribe).toEqual([]);
  });

  it('does not read a list of another account as removals', () => {
    const result = plan({ local: null, yanhekt: side(['1']), cloud: side(['p2']) });
    expect(result.kept.sort()).toEqual(['1', 'p2']);
    expect(result.unsubscribe).toEqual([]);
  });

  it('lets an add win over a removal', () => {
    const result = plan({ local: new Set(['1']), yanhekt: side(['1'], []), cloud: side([], ['1']) });
    expect(result.kept).toEqual(['1']);
  });

  it('works from Yanhekt alone when the notes could not be read', () => {
    const result = plan({ local: new Set(['p1', '2']), yanhekt: side(['2']), cloud: null });
    expect(result.kept.sort()).toEqual(['2', 'p1']);
    expect(result.unsubscribe).toEqual([]);
  });
});
