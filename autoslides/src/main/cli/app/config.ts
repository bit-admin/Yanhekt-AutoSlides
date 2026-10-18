// `autoslides config [key]`: the app settings the commands follow, read-only.
//
// Only the keys in `SETTINGS` are shown, never the whole config: the stored
// config also holds account tokens (`accounts`, the relay whitelist), personal
// paths and internal state. Each key is a setting the commands obey (where
// files go, which route, what runs after a download), under a stable CLI name
// independent of the store's. Yanhekt only: no Yanhe 2.0 setting is listed
// (the CLI does not cover Yanhe 2.0 while it is in beta).
//
// Nothing here writes; settings change in the app.
import type { AppConfig } from '@common/types';
import { CliError } from '../errors';
import { table } from '../format';
import type { CommandInput, CommandResult } from '../types';
import { requireSignIn } from './signIn';
import type { AppCommand, AppCommandContext } from './types';

type Value = string | number | boolean | null;

interface Setting {
  key: string;
  /** Where it is in the app, as the English UI names it. */
  setting: string;
  read: (config: AppConfig) => Value;
  /** The JSON type, for `schema`. */
  type: string;
}

export const SETTINGS: readonly Setting[] = [
  {
    key: 'output_dir',
    setting: 'General > Output Directory',
    type: 'string|null',
    read: (c) => c.outputDirectory || null,
  },
  {
    key: 'connection_mode',
    setting: 'General > Connection Mode',
    type: '"auto"|"internal"|"external"',
    read: (c) => c.connectionMode,
  },
  {
    key: 'intranet_interface',
    setting: 'Network > Intranet Network Interface',
    type: 'string|null (null: the system default)',
    read: (c) => c.intranetInterfaceIp || null,
  },
  {
    key: 'anonymous_requests',
    setting: 'Network > Anonymous API requests',
    type: 'boolean',
    read: (c) => c.preferAnonymousApiRequests,
  },
  {
    key: 'concurrent_downloads',
    setting: 'Download & Playback > Concurrent Download Limit',
    type: 'number',
    read: (c) => c.maxConcurrentDownloads,
  },
  {
    key: 'download_workers',
    setting: 'Download & Playback > Download Worker Threads',
    type: 'number',
    read: (c) => c.downloadMaxWorkers,
  },
  {
    key: 'download_retries',
    setting: 'Download & Playback > Download Retry Count',
    type: 'number',
    read: (c) => c.downloadNumRetries,
  },
  {
    key: 'extract_after_download',
    setting: 'Download & Playback > Run C++ Slide Extraction Automatically After Download',
    type: 'boolean',
    read: (c) => c.qtExtractor?.autoRunAfterDownload ?? false,
  },
  {
    key: 'post_process_after_extraction',
    setting: 'Download & Playback > Run Post-Processing After Extraction',
    type: 'boolean',
    read: (c) => c.qtExtractor?.autoPostProcessAfter ?? false,
  },
];

const shown = (value: Value): string => (value === null ? '(not set)' : String(value));

async function serve(input: CommandInput, ctx: AppCommandContext): Promise<CommandResult> {
  const [key] = input.positionals;
  const wanted = key === undefined ? undefined : SETTINGS.find((s) => s.key === key);
  if (key !== undefined && !wanted) {
    throw new CliError('usage', `unknown setting: ${key}`, `Settings: ${SETTINGS.map((s) => s.key).join(', ')}.`);
  }

  await requireSignIn(ctx);
  const config = ctx.configService.getConfig();

  if (wanted) {
    const value = wanted.read(config);
    // The bare value, so a script can take it as is; nothing for a setting left unset.
    return { data: { key: wanted.key, value, setting: wanted.setting }, text: value === null ? '' : String(value) };
  }

  const settings = Object.fromEntries(SETTINGS.map((s) => [s.key, s.read(config)]));
  return {
    data: { settings },
    text: table(
      ['KEY', 'VALUE', 'SETTING'],
      SETTINGS.map((s) => [s.key, shown(settings[s.key]), s.setting])
    ),
    hints: ['Read-only: change these in AutoSlides Settings.'],
  };
}

export const appConfigCommand: AppCommand = {
  summary: 'Show the app settings the commands follow (read-only)',
  args: '[key]',
  description: [
    'Show the AutoSlides settings that decide what the commands do: where',
    'files go, which network route, how downloads run and what runs after',
    'them. Give a key to print just its value. Change them in the app.',
    '',
    ...SETTINGS.map((s) => `  ${s.key.padEnd(30)}${s.setting}`),
  ],
  examples: ['config', 'config output_dir', 'config --json'],
  options: [],
  positionals: { min: 0, max: 1 },
  data:
    `{ settings: { ${SETTINGS.map((s) => `${s.key}: ${s.type}`).join(', ')} } }; ` +
    'with a key: { key, value, setting }',
  serve,
};
