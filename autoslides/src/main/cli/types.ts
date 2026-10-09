import type { ApiClient } from '@main/platform/apiClient';
import type { ConfigService } from '@main/platform/configService';
import type { IntranetMappingService } from '@main/platform/intranetMappingService';
import type { M3u8DownloadService } from '@main/video/m3u8DownloadService';

/** What a command may use. Only the services a headless run actually needs. */
export interface CliContext {
  version: string;
  configService: ConfigService;
  apiClient: ApiClient;
  intranetMappingService: IntranetMappingService;
  m3u8DownloadService: M3u8DownloadService;
  /** Route service logs to stderr (`--verbose`). */
  setVerbose: () => void;
  /**
   * Run `handler` when the user interrupts the run (Ctrl-C). Returns a function
   * that unregisters it. With no handler registered an interrupt just exits.
   */
  onInterrupt: (handler: () => void) => () => void;
}

export interface CliCommand {
  summary: string;
  help: () => string;
  /** Resolves to the process exit code. */
  run: (args: readonly string[], ctx: CliContext) => Promise<number>;
}
