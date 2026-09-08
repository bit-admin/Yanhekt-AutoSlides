/**
 * The one production seam the `/demo/` build needs.
 *
 * The demo answers every API call by wrapping `window.fetch` once (see
 * `demo/transport.ts`), so almost nothing in `src/` or `apex/` has to know a
 * demo exists. Two things a fetch wrapper cannot reach get a slot here:
 *
 *  * `viewerHref` — the index links a version with `<a href>`, which is a
 *    navigation, not a fetch. `/demo/v1/s/<id>` is not a real static asset (the
 *    Worker's short-link route is anchored at `/v1/`), so the demo points those
 *    links at a long link instead.
 *  * `resolveImages` — slide pixels arrive through `<img src>` and `new Image()`
 *    in `lib/pdf.ts`, neither of which goes through `fetch`. Faking only the
 *    bucket listing would leave every slide broken.
 *
 * Every read site is guarded by `if (__DEMO__ && demoHooks.x)`. `__DEMO__` is a
 * compile-time constant defined `false` in both production configs, so Rollup
 * drops the branches and none of `demo/` reaches a real build.
 */

import type { SharePayload } from '../../../autoslides/src/shared/shareLink';
import type { ResolvedShareImage } from '../../../autoslides/src/shared/shareResolve';

export interface DemoHooks {
  /** Where a share id opens. The demo has no short-link server, so it hands back a long link. */
  viewerHref?: (shareId: string) => string;
  /** Resolve a payload's images without listing the public coss bucket. */
  resolveImages?: (payload: SharePayload) => Promise<ResolvedShareImage[]>;
}

export const demoHooks: DemoHooks = {};
