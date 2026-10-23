/**
 * The one production seam the `/demo/` build needs.
 *
 * The demo answers every API call by wrapping `window.fetch` once (see
 * `demo/transport.ts`), so almost nothing in `src/` has to know a demo
 * exists. One thing a fetch wrapper cannot reach gets a slot here:
 *
 *  * `resolveImages` — slide pixels arrive through `<img src>` and `new Image()`
 *    in `lib/pdf.ts`, neither of which goes through `fetch`. Faking only the
 *    bucket listing would leave every slide broken.
 *
 * Every read site is guarded by `if (__DEMO__ && demoHooks.x)`. `__DEMO__` is a
 * compile-time constant defined `false` in the production config, so Rollup
 * drops the branches and none of `demo/` reaches a real build.
 */

import type { SharePayload } from './shareLink';
import type { ResolvedShareImage } from './shareResolve';

export interface DemoHooks {
  /** Resolve a payload's images without listing the public coss bucket. */
  resolveImages?: (payload: SharePayload) => Promise<ResolvedShareImage[]>;
}

export const demoHooks: DemoHooks = {};
