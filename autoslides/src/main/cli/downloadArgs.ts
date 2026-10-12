// Argument parsing for the `download` command. Pure, so it is unit-tested.
import { parseSessionInput } from '@common/sessionInput';

export type CliStream = 'screen' | 'camera';

export interface DownloadOptions {
  sessionId: string;
  /** Streams to fetch, in download order. */
  streams: CliStream[];
  /** One-off output folder; the app's configured folder when absent. */
  outputDir?: string;
  /** Force campus intranet routing for this run. */
  intranet: boolean;
  /** Interface name or local IPv4 address to send intranet traffic from; the one saved in the app when absent. */
  interface?: string;
  /** Replace an existing file instead of refusing. */
  force: boolean;
  verbose: boolean;
}

export type DownloadArgsResult =
  | { kind: 'run'; options: DownloadOptions }
  | { kind: 'help' }
  | { kind: 'version' }
  | { kind: 'error'; message: string };

const STREAM_CHOICES: Record<string, CliStream[]> = {
  screen: ['screen'],
  camera: ['camera'],
  both: ['screen', 'camera'],
};

export function parseDownloadArgs(args: readonly string[]): DownloadArgsResult {
  let target: string | undefined;
  let streams: CliStream[] = STREAM_CHOICES.screen;
  let outputDir: string | undefined;
  let intranet = false;
  let iface: string | undefined;
  let force = false;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // `--name=value` and `--name value` are both accepted.
    const eq = arg.startsWith('--') ? arg.indexOf('=') : -1;
    const name = eq === -1 ? arg : arg.slice(0, eq);
    const takeValue = (): string | undefined => (eq === -1 ? args[++i] : arg.slice(eq + 1));

    switch (name) {
      case '-h':
      case '--help':
        return { kind: 'help' };
      case '-V':
      case '--version':
        return { kind: 'version' };
      case '-o':
      case '--output': {
        const value = takeValue();
        if (!value) return { kind: 'error', message: `${name} needs a folder` };
        outputDir = value;
        break;
      }
      case '-s':
      case '--stream': {
        const value = takeValue();
        const choice = value ? STREAM_CHOICES[value] : undefined;
        if (!choice) return { kind: 'error', message: `${name} must be one of: screen, camera, both` };
        streams = choice;
        break;
      }
      case '--intranet':
        intranet = true;
        break;
      case '--interface': {
        const value = takeValue();
        if (!value) return { kind: 'error', message: `${name} needs an interface name or address` };
        iface = value;
        break;
      }
      case '-f':
      case '--force':
        force = true;
        break;
      case '-v':
      case '--verbose':
        verbose = true;
        break;
      default:
        if (arg.startsWith('-') && arg !== '-') return { kind: 'error', message: `unknown option: ${arg}` };
        if (target !== undefined) return { kind: 'error', message: 'only one session can be given' };
        target = arg;
    }
  }

  if (target === undefined) return { kind: 'error', message: 'missing session link or id' };
  // Only intranet traffic is ever bound to an interface, in the app as here.
  if (iface !== undefined && !intranet) return { kind: 'error', message: '--interface only applies together with --intranet' };

  const parsed = parseSessionInput(target);
  if (parsed.kind === 'course') {
    // Same explanation the Download panel gives (`downloads.bySession.courseNotSession`).
    return {
      kind: 'error',
      message: 'this is a course link. Open a session on Yanhekt and use its link (…/session/<id>) instead.',
    };
  }
  if (parsed.kind !== 'session') {
    return {
      kind: 'error',
      message: `not a session id or Yanhekt session link (such as https://www.yanhekt.cn/session/<id>): ${target}`,
    };
  }

  return { kind: 'run', options: { sessionId: parsed.sessionId, streams, outputDir, intranet, interface: iface, force, verbose } };
}
