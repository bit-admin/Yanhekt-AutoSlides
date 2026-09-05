/**
 * `GET /api/config` — the handful of deploy-time facts the SPA cannot know on
 * its own. Read once at startup and before recorded playback.
 *
 * `relay` says where recorded HLS comes from (see lib/relayPolicy.ts): this
 * origin, or the relay's public origin the browser must reach itself.
 *
 * `network` is the caller's own ASN, which Cloudflare hands us for free on
 * this request. It is echoed back to the visitor only — nothing is stored —
 * and lets the player say something concrete when playback fails on a network
 * the relay is not expected to admit.
 */
import { Hono } from "hono";
import type { Env } from "../env";
import { isCampusAsn, resolveRelayPolicy } from "../lib/relayPolicy";

export const configRouter = new Hono<{ Bindings: Env }>();

configRouter.get("/", (c) => {
  const policy = resolveRelayPolicy(c.env);
  const asn = (c.req.raw as { cf?: { asn?: number } }).cf?.asn;

  return c.json(
    {
      relay: policy,
      network: {
        ...(typeof asn === "number" ? { asn } : {}),
        onAllowlist: isCampusAsn(asn),
      },
    },
    200,
    { "Cache-Control": "no-store" },
  );
});
