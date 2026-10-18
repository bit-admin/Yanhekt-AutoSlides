// `autoslides config [key [value]]`: the app settings the commands follow.
//
// Only the keys in `SETTINGS` are shown, never the whole config: the stored
// config also holds account tokens (`accounts`, the relay whitelist), personal
// paths and internal state. Each key is a setting the commands obey (where
// files go, which route, what runs after a download), under a stable CLI name
// independent of the store's. Yanhekt only: no Yanhe 2.0 setting is listed
// (the CLI does not cover Yanhe 2.0 while it is in beta).
//
// Every listed key can be changed. A change goes through the app's
// `SettingsWriter`, the same code Save in Settings runs: saved, put into effect,
// sent to every window. No sign-in is needed: nothing here talks to Yanhekt.
// There is no one-run override (`--output` and the like): a different folder
// or route for one run is what `yhdl` is for.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AppConfig, ConnectionMode } from '@common/types';
import { expandTilde } from '@main/infra/pathUtils';
import { CliError } from '../errors';
import { table } from '../format';
import { resolveCliInterface } from '../networkInterface';
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
  /** What `config <key> <value>` takes, for help and errors. */
  accepts: string;
  /** Checks the typed value (a usage error when it is wrong) and saves it through the app. */
  write: (raw: string, ctx: AppCommandContext) => void;
}

const CONNECTION_MODES: readonly ConnectionMode[] = ['auto', 'internal', 'external'];

const BOOLEAN_WORDS: Record<string, boolean> = { true: true, on: true, yes: true, '1': true, false: false, off: false, no: false, '0': false };

function parseBoolean(key: string, raw: string): boolean {
  const value = BOOLEAN_WORDS[raw.toLowerCase()];
  if (value === undefined) throw new CliError('usage', `${key} is true or false, not ${raw}`);
  return value;
}

/** A whole number in the range the Settings page offers (ConfigService clamps to the same). */
function parseCount(key: string, raw: string, min: number, max: number): number {
  const value = Number(raw);
  if (!/^\d+$/.test(raw) || value < min || value > max) {
    throw new CliError('usage', `${key} is a whole number from ${min} to ${max}, not ${raw}`);
  }
  return value;
}

/** An existing folder, given as an absolute path (the app does not know the terminal's working folder). */
function parseFolder(raw: string): string {
  const folder = expandTilde(raw);
  if (!path.isAbsolute(folder)) {
    throw new CliError('usage', `output_dir must be an absolute path, not ${raw}`, 'Pass the full path, for example "$PWD/Lectures".');
  }
  let isFolder = false;
  try {
    isFolder = fs.statSync(folder).isDirectory();
  } catch {
    // Missing: said below.
  }
  // Not created here: the Settings page only picks a folder that exists, too.
  if (!isFolder) throw new CliError('usage', `no such folder: ${folder}`, 'Create it first, then set it.');
  return path.normalize(folder);
}

/** An interface name or one of this computer's IPv4 addresses; `default` goes back to the system default. */
function parseInterface(raw: string): string | null {
  if (['default', 'system', 'none', ''].includes(raw.toLowerCase())) return null;
  const choice = resolveCliInterface(raw, os.networkInterfaces());
  if (!choice.ok) throw new CliError('usage', choice.message);
  return choice.iface.address;
}

export const SETTINGS: readonly Setting[] = [
  {
    key: 'output_dir',
    setting: 'General > Output Directory',
    type: 'string|null',
    accepts: 'an existing folder (absolute path)',
    read: (c) => c.outputDirectory || null,
    write: (raw, ctx) => ctx.settings.setOutputDirectory(parseFolder(raw)),
  },
  {
    key: 'connection_mode',
    setting: 'General > Connection Mode',
    type: '"auto"|"internal"|"external"',
    accepts: CONNECTION_MODES.join('|'),
    read: (c) => c.connectionMode,
    write: (raw, ctx) => {
      const mode = CONNECTION_MODES.find((m) => m === raw);
      if (!mode) throw new CliError('usage', `connection_mode is one of ${CONNECTION_MODES.join(', ')}, not ${raw}`);
      ctx.settings.setConnectionMode(mode);
    },
  },
  {
    key: 'intranet_interface',
    setting: 'Network > Intranet Network Interface',
    type: 'string|null (null: the system default)',
    accepts: 'an interface name or IPv4 address, or default',
    read: (c) => c.intranetInterfaceIp || null,
    write: (raw, ctx) => ctx.settings.setIntranetInterfaceIp(parseInterface(raw)),
  },
  {
    key: 'anonymous_requests',
    setting: 'Network > Anonymous API requests',
    type: 'boolean',
    accepts: 'true|false',
    read: (c) => c.preferAnonymousApiRequests,
    write: (raw, ctx) => ctx.settings.setPreferAnonymousApiRequests(parseBoolean('anonymous_requests', raw)),
  },
  {
    key: 'concurrent_downloads',
    setting: 'Download & Playback > Concurrent Download Limit',
    type: 'number',
    accepts: '1-10',
    read: (c) => c.maxConcurrentDownloads,
    write: (raw, ctx) => ctx.settings.setMaxConcurrentDownloads(parseCount('concurrent_downloads', raw, 1, 10)),
  },
  {
    key: 'download_workers',
    setting: 'Download & Playback > Download Worker Threads',
    type: 'number',
    accepts: '1-32',
    read: (c) => c.downloadMaxWorkers,
    write: (raw, ctx) => ctx.settings.setDownloadMaxWorkers(parseCount('download_workers', raw, 1, 32)),
  },
  {
    key: 'download_retries',
    setting: 'Download & Playback > Download Retry Count',
    type: 'number',
    accepts: '1-30',
    read: (c) => c.downloadNumRetries,
    write: (raw, ctx) => ctx.settings.setDownloadNumRetries(parseCount('download_retries', raw, 1, 30)),
  },
  {
    key: 'extract_after_download',
    setting: 'Download & Playback > Run C++ Slide Extraction Automatically After Download',
    type: 'boolean',
    accepts: 'true|false',
    read: (c) => c.qtExtractor?.autoRunAfterDownload ?? false,
    write: (raw, ctx) => ctx.settings.setQtExtractorAutoRun(parseBoolean('extract_after_download', raw)),
  },
  {
    key: 'post_process_after_extraction',
    setting: 'Download & Playback > Run Post-Processing After Extraction',
    type: 'boolean',
    accepts: 'true|false',
    // On unless turned off, as the Settings page reads it.
    read: (c) => c.qtExtractor?.autoPostProcessAfter !== false,
    write: (raw, ctx) => ctx.settings.setQtExtractorAutoPostProcess(parseBoolean('post_process_after_extraction', raw)),
  },
];

const shown = (value: Value): string => (value === null ? '(not set)' : String(value));


async function serve(input: CommandInput, ctx: AppCommandContext): Promise<CommandResult> {
  const [key, raw] = input.positionals;
  const wanted = key === undefined ? undefined : SETTINGS.find((s) => s.key === key);
  if (key !== undefined && !wanted) {
    throw new CliError('usage', `unknown setting: ${key}`, `Settings: ${SETTINGS.map((s) => s.key).join(', ')}.`);
  }
  const config = ctx.configService.getConfig();

  if (wanted && raw !== undefined) {
    const previous = wanted.read(config);
    wanted.write(raw, ctx);
    // As saved: ConfigService may have normalized it.
    const value = wanted.read(ctx.configService.getConfig());
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
    hints: [`Change one with '${input.program} config <key> <value>', or in AutoSlides Settings.`],
  };
}

export const appConfigCommand: AppCommand = {
  summary: 'Show or change the app settings the commands follow',
  args: '[key [value]]',
  description: [
    'Show the AutoSlides settings that decide what the commands do: where',
    'files go, which network route, how downloads run and what runs after',
    'them. Give a key to print just its value. Works while signed out.',
    '',
    'Give a key and a value to change it, as Save in Settings would: saved,',
    'in effect at once, and shown in the app. For one run with another folder',
    'or route, use yhdl instead.',
    '',
    ...SETTINGS.flatMap((s) => [`  ${s.key.padEnd(31)}${s.setting}`, `  ${''.padEnd(31)}takes ${s.accepts}`]),
  ],
  examples: [
    'config',
    'config output_dir',
    'config connection_mode internal',
    'config output_dir ~/Lectures',
    'config intranet_interface en0',
    'config concurrent_downloads 3',
    'config --json',
  ],
  options: [],
  positionals: { min: 0, max: 2 },
  data:
    `{ settings: { ${SETTINGS.map((s) => `${s.key}: ${s.type}`).join(', ')} } }; ` +
    'with a key: { key, value, setting }; with a key and value: { key, value, previous, changed: boolean, setting }',
  serve,
};
