// Puts the proxy settings into effect on both network stacks: main-process
// requests (`infra/proxyRouting.ts`) and Chromium's sessions, which carry the
// windows, the sign-in and capture webviews, and the renderer's own loads.
import { app, session, type Session } from 'electron';
import type { ProxyMode, ProxySettings } from '@common/types';
import { normalizeProxyUrl } from '@common/proxyUrl';
import { configureProxy, environmentProxy, parsePacResult, setProxyWarningSink, setSystemProxyResolver } from '@main/infra/proxyRouting';
import { createLogger } from '@main/infra/logger';

const log = createLogger('ProxyControl');
const routingLog = createLogger('ProxyRouting');
setProxyWarningSink((message, error) => routingLog.warn(message, error));

/**
 * An in-memory session that is never given a proxy of its own, so asking it
 * answers with what the operating system says.
 */
const PROBE_PARTITION = 'autoslides-proxy-probe';

/** Which group's setting each Chromium session follows. `null` is the default session. */
const SESSIONS: ReadonlyArray<{ partition: string | null; group: 'campus' | 'other' }> = [
  // Main and Tools windows: course covers, the Windows updater's signature fetch.
  { partition: null, group: 'other' },
  // Browser sign-in (campus SSO, Yanhe 2.0).
  { partition: 'persist:browserlogin', group: 'campus' },
  { partition: 'persist:webcapture', group: 'other' },
  { partition: 'persist:yuketang', group: 'other' },
  { partition: 'autoslides-community', group: 'other' },
];

/** Never through a proxy, in any session: this machine and the private ranges the campus uses. */
const PRIVATE_BYPASS = ['<local>', '127.0.0.0/8', '::1', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '169.254.0.0/16'];
const CAMPUS_BYPASS = ['*.yanhekt.cn', 'yanhekt.cn', '*.bit.edu.cn', 'bit.edu.cn'];

/** A probe URL for "does the system name a proxy at all"; any public https host would do. */
const SYSTEM_PROBE_URL = 'https://github.com/';

function probeSession(): Session {
  return session.fromPartition(PROBE_PARTITION);
}

/** NO_PROXY as Chromium bypass rules (`.example.com` → `*.example.com`; `*` is not carried over). */
function environmentBypass(): string[] {
  const raw = process.env.NO_PROXY ?? process.env.no_proxy ?? '';
  return raw.split(/[\s,]+/).filter((e) => e && e !== '*').map((e) => (e.startsWith('.') ? `*${e}` : e));
}

async function chromiumConfig(mode: ProxyMode, settings: ProxySettings, group: 'campus' | 'other'): Promise<Electron.ProxyConfig> {
  // A session for the other group still sends Yanhekt pages (course covers)
  // straight to Yanhekt when that group is set to no proxy. Only expressible
  // with a fixed proxy: a system or PAC proxy cannot be given extra rules.
  const bypass = group === 'other' && settings.campus === 'direct' ? [...PRIVATE_BYPASS, ...CAMPUS_BYPASS] : PRIVATE_BYPASS;
  if (mode === 'direct') return { mode: 'direct' };
  if (mode === 'custom') {
    const proxy = normalizeProxyUrl(settings.customUrl);
    if (!proxy) return { mode: 'direct' };
    return { mode: 'fixed_servers', proxyRules: proxy, proxyBypassRules: bypass.join(',') };
  }
  // System: Chromium reads the OS settings itself. When those say "direct"
  // and the environment names a proxy, use that, as main-process requests do.
  try {
    const os = parsePacResult(await probeSession().resolveProxy(SYSTEM_PROBE_URL));
    const env = os ? null : environmentProxy(SYSTEM_PROBE_URL);
    if (env) {
      return { mode: 'fixed_servers', proxyRules: env, proxyBypassRules: [...bypass, ...environmentBypass()].join(',') };
    }
  } catch (error) {
    log.warn('Could not read the system proxy settings for the browser sessions.', error);
  }
  return { mode: 'system' };
}

async function applyToSessions(settings: ProxySettings): Promise<void> {
  await Promise.all(SESSIONS.map(async ({ partition, group }) => {
    const ses = partition ? session.fromPartition(partition) : session.defaultSession;
    const mode = group === 'campus' ? settings.campus : settings.other;
    try {
      await ses.setProxy(await chromiumConfig(mode, settings, group));
    } catch (error) {
      log.warn(`Could not set the proxy for session ${partition ?? 'default'}.`, error);
    }
  }));
}

/**
 * Apply `settings` everywhere. Main-process requests follow at once; the
 * Chromium sessions follow once the app is ready (a call before that applies
 * them on `ready`).
 */
export function applyProxySettings(settings: ProxySettings): Promise<void> {
  configureProxy(settings);
  if (!app.isReady()) {
    return app.whenReady().then(() => applyToSessions(settings));
  }
  return applyToSessions(settings);
}

/** Let `system` read the OS settings. Call once the app is ready. */
export function installSystemProxyResolver(): void {
  const probe = probeSession();
  setSystemProxyResolver((url) => probe.resolveProxy(url));
}
