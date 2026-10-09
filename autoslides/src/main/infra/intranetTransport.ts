// The one place that knows how a request reaches Yanhekt's CDN over the campus
// intranet. Every main-process caller (m3u8 downloader, mic-audio downloader,
// playback proxy, LAN relay) goes through here.
//
// Campus intranet mode needs two things that a bare axios request cannot do:
//
//  1. **Source-address binding.** Outbound sockets must leave via the NIC the
//     user selected, or the campus router will not route them. That is an
//     agent-level option (`localAddress`), so the agents have to be built here
//     rather than configured per request.
//  2. **Host preservation.** The mapping swaps the hostname for a bare IP, so
//     the upstream vhost would no longer match. The original hostname has to be
//     re-attached as an explicit `Host` header on every request. Node also takes
//     the TLS server name from that header, so the certificate is still checked
//     against the real hostname.
//
// Two shapes are offered because the callers differ in lifetime:
//
//  - `IntranetAgentPool` for long-lived servers (playback proxy, LAN relay)
//    that follow the live setting request by request.
//  - `createIntranetAxios` for one download, which takes a snapshot of the
//    mode when it starts and keeps it until it ends.
import axios, { type AxiosInstance } from 'axios';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import { createLogger } from './logger';

const log = createLogger('IntranetTransport');

/**
 * The slice of the intranet mapping service this module needs.
 *
 * Declared structurally rather than imported: infra/ is foundational and must
 * not depend on platform/. platform's IntranetMappingService satisfies this
 * shape without knowing about it.
 */
export interface IntranetUrlMapper {
  /** Whether the app's live setting currently routes through the intranet. */
  isEnabled(): boolean;
  /** Source IP to bind outbound sockets to, or '' / null when unset. */
  getInterfaceIp(): string | null;
  /** Swap the hostname for its intranet IP when the live setting is on; otherwise the input. */
  rewriteUrl(url: string): string;
  /** Swap the hostname for its intranet IP regardless of the live setting. */
  mapUrl(url: string): string;
}

export interface IntranetAgents {
  httpAgent: http.Agent;
  httpsAgent: https.Agent;
  httpsAgentNoVerify: https.Agent;
}

export interface IntranetTarget {
  /** The URL to request: the input, or the input with its host swapped for an IP. */
  url: string;
  /** The original hostname to send as `Host`, or null when the URL was not remapped. */
  host: string | null;
}

/** True when the saved interface IP is still present on a live, non-internal NIC. */
export function isInterfaceIpAvailable(ip: string): boolean {
  const ifaces = os.networkInterfaces();
  for (const addrs of Object.values(ifaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (!addr.internal && addr.address === ip) return true;
    }
  }
  return false;
}

/**
 * The local address intranet sockets should bind to, or '' for the system
 * default. If the saved IP has gone (NIC unplugged, VPN dropped) this falls
 * back to unbound rather than letting the bind fail with EADDRNOTAVAIL.
 */
export function resolveBindAddress(mapper: IntranetUrlMapper, intranetActive: boolean): string {
  if (!intranetActive) return '';
  const selected = mapper.getInterfaceIp();
  if (!selected) return '';
  if (isInterfaceIpAvailable(selected)) return selected;
  log.warn(`Selected intranet interface IP ${selected} is not currently available; falling back to system default.`);
  return '';
}

/**
 * Pair a remapped URL with the hostname it must still present. `map` is the
 * mapper method to apply: `rewriteUrl` to follow the live setting, `mapUrl`
 * for a caller that has already decided to use the intranet.
 */
export function intranetTarget(url: string, map: (url: string) => string): IntranetTarget {
  const mapped = map(url);
  if (mapped === url) return { url, host: null };
  return { url: mapped, host: new URL(url).hostname };
}

/**
 * Keep-alive agents for a long-lived server. `resolve()` returns agents bound
 * to the currently selected interface while intranet mode is on, rebuilding
 * them only when that binding changes.
 */
export class IntranetAgentPool {
  private agents: IntranetAgents;
  /** The local IP the agents are bound to ('' means unbound / system default). */
  private boundAddress = '';

  constructor(private mapper: IntranetUrlMapper) {
    this.agents = IntranetAgentPool.build('');
  }

  resolve(): IntranetAgents {
    const desired = resolveBindAddress(this.mapper, this.mapper.isEnabled());
    if (desired !== this.boundAddress) {
      this.rebuild(desired);
    }
    return this.agents;
  }

  /** Close every socket and return to unbound agents; the next `resolve()` rebinds if needed. */
  reset(): void {
    this.rebuild('');
  }

  private rebuild(localAddress: string): void {
    try {
      this.agents.httpAgent.destroy();
      this.agents.httpsAgent.destroy();
      this.agents.httpsAgentNoVerify.destroy();
    } catch {
      // Ignore destroy errors on stale agents.
    }
    this.agents = IntranetAgentPool.build(localAddress);
    this.boundAddress = localAddress;
  }

  private static build(localAddress: string): IntranetAgents {
    const bind = localAddress ? { localAddress } : {};
    return {
      httpAgent: new http.Agent({ keepAlive: true, ...bind }),
      httpsAgent: new https.Agent({ keepAlive: true, ...bind }),
      httpsAgentNoVerify: new https.Agent({ keepAlive: true, rejectUnauthorized: false, ...bind }),
    };
  }
}

export interface IntranetAxiosOptions {
  intranetMapping: IntranetUrlMapper;
  /** Captured per download, not read live, so a mid-flight settings change cannot half-apply. */
  isIntranetMode: boolean;
  /** Connection pool size; a single-file download wants 1, the TS pool wants its worker count. */
  maxSockets: number;
  timeout?: number;
}

export interface IntranetAxiosBundle {
  instance: AxiosInstance;
  /** Callers own the agents' lifetime — destroy them when the download ends. */
  destroy(): void;
}

export function createIntranetAxios(options: IntranetAxiosOptions): IntranetAxiosBundle {
  const { intranetMapping, isIntranetMode, maxSockets, timeout = 30000 } = options;

  const sockets = Math.max(1, maxSockets);
  const agentOpts: http.AgentOptions = {
    keepAlive: true,
    keepAliveMsecs: 10000,
    maxSockets: sockets,
    maxFreeSockets: Math.min(4, sockets),
  };

  // Bind ONLY in intranet mode; external mode uses unbound agents so ordinary
  // traffic is unaffected.
  const localAddress = resolveBindAddress(intranetMapping, isIntranetMode);
  if (localAddress) {
    agentOpts.localAddress = localAddress;
  }

  const httpAgent = new http.Agent(agentOpts);
  const httpsAgent = new https.Agent(agentOpts);

  const instance = axios.create({ timeout, httpAgent, httpsAgent });

  if (isIntranetMode) {
    // `mapUrl`, not `rewriteUrl`: the mode was decided when this download
    // started. Following the live setting here would leave a download that is
    // already bound to the campus NIC requesting public hosts.
    instance.interceptors.request.use((config) => {
      if (config.url) {
        const target = intranetTarget(config.url, (u) => intranetMapping.mapUrl(u));
        if (target.host) {
          config.url = target.url;
          config.headers = config.headers || {};
          config.headers['Host'] = target.host;
        }
      }
      return config;
    });
  }

  return {
    instance,
    destroy() {
      httpAgent.destroy();
      httpsAgent.destroy();
    },
  };
}
