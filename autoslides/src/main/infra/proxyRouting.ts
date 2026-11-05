// Which proxy, if any, a main-process request goes through.
//
// Hosts fall into two groups, each with its own setting (Settings → Network →
// Proxy): Yanhekt and campus sign-in, and everything else (AI, our own
// ruc.edu.kg services, GitHub, Notion, …). A setting is one of:
//
//  - `direct`: no proxy.
//  - `system`: what the operating system says for that URL (proxy settings or
//    a PAC file, read through Chromium), and the HTTPS_PROXY / HTTP_PROXY /
//    NO_PROXY environment variables when the system says to connect directly.
//  - `custom`: the one proxy URL in `customUrl` (http, https or socks).
//
// Two kinds of request always connect directly, whatever the settings say:
// loopback / private addresses (the local playback proxy, a local AI server,
// the campus addresses), and any request already rewritten onto a campus
// address. A proxy cannot reach the campus network, and tunnelling a rewritten
// request makes the TLS server name an IP, which the campus servers answer
// with the wrong certificate (issue #44).
import net from 'node:net';
import type http from 'node:http';
import type https from 'node:https';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { getProxyForUrl } from 'proxy-from-env';
import type { ProxyMode, ProxySettings } from '@common/types';
import { normalizeProxyUrl } from '@common/proxyUrl';

// No logger import: this module sits under `./http`, which modules tested
// without Electron load. Main installs a sink (`setProxyWarningSink`).
let warn: (message: string, error?: unknown) => void = () => {};

export function setProxyWarningSink(sink: (message: string, error?: unknown) => void): void {
  warn = sink;
}

export type HostGroup = 'local' | 'campus' | 'other';

/** Registrable domains of the campus group. A subdomain belongs to its parent's group. */
const CAMPUS_DOMAINS = ['yanhekt.cn', 'bit.edu.cn'];

/** Until main applies the saved settings (and in unit tests) nothing is proxied. */
let settings: ProxySettings = { campus: 'direct', other: 'direct', customUrl: '' };

/**
 * Asks the operating system which proxy to use for a URL, in PAC form
 * ("PROXY host:port; DIRECT"). Main installs one built on Electron's
 * `session.resolveProxy`; without it, `system` reads only the environment.
 */
export type SystemProxyResolver = (url: string) => Promise<string>;
let systemResolver: SystemProxyResolver | null = null;

/** System answers, per scheme + host, for a short while: one lookup per page of requests, not per request. */
const SYSTEM_CACHE_MS = 30_000;
const systemCache = new Map<string, { proxy: string | null; at: number }>();

export interface ProxyAgents {
  httpAgent: http.Agent;
  httpsAgent: https.Agent;
}
const agentCache = new Map<string, ProxyAgents>();

export function configureProxy(next: ProxySettings): void {
  settings = { ...next };
  systemCache.clear();
  // Requests already running keep their agent; only idle sockets are closed,
  // so a settings change never cuts a download short.
  for (const agents of agentCache.values()) closeIdleSockets(agents.httpAgent);
  agentCache.clear();
}

export function getProxySettings(): ProxySettings {
  return { ...settings };
}

export function setSystemProxyResolver(resolver: SystemProxyResolver | null): void {
  systemResolver = resolver;
  systemCache.clear();
}

function closeIdleSockets(agent: http.Agent): void {
  for (const sockets of Object.values(agent.freeSockets)) {
    for (const socket of sockets ?? []) socket.destroy();
  }
}

function bareHost(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
}

function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 169 && b === 254)
      || (a === 100 && b >= 64 && b <= 127);
  }
  const v6 = ip.toLowerCase();
  if (v6 === '::1' || v6 === '::') return true;
  if (v6.startsWith('::ffff:')) return isPrivateAddress(v6.slice(7));
  return /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6);
}

export function hostGroup(hostname: string): HostGroup {
  const host = bareHost(hostname);
  if (host === 'localhost' || host.endsWith('.localhost')) return 'local';
  if (net.isIP(host)) return isPrivateAddress(host) ? 'local' : 'other';
  if (CAMPUS_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) return 'campus';
  return 'other';
}

/** The setting that applies to a group; `local` is always direct. */
export function modeForGroup(group: HostGroup, current: ProxySettings = settings): ProxyMode {
  if (group === 'local') return 'direct';
  return group === 'campus' ? current.campus : current.other;
}

/**
 * The first entry of a PAC answer as a proxy URL, or null for DIRECT.
 * "PROXY h:p" → http, "HTTPS h:p" → https, "SOCKS h:p" → socks4, "SOCKS5 h:p" → socks5.
 */
export function parsePacResult(pac: string): string | null {
  const first = pac.split(';')[0]?.trim() ?? '';
  const [kind, hostPort] = first.split(/\s+/);
  if (!kind || !hostPort) return null;
  switch (kind.toUpperCase()) {
    case 'PROXY': return `http://${hostPort}`;
    case 'HTTPS': return `https://${hostPort}`;
    case 'SOCKS':
    case 'SOCKS4': return `socks4://${hostPort}`;
    case 'SOCKS5': return `socks5://${hostPort}`;
    default: return null;
  }
}

/** The proxy the environment variables name for a URL (honours NO_PROXY), or null. */
export function environmentProxy(url: string): string | null {
  return getProxyForUrl(url) || null;
}

async function systemProxy(url: URL): Promise<string | null> {
  const key = `${url.protocol}//${url.host}`;
  const hit = systemCache.get(key);
  if (hit && Date.now() - hit.at < SYSTEM_CACHE_MS) return hit.proxy;
  let proxy: string | null = null;
  if (systemResolver) {
    try {
      proxy = parsePacResult(await systemResolver(url.href));
    } catch (error) {
      warn('Could not read the system proxy settings; connecting directly.', error);
    }
  }
  proxy ??= environmentProxy(url.href);
  systemCache.set(key, { proxy, at: Date.now() });
  return proxy;
}

let warnedBadCustom = '';

/** The proxy URL a request to `url` should use, or null to connect directly. */
export async function proxyForUrl(url: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  const mode = modeForGroup(hostGroup(parsed.hostname));
  if (mode === 'direct') return null;
  if (mode === 'custom') {
    const custom = normalizeProxyUrl(settings.customUrl);
    if (!custom && warnedBadCustom !== settings.customUrl) {
      warnedBadCustom = settings.customUrl;
      warn('The custom proxy address is empty or not valid; connecting directly.');
    }
    return custom;
  }
  return systemProxy(parsed);
}

/** Keep-alive agents that tunnel through `proxyUrl`, shared by every request using that proxy. */
export function agentsForProxy(proxyUrl: string): ProxyAgents {
  const cached = agentCache.get(proxyUrl);
  if (cached) return cached;
  let agents: ProxyAgents;
  if (proxyUrl.startsWith('socks')) {
    const agent = new SocksProxyAgent(proxyUrl, { keepAlive: true });
    agents = { httpAgent: agent, httpsAgent: agent as unknown as https.Agent };
  } else {
    // CONNECT tunnels for both schemes; TLS to the target uses the target's
    // own hostname as the server name.
    const agent = new HttpsProxyAgent(proxyUrl, { keepAlive: true });
    agents = { httpAgent: agent, httpsAgent: agent as unknown as https.Agent };
  }
  agentCache.set(proxyUrl, agents);
  return agents;
}

/** Agents for a request to `url`, or null when it connects directly. */
export async function proxyAgentsFor(url: string): Promise<ProxyAgents | null> {
  const proxy = await proxyForUrl(url);
  return proxy ? agentsForProxy(proxy) : null;
}

/** A proxy URL fit for a log line: no credentials. */
export function describeProxy(proxyUrl: string | null): string {
  if (!proxyUrl) return 'direct';
  try {
    const u = new URL(proxyUrl);
    return `${u.protocol}//${u.host}`;
  } catch {
    return 'proxy';
  }
}

const PROXY_ENV_KEYS = ['http_proxy', 'HTTP_PROXY', 'https_proxy', 'HTTPS_PROXY', 'all_proxy', 'ALL_PROXY', 'no_proxy', 'NO_PROXY'];

/**
 * The environment for a child process (ffmpeg) that will fetch `url` itself:
 * the proxy variables replaced by the route this module picks. ffmpeg can only
 * use an http proxy, so a socks or https proxy means a direct connection.
 */
export async function childProcessEnv(url: string): Promise<NodeJS.ProcessEnv> {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of PROXY_ENV_KEYS) delete env[key];
  const proxy = await proxyForUrl(url);
  if (proxy?.startsWith('http://')) env.http_proxy = proxy;
  return env;
}
