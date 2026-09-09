// Intranet-aware axios factory, shared by every main-process downloader that
// talks to Yanhekt's CDN.
//
// Campus intranet mode needs two things that a bare axios instance cannot do:
//
//  1. **Source-address binding.** Outbound sockets must leave via the NIC the
//     user selected, or the campus router will not route them. That is an
//     agent-level option (`localAddress`), so the agents have to be built here
//     rather than configured per request.
//  2. **Host preservation.** `rewriteUrl` swaps the hostname for a bare IP, so
//     the upstream vhost would no longer match. The original hostname has to be
//     re-attached as an explicit `Host` header on every request.
//
// Both were previously inlined in the m3u8 downloader. They are extracted here
// because the mic-audio downloader needs byte-identical behaviour: an .aac that
// silently bypassed the intranet path would fail off-VPN in a way that looks
// like a dead URL rather than a routing problem.
import axios, { type AxiosInstance } from 'axios';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import { createLogger } from './logger';

const log = createLogger('IntranetAxios');

/**
 * The slice of the intranet mapping service this module needs.
 *
 * Declared structurally rather than imported: infra/ is foundational and must
 * not depend on platform/. platform's IntranetMappingService satisfies this
 * shape without knowing about it.
 */
export interface IntranetUrlMapper {
  /** Source IP to bind outbound sockets to, or '' / null when unset. */
  getInterfaceIp(): string | null;
  /** Swap the hostname for its intranet IP; returns the input unchanged when inactive. */
  rewriteUrl(url: string): string;
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

export function createIntranetAxios(options: IntranetAxiosOptions): IntranetAxiosBundle {
  const { intranetMapping, isIntranetMode, maxSockets, timeout = 30000 } = options;

  const sockets = Math.max(1, maxSockets);
  const maxFreeSockets = Math.min(4, sockets);
  const httpOpts: http.AgentOptions = {
    keepAlive: true,
    keepAliveMsecs: 10000,
    maxSockets: sockets,
    maxFreeSockets,
  };
  const httpsOpts: https.AgentOptions = {
    keepAlive: true,
    keepAliveMsecs: 10000,
    maxSockets: sockets,
    maxFreeSockets,
  };

  // Bind outbound sockets to the configured intranet interface ONLY in intranet
  // mode; external mode uses unbound agents so ordinary traffic is unaffected.
  // If the saved IP has gone (NIC unplugged, VPN dropped) fall back to unbound
  // rather than letting the bind fail with EADDRNOTAVAIL.
  if (isIntranetMode) {
    const selected = intranetMapping.getInterfaceIp();
    if (selected && isInterfaceIpAvailable(selected)) {
      httpOpts.localAddress = selected;
      httpsOpts.localAddress = selected;
    } else if (selected) {
      log.warn(`Selected intranet interface IP ${selected} is not currently available; falling back to system default.`);
    }
  }

  const httpAgent = new http.Agent(httpOpts);
  const httpsAgent = new https.Agent(httpsOpts);

  const instance = axios.create({ timeout, httpAgent, httpsAgent });

  if (isIntranetMode) {
    instance.interceptors.request.use((config) => {
      if (config.url) {
        const mappedUrl = intranetMapping.rewriteUrl(config.url);
        if (mappedUrl !== config.url) {
          const originalHost = new URL(config.url).hostname;
          config.url = mappedUrl;
          config.headers = config.headers || {};
          config.headers['Host'] = originalHost;
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
