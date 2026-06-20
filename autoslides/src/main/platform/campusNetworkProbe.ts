import http from 'node:http';
import https from 'node:https';
import { createLogger } from '@main/infra/logger';
import type { CampusProbeResult } from '@common/types';

const log = createLogger('CampusNetworkProbe');

export interface CampusProbeOptions {
  /** Portal host or IP (no scheme), e.g. "10.0.0.55". */
  host: string;
  /** Whether to reach the portal over TLS. */
  useHttps: boolean;
  /** Local interface address to send from, or null for the system default. */
  interfaceIp: string | null;
  /** Hard timeout in milliseconds (default 5000). */
  timeoutMs?: number;
}

/**
 * srun-style portals answer their online-status endpoint as JSONP: the JSON body
 * is wrapped in `<token>( ... )`. Build a throwaway token of our own — the portal
 * simply echoes whatever name we send, so the exact shape is irrelevant.
 */
function makeWrapperToken(): string {
  return `asProbe_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Pull the JSON object out of a `token( ... )` JSONP envelope. */
function unwrapJsonpBody(body: string, token: string): unknown {
  let inner = body.trim();
  const open = `${token}(`;
  if (inner.startsWith(open) && inner.endsWith(')')) {
    inner = inner.slice(open.length, -1);
  } else {
    // Fall back to the first `{ ... }` span if the wrapper differs.
    const first = inner.indexOf('{');
    const last = inner.lastIndexOf('}');
    if (first === -1 || last === -1 || last < first) {
      throw new Error('unrecognized portal response');
    }
    inner = inner.slice(first, last + 1);
  }
  return JSON.parse(inner);
}

/**
 * Probe the campus authentication portal's online-status endpoint to determine
 * whether the current device is on the campus network and authenticated.
 *
 * This re-implements the *idea* of an srun status check against
 * `/cgi-bin/rad_user_info`; it is intentionally read-only and performs no login.
 * Never throws — all failure modes resolve to a structured result so callers can
 * stay non-blocking.
 */
export function probeCampusConnection(opts: CampusProbeOptions): Promise<CampusProbeResult> {
  const { host, useHttps, interfaceIp } = opts;
  const timeoutMs = opts.timeoutMs ?? 5000;
  const token = makeWrapperToken();
  const transport = useHttps ? https : http;

  return new Promise<CampusProbeResult>((resolve) => {
    let settled = false;
    const finish = (result: CampusProbeResult): void => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const query = new URLSearchParams({ callback: token, _: Date.now().toString() });
    const requestOptions: http.RequestOptions = {
      host,
      path: `/cgi-bin/rad_user_info?${query.toString()}`,
      method: 'GET',
      timeout: timeoutMs,
      // Bind to the configured intranet interface when one is selected, mirroring
      // how the video proxy pins its agents (videoProxyService.rebuildAgents).
      localAddress: interfaceIp ?? undefined,
    };

    const req = transport.request(requestOptions, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        try {
          const parsed = unwrapJsonpBody(body, token) as Record<string, unknown>;
          const online = parsed.error === 'ok';
          const ipValue = parsed.client_ip ?? parsed.online_ip;
          const ip = typeof ipValue === 'string' ? ipValue : null;
          finish({ reachable: true, online, ip });
        } catch (err) {
          // The host answered but we couldn't interpret it — count it reachable
          // (so we don't false-alarm) but with unknown online state.
          log.debug('Could not parse portal response:', err);
          finish({ reachable: true, online: null, ip: null, error: 'parse-failed' });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      finish({ reachable: false, online: null, ip: null, error: 'timeout' });
    });

    req.on('error', (err: Error) => {
      log.debug('Portal probe transport error:', err.message);
      finish({ reachable: false, online: null, ip: null, error: err.message });
    });

    req.end();
  });
}
