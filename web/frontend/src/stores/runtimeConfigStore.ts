/**
 * Deploy-time facts the SPA cannot infer, read once from `GET /api/config`.
 *
 * Currently: where recorded HLS comes from (this origin via the Worker's relay
 * binding, or the relay's public origin the browser must reach itself — see
 * `web/src/lib/relayPolicy.ts`), plus the viewer's own network as Cloudflare
 * reports it, which lets the player explain a relay failure concretely.
 *
 * Deliberately not persisted: it is server truth, not a preference, and it can
 * change under us on any deploy. Any failure falls back to same-origin — the
 * pre-existing behaviour — so a config hiccup never costs playback.
 */
import { ref } from "vue";

export interface RuntimeRelayConfig {
  mode: "binding" | "direct";
  /** Public relay origin — present only in `direct` mode. */
  origin?: string;
}

export interface RuntimeNetworkInfo {
  /** Cloudflare's ASN for this viewer; absent when the edge didn't report one. */
  asn?: number;
  /** Whether that network is one the relay is expected to admit. */
  onAllowlist: boolean;
}

export interface RuntimeConfig {
  relay: RuntimeRelayConfig;
  network: RuntimeNetworkInfo;
}

const FALLBACK: RuntimeConfig = { relay: { mode: "binding" }, network: { onAllowlist: false } };

const config = ref<RuntimeConfig>(FALLBACK);
let inflight: Promise<RuntimeConfig> | null = null;

function normalize(raw: unknown): RuntimeConfig {
  const data = (raw ?? {}) as Partial<RuntimeConfig>;
  const relay = data.relay;
  const network = data.network;
  return {
    relay:
      relay?.mode === "direct" && typeof relay.origin === "string" && relay.origin
        ? { mode: "direct", origin: relay.origin.replace(/\/+$/, "") }
        : { mode: "binding" },
    network: {
      ...(typeof network?.asn === "number" ? { asn: network.asn } : {}),
      onAllowlist: network?.onAllowlist === true,
    },
  };
}

/** Fetch once per page load; later callers reuse the result (or the in-flight promise). */
export function ensureRuntimeConfig(): Promise<RuntimeConfig> {
  if (!inflight) {
    inflight = fetch("/api/config", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((raw) => {
        config.value = normalize(raw);
        return config.value;
      })
      .catch(() => {
        // Keep the same-origin fallback; playback is more important than policy.
        config.value = FALLBACK;
        return config.value;
      });
  }
  return inflight;
}

export const runtimeConfigStore = { config, ensureRuntimeConfig };
