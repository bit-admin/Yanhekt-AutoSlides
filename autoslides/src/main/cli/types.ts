import type { ApiClient } from '@main/platform/apiClient';
import type { CourseLookup } from '@main/platform/courseIndex/courseLookup';
import type { ConfigService } from '@main/platform/configService';
import type { IntranetMappingService } from '@main/platform/intranetMappingService';
import type { M3u8DownloadService } from '@main/video/m3u8DownloadService';
import type { OptionSpec } from './args';
import type { CliError } from './errors';

/** What a command may use in the terminal process. Only the services a headless run actually needs. */
export interface CliContext {
  version: string;
  configService: ConfigService;
  apiClient: ApiClient;
  /** Course index search and lookups (Settings → General → Search; read only here). */
  courseLookup: CourseLookup;
  intranetMappingService: IntranetMappingService;
  m3u8DownloadService: M3u8DownloadService;
  /** Where the running app listens for `autoslides` commands. */
  controlSocketPath: string;
  /** Start the app in the background; false when this build cannot (a dev run). */
  launchApp: () => boolean;
  /** Route service logs to stderr (`--verbose`). */
  setVerbose: () => void;
  /**
   * Run `handler` when the user interrupts the run (Ctrl-C). Returns a function
   * that unregisters it. With no handler registered an interrupt just exits.
   */
  onInterrupt: (handler: () => void) => () => void;
}

export interface CommandInput {
  /** `yhdl` or `autoslides`, for hints that name another command. */
  program: string;
  positionals: string[];
  /** The command's own options and the shared ones, keyed by long name. */
  options: Record<string, string | true>;
  json: boolean;
}

export interface CommandResult {
  /** The `data` of the JSON answer. */
  data: unknown;
  /** What stdout shows without `--json`; nothing when the command already wrote it. */
  text?: string;
  /** Next steps, shown on stderr below the text (not with `--json`). */
  hints?: string[];
  /** Set when the command finished but did not fully succeed (`download` with a failed item). */
  error?: CliError;
}

export interface CliCommand {
  summary: string;
  /** Arguments after the command name in the usage line, such as `<keyword…>`. */
  args: string;
  description: string[];
  /** Without the program name: `search 微积分`. */
  examples: string[];
  options: OptionSpec[];
  positionals: { min: number; max: number };
  /** Takes `--intranet` / `--interface` and pins the route before running. */
  network: boolean;
  /** Runs inside the app (`autoslides`): no `--verbose`, the app keeps its own logs. */
  runsInApp?: boolean;
  /** When the command uses a login token, in a sentence; absent = never. Adds `--token` / `--account`. */
  tokenUse?: string;
  /** The shape of `data` in the JSON answer, for `schema`. */
  data: string;
  /** Resolves with the result; a failure is a thrown CliError (or any error, classified). */
  run: (input: CommandInput, ctx: CliContext) => Promise<CommandResult>;
}
