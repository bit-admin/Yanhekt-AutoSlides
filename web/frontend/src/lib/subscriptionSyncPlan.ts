/**
 * Which subscriptions stay and what to send Yanhekt, for one account's sync.
 * Each side is compared with what it held after the last sync (its base):
 *
 * | in base | on side now | subscribed here | signal                   |
 * |---------|-------------|-----------------|--------------------------|
 * | yes     | no          | any             | removed on that side     |
 * | yes     | yes         | no              | removed here             |
 * | no      | yes         | any             | added on that side       |
 *
 * A course stays when a side added it, or when it is here and no side removed
 * it. Add wins a conflict. A side with no base merges as a first sync.
 *
 * Yanhekt's list does not return earlier terms, so a past course missing from
 * it says nothing, and is never sent to it. Pure.
 */
export interface SyncSide {
  remote: ReadonlySet<string>;
  base: ReadonlySet<string> | null;
}

export interface SubscriptionPlanInput {
  /** This browser's list; null when it is not known to be this account's. */
  local: ReadonlySet<string> | null;
  yanhekt: SyncSide;
  /** The account's course notes; null when they could not be read. */
  cloud: SyncSide | null;
  termOf: (id: string) => string | null;
  currentTerm: string | null;
}

export interface SubscriptionPlan {
  kept: string[];
  subscribe: string[];
  unsubscribe: string[];
}

export function planSubscriptionSync(input: SubscriptionPlanInput): SubscriptionPlan {
  const { yanhekt, cloud, termOf, currentTerm } = input;
  const remote = [...yanhekt.remote, ...(cloud?.remote ?? [])];
  const local = input.local ?? new Set(remote);
  const plan: SubscriptionPlan = { kept: [], subscribe: [], unsubscribe: [] };

  for (const id of new Set([...local, ...remote])) {
    const here = local.has(id);
    const onYanhekt = yanhekt.remote.has(id);
    const coversYanhekt = onYanhekt || (!!currentTerm && termOf(id) === currentTerm);
    const sides = coversYanhekt ? [yanhekt] : [];
    if (cloud) sides.push(cloud);

    let added = false;
    let removed = false;
    for (const side of sides) {
      const on = side.remote.has(id);
      const inBase = !!side.base?.has(id);
      if (inBase && (!on || !here)) removed = true;
      else if (!inBase && on) added = true;
    }
    const keep = added || (here && !removed);
    if (keep) plan.kept.push(id);
    if (coversYanhekt && keep && !onYanhekt) plan.subscribe.push(id);
    if (coversYanhekt && !keep && onYanhekt) plan.unsubscribe.push(id);
  }
  return plan;
}
