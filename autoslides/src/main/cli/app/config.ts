// `autoslides config [key [value]]`: the app settings the commands follow.
//
// Only the keys in `SETTINGS` are shown, never the whole config: the stored
// config also holds account tokens (`accounts`, the relay whitelist), personal
// paths and internal state. Each key is a setting the commands obey (where
// files go, which route, what runs after a download), under a stable CLI name
// independent of the store's. Yanhekt only: no Yanhe 2.0 setting is listed
// (the CLI does not cover Yanhe 2.0 while it is in beta).
//
// Read-only except where a key has `write` (Connection Mode, so a command can
// reach Yanhekt over the right route). A write goes through the app exactly as
// the Settings page's Save. No sign-in is needed: nothing here talks to Yanhekt.
import type { AppConfig, ConnectionMode } from '@common/types';
import { CliError } from '../errors';
import { table } from '../format';
import type { CommandInput, CommandResult } from '../types';
import type { AppCommand, AppCommandContext } from './types';

type Value = string | number | boolean | null;

interface Setting {
  key: string;
  /** Where it is in the app, as the English UI names it. */
  setting: string;
  read: (config: AppConfig) => Value;
  /** The JSON type, for `schema`. */
  type: string;
  /** Present on the keys a command may change: checks the typed value, applies it and returns it as saved. */
  write?: (raw: string, ctx: AppCommandContext) => Value;
}

const CONNECTION_MODES: readonly ConnectionMode[] = ['auto', 'internal', 'external'];

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
    write: (raw, ctx) => {
      const mode = CONNECTION_MODES.find((m) => m === raw);
      if (!mode) throw new CliError('usage', `connection_mode is one of ${CONNECTION_MODES.join(', ')}, not ${raw}`);
      return ctx.settings.setConnectionMode(mode);
    },
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

const WRITABLE = SETTINGS.filter((s) => s.write).map((s) => s.key).join(', ');

async function serve(input: CommandInput, ctx: AppCommandContext): Promise<CommandResult> {
  const [key, raw] = input.positionals;
  const wanted = key === undefined ? undefined : SETTINGS.find((s) => s.key === key);
  if (key !== undefined && !wanted) {
    throw new CliError('usage', `unknown setting: ${key}`, `Settings: ${SETTINGS.map((s) => s.key).join(', ')}.`);
  }
  const config = ctx.configService.getConfig();

  if (wanted && raw !== undefined) {
    if (!wanted.write) {
      throw new CliError('usage', `${wanted.key} is read-only here`, `Change it in AutoSlides: Settings > ${wanted.setting}. Only ${WRITABLE} can be set from the command line.`);
    }
    const previous = wanted.read(config);
    const value = wanted.write(raw, ctx);
    const changed = value !== previous;
    return {
      data: { key: wanted.key, value, previous, changed, setting: wanted.setting },
      text: changed ? `${wanted.key}: ${shown(previous)} -> ${shown(value)}` : `${wanted.key} is already ${shown(value)}.`,
    };
  }

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
    hints: [`Change these in AutoSlides Settings; ${WRITABLE} can also be set here ('${input.program} config <key> <value>').`],
  };
}

export const appConfigCommand: AppCommand = {
  summary: 'Show the app settings the commands follow; set the connection mode',
  args: '[key [value]]',
  description: [
    'Show the AutoSlides settings that decide what the commands do: where',
    'files go, which network route, how downloads run and what runs after',
    'them. Give a key to print just its value. Works while signed out.',
    '',
    'Give a key and a value to change it, as Save in Settings would. Only the',
    'keys marked * can be set here; change the others in the app.',
    '',
    ...SETTINGS.map((s) => `  ${(s.key + (s.write ? ' *' : '')).padEnd(32)}${s.setting}`),
  ],
  examples: ['config', 'config output_dir', 'config connection_mode internal', 'config --json'],
  options: [],
  positionals: { min: 0, max: 2 },
  data:
    `{ settings: { ${SETTINGS.map((s) => `${s.key}: ${s.type}`).join(', ')} } }; ` +
    'with a key: { key, value, setting }; with a key and value: { key, value, previous, changed: boolean, setting }',
  serve,
};
