// Network lookups behind the intranet route decision: what the campus resolver
// says a Yanhekt host's intranet address is, and whether that address answers.
// Kept apart from IntranetMappingService so the service can be tested with
// both replaced.
import { Resolver } from 'node:dns/promises';
import https from 'node:https';
import net from 'node:net';
import { createLogger } from '@main/infra/logger';

const log = createLogger('IntranetProbe');

/** BIT's campus resolvers. Only reachable from the campus network. */
export const CAMPUS_DNS_SERVERS = ['10.0.32.33', '10.0.32.32'];

const LOOKUP_TIMEOUT_MS = 1500;
const PROBE_TIMEOUT_MS = 1500;

export interface IntranetProbe {
  /** Intranet addresses per hostname, as the campus resolver gives them. Hosts it did not answer for are absent. */
  resolveHosts(hosts: string[], localAddress: string): Promise<Record<string, string[]>>;
  /** Whether `ip` answers HTTPS as `host` with a certificate valid for it. */
  isReachable(ip: string, host: string, localAddress: string): Promise<boolean>;
  /** How long that answer took, in milliseconds, or null when there was none. */
  measure(ip: string, host: string, localAddress: string): Promise<number | null>;
}

/** RFC 1918 space. A campus answer outside it is a public address, not an intranet one. */
export function isPrivateIPv4(ip: string): boolean {
  if (!net.isIPv4(ip)) return false;
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

async function resolveHosts(hosts: string[], localAddress: string): Promise<Record<string, string[]>> {
  const resolver = new Resolver({ timeout: LOOKUP_TIMEOUT_MS, tries: 1 });
  resolver.setServers(CAMPUS_DNS_SERVERS);
  if (localAddress) {
    try {
      resolver.setLocalAddress(localAddress);
    } catch (error) {
      log.debug('Could not bind the campus resolver to', localAddress, error);
    }
  }

  const found: Record<string, string[]> = {};
  await Promise.all(hosts.map(async (host) => {
    try {
      const addresses = (await resolver.resolve4(host)).filter(isPrivateIPv4);
      if (addresses.length > 0) found[host] = addresses;
    } catch {
      // Off campus the resolver is unreachable; the built-in table covers it.
    }
  }));
  return found;
}

function measure(ip: string, host: string, localAddress: string): Promise<number | null> {
  return new Promise<number | null>((resolve) => {
    const startedAt = performance.now();
    let settled = false;
    const finish = (ok: boolean): void => {
      if (settled) return;
      settled = true;
      resolve(ok ? Math.max(1, Math.round(performance.now() - startedAt)) : null);
    };

    // Any HTTP status counts: the point is that the address is the real host
    // (the certificate is checked against `host`), not that this path exists.
    const req = https.request({
      host: ip,
      servername: host,
      headers: { Host: host },
      path: '/',
      method: 'HEAD',
      timeout: PROBE_TIMEOUT_MS,
      localAddress: localAddress || undefined,
      agent: false,
    }, (res) => {
      res.resume();
      finish(true);
    });
    req.on('timeout', () => {
      req.destroy();
      finish(false);
    });
    req.on('error', () => finish(false));
    req.end();
  });
}

async function isReachable(ip: string, host: string, localAddress: string): Promise<boolean> {
  return (await measure(ip, host, localAddress)) !== null;
}

export const networkIntranetProbe: IntranetProbe = { resolveHosts, isReachable, measure };
