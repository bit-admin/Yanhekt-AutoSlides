import { EventEmitter } from 'events';
import os from 'node:os';
import { ConfigService } from './configService';
import { networkIntranetProbe, type IntranetProbe } from './intranetProbe';
import { resolveBindAddress } from '@main/infra/intranetTransport';
import { createLogger } from '@main/infra/logger';
import type { ConnectionMode } from '@common/types';
const log = createLogger('IntranetMapping');

export interface IntranetMapping {
  type: 'single' | 'loadbalance';
  ip?: string;
  ips?: string[];
  strategy?: 'round_robin' | 'random' | 'first_available';
  currentIndex?: number;
}

export interface IntranetMappings {
  [domain: string]: IntranetMapping;
}

/** One address of a mapped domain and how long it took to answer (null: it did not). */
export interface IntranetAddressProbe {
  ip: string;
  ms: number | null;
}

/** How one download or stream should reach Yanhekt. */
export interface IntranetRoute {
  /** Send mapped hosts to their intranet addresses. */
  intranet: boolean;
  /** Fall back to the public host when an intranet address cannot be connected to. */
  publicFallback: boolean;
}

export interface IntranetNetworkStatus {
  /** The chosen connection mode. */
  mode: ConnectionMode;
  /** Whether requests are going through the intranet right now. */
  enabled: boolean;
  /** Whether the last check could reach the intranet. */
  reachable: boolean;
  /** Whether the address table came from the campus resolver (otherwise the built-in one). */
  resolvedByCampusDns: boolean;
  mappingCount: number;
  interfaceIp: string | null;
}

/** The host whose intranet address stands for "the campus network is reachable". */
const PROBE_HOST = 'cvideo.yanhekt.cn';

/** A check older than this is repeated in the background on next use. */
const STALE_AFTER_MS = 60_000;

/** A burst of failed requests (one per download worker) asks for one re-check, not thirty. */
const FAILURE_RECHECK_GAP_MS = 5_000;

/**
 * The built-in address table, as measured on campus. Used when the campus
 * resolver cannot be asked (off campus, or a router that keeps DNS to itself).
 */
const BUILT_IN_ADDRESSES: Record<string, string[]> = {
  'cbiz.yanhekt.cn': ['10.0.34.22', '10.0.34.21'],
  // Live streaming servers
  'clive8.yanhekt.cn': ['10.1.233.208', '10.1.233.201', '10.1.233.210', '10.1.233.207', '10.1.233.209', '10.1.233.206'],
  'clive9.yanhekt.cn': ['10.1.233.206', '10.1.233.207', '10.1.233.210', '10.1.233.208', '10.1.233.209', '10.1.233.201'],
  'clive10.yanhekt.cn': ['10.1.233.209', '10.1.233.208', '10.1.233.210', '10.1.233.207', '10.1.233.201', '10.1.233.206'],
  'clive11.yanhekt.cn': ['10.1.233.210', '10.1.233.207', '10.1.233.208', '10.1.233.209', '10.1.233.201', '10.1.233.206'],
  'clive12.yanhekt.cn': ['10.1.233.208', '10.1.233.209', '10.1.233.201', '10.1.233.206', '10.1.233.210', '10.1.233.207'],
  'clive13.yanhekt.cn': ['10.1.233.210', '10.1.233.207', '10.1.233.209', '10.1.233.206', '10.1.233.208', '10.1.233.201'],
  'clive14.yanhekt.cn': ['10.0.34.207'],
  'clive15.yanhekt.cn': ['10.0.34.208'],
  // Recorded video server
  'cvideo.yanhekt.cn': ['10.0.34.24'],
  // Yanhe 2.0: one host for its API, recorded media (/play/) and slide images.
  // Its live streams are on the clive hosts above.
  'aita.yanhekt.cn': ['10.0.11.240'],
};

function interfaceSignature(): string {
  const parts: string[] = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (!addr.internal && addr.family === 'IPv4') parts.push(`${name}=${addr.address}`);
    }
  }
  return parts.sort().join(',');
}

/**
 * Decides whether Yanhekt hosts are reached through the campus intranet, and
 * at which addresses.
 *
 * The mode is the user's: `internal` always uses the intranet, `external`
 * never does, `auto` uses it while it can be reached and otherwise the public
 * network. Addresses come from the campus resolver when it answers and from
 * the built-in table when it does not.
 */
export class IntranetMappingService extends EventEmitter {
  private mode: ConnectionMode;
  private interfaceIp: string | null = null;
  /** True once a command line run has pinned mode and interface; nothing is persisted after that. */
  private pinned = false;

  private resolved: Record<string, string[]> = {};
  private reachable = false;
  private checkedAt = 0;
  private checkedSignature: string | null = null;
  private checking: Promise<void> | null = null;

  private roundRobin = new Map<string, number>();
  private failedIPs: Map<string, { failedAt: number; domain: string; ip: string }> = new Map();

  constructor(
    private configService: ConfigService,
    private probe: IntranetProbe = networkIntranetProbe
  ) {
    super();
    this.mode = this.configService.get('connectionMode', 'auto') || 'auto';
    const savedInterfaceIp = this.configService.get('intranetInterfaceIp', '') || '';
    this.interfaceIp = savedInterfaceIp.trim() === '' ? null : savedInterfaceIp.trim();
  }

  // ---- Mode and route -------------------------------------------------------

  /** Follow a change of the connection mode setting. The caller persists it. */
  setMode(mode: ConnectionMode): void {
    if (this.pinned || mode === this.mode) return;
    this.mode = mode;
    void this.refresh();
  }

  getMode(): ConnectionMode {
    return this.mode;
  }

  /**
   * Fix the route for a command line run without saving anything: its flags
   * decide, not the app's settings. `interfaceIp` undefined keeps the saved one.
   */
  pinForThisProcess(mode: 'internal' | 'external', interfaceIp?: string | null): void {
    this.pinned = true;
    this.mode = mode;
    if (interfaceIp !== undefined) this.interfaceIp = interfaceIp;
  }

  /** Whether requests go through the intranet right now. */
  isEnabled(): boolean {
    if (this.mode === 'internal') return true;
    if (this.mode === 'external') return false;
    return this.reachable;
  }

  /** Only Auto may leave the intranet on its own; a forced mode means what it says. */
  allowsPublicFallback(): boolean {
    return this.mode === 'auto';
  }

  /** The route a download or stream starting now should take. Call `ensureFresh()` first. */
  route(): IntranetRoute {
    return { intranet: this.isEnabled(), publicFallback: this.allowsPublicFallback() };
  }

  /**
   * Whether the API may be sent to its intranet address. Stricter than
   * `isEnabled()`: a forced Internal mode off campus must not make every
   * request wait out a dead address, since the app cannot work without the API.
   */
  isApiViaIntranet(): boolean {
    return this.mode !== 'external' && this.reachable;
  }

  // ---- Freshness ------------------------------------------------------------

  /**
   * Make sure the route reflects the current network before it is used. Waits
   * only when there is no check yet or the machine's interfaces changed since;
   * an old check is refreshed in the background, because both wrong answers
   * are survivable (public is slower, a dead intranet falls back or reports).
   */
  async ensureFresh(): Promise<void> {
    if (this.mode === 'external') return;
    if (this.checkedSignature === null || this.checkedSignature !== interfaceSignature()) {
      await this.refresh();
    } else if (Date.now() - this.checkedAt > STALE_AFTER_MS) {
      void this.refresh();
    }
  }

  /** Ask the campus resolver for the addresses and check that the intranet answers. */
  refresh(): Promise<void> {
    this.checking ??= this.runCheck().finally(() => {
      this.checking = null;
    });
    return this.checking;
  }

  /** An intranet address could not be connected to: check again. */
  reportFailure(): void {
    if (this.mode === 'external') return;
    if (Date.now() - this.checkedAt < FAILURE_RECHECK_GAP_MS) return;
    void this.refresh();
  }

  private async runCheck(): Promise<void> {
    const signature = interfaceSignature();
    const before = this.isEnabled();
    const localAddress = resolveBindAddress(this, true);
    const builtInIp = BUILT_IN_ADDRESSES[PROBE_HOST][0];

    // The resolver and the built-in address are tried together, so an
    // unreachable resolver does not double the wait.
    const [resolved, builtInAnswers] = await Promise.all([
      this.probe.resolveHosts(Object.keys(BUILT_IN_ADDRESSES), localAddress),
      this.probe.isReachable(builtInIp, PROBE_HOST, localAddress),
    ]);

    const campusIp = resolved[PROBE_HOST]?.[0];
    let reachable = builtInAnswers;
    if (campusIp && campusIp !== builtInIp) {
      // The resolver is the authority once it disagrees with the table, unless
      // its address is dead and the table's still answers.
      reachable = await this.probe.isReachable(campusIp, PROBE_HOST, localAddress);
      if (!reachable && builtInAnswers) {
        delete resolved[PROBE_HOST];
        reachable = true;
      }
    }

    this.resolved = resolved;
    this.reachable = reachable;
    this.checkedAt = Date.now();
    this.checkedSignature = signature;
    log.debug(`Intranet check: reachable=${reachable}, campus resolver answered for ${Object.keys(resolved).length} hosts`);

    if (this.isEnabled() !== before) {
      log.info(`Intranet route is now ${this.isEnabled() ? 'on' : 'off'} (mode: ${this.mode})`);
      this.emit('routeChanged', this.isEnabled());
    }
  }

  // ---- Interface binding ----------------------------------------------------

  /**
   * Get the local interface IP bound to intranet-mode traffic, or null for system default
   */
  getInterfaceIp(): string | null {
    return this.interfaceIp;
  }

  /**
   * Set the local interface IP for intranet-mode traffic. Pass null/empty to clear.
   */
  setInterfaceIp(ip: string | null): void {
    const normalized = ip && ip.trim() !== '' ? ip.trim() : null;
    if (normalized === this.interfaceIp) {
      return;
    }
    this.interfaceIp = normalized;
    this.configService.set('intranetInterfaceIp', normalized ?? '');
    this.emit('interfaceIpChanged', normalized);
    void this.refresh();
  }

  // ---- Address mapping ------------------------------------------------------

  private addressesFor(domain: string): string[] | null {
    return this.resolved[domain] ?? BUILT_IN_ADDRESSES[domain] ?? null;
  }

  /**
   * Get IP mapping for a specific domain (handles load balancing)
   */
  getMapping(domain: string): string | null {
    const ips = this.addressesFor(domain);
    if (!ips || ips.length === 0) return null;
    if (ips.length === 1) return ips[0];

    // Filter out failed IPs
    let available = ips.filter(ip => !this.isIPFailed(ip));
    if (available.length === 0) {
      log.warn(`All IPs failed for domain: ${domain}, using original list`);
      this.clearFailedIPs(domain);
      available = ips;
    }

    const index = this.roundRobin.get(domain) ?? 0;
    this.roundRobin.set(domain, (index + 1) % available.length);
    return available[index % available.length];
  }

  /**
   * Rewrite URL for intranet mode if enabled
   */
  rewriteUrl(url: string): string {
    return this.isEnabled() ? this.mapUrl(url) : url;
  }

  /**
   * Swap a mapped hostname for its intranet IP, whatever the current route.
   * For callers that fixed their route up front (one download, the command
   * line's `--intranet`); everything else follows the route via `rewriteUrl`.
   */
  mapUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const mappedIP = this.getMapping(urlObj.hostname);

      if (mappedIP) {
        urlObj.hostname = mappedIP;
        return urlObj.toString();
      }
    } catch (error) {
      log.error('Error rewriting URL:', error);
    }

    return url;
  }

  /**
   * Mark an IP as failed for health checking
   */
  markIPFailed(ip: string, domain: string): void {
    const key = `${domain}:${ip}`;
    this.failedIPs.set(key, {
      failedAt: Date.now(),
      domain: domain,
      ip: ip
    });
    log.warn(`Marked IP as failed: ${ip} for domain: ${domain}`);
  }

  /**
   * Check if an IP is marked as failed
   */
  private isIPFailed(ip: string): boolean {
    for (const [key, failInfo] of this.failedIPs.entries()) {
      if (failInfo.ip === ip) {
        // Auto-recover after 5 minutes
        if (Date.now() - failInfo.failedAt > 5 * 60 * 1000) {
          this.failedIPs.delete(key);
          log.debug(`Auto-recovered failed IP: ${ip}`);
          return false;
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Clear failed IPs for a specific domain
   */
  private clearFailedIPs(domain: string): void {
    for (const [key, failInfo] of this.failedIPs.entries()) {
      if (failInfo.domain === domain) {
        this.failedIPs.delete(key);
      }
    }
    log.debug(`Cleared failed IPs for domain: ${domain}`);
  }

  // ---- Status for Settings --------------------------------------------------

  getNetworkStatus(): IntranetNetworkStatus {
    return {
      mode: this.mode,
      enabled: this.isEnabled(),
      reachable: this.reachable,
      resolvedByCampusDns: Object.keys(this.resolved).length > 0,
      mappingCount: Object.keys(BUILT_IN_ADDRESSES).length,
      interfaceIp: this.interfaceIp
    };
  }

  /**
   * Time an answer from every address of one mapped domain, from the selected
   * interface. For the Settings test button only: it changes nothing here.
   */
  async probeDomain(domain: string): Promise<IntranetAddressProbe[]> {
    const ips = this.addressesFor(domain);
    if (!ips) return [];
    const localAddress = resolveBindAddress(this, true);
    return Promise.all(ips.map(async (ip) => ({ ip, ms: await this.probe.measure(ip, domain, localAddress) })));
  }

  /**
   * Get all intranet mappings for display purposes
   */
  getMappings(): IntranetMappings {
    const mappings: IntranetMappings = {};
    for (const domain of Object.keys(BUILT_IN_ADDRESSES)) {
      const ips = this.addressesFor(domain) ?? [];
      mappings[domain] = ips.length === 1
        ? { type: 'single', ip: ips[0] }
        : { type: 'loadbalance', ips: [...ips], strategy: 'round_robin' };
    }
    return mappings;
  }
}
