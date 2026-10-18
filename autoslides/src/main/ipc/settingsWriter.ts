// Saving a setting and putting it into effect, in one place for both writers:
// the Settings page (its IPC handlers) and `autoslides config <key> <value>`.
// Each method saves through ConfigService (which checks and clamps), applies
// whatever else the setting drives, and sends the new config to every window,
// so neither writer can leave the app half-updated.
import type { ConnectionMode } from '@common/types';
import type { ConfigService } from '@main/platform/configService';
import type { IntranetMappingService } from '@main/platform/intranetMappingService';
import { broadcastConfig } from './broadcastConfig';

export interface SettingsWriter {
  setOutputDirectory: (directory: string) => void;
  setConnectionMode: (mode: ConnectionMode) => void;
  /** null = the system default. */
  setIntranetInterfaceIp: (ip: string | null) => void;
  setPreferAnonymousApiRequests: (enabled: boolean) => void;
  setMaxConcurrentDownloads: (count: number) => void;
  setDownloadMaxWorkers: (count: number) => void;
  setDownloadNumRetries: (count: number) => void;
  setQtExtractorAutoRun: (enabled: boolean) => void;
  setQtExtractorAutoPostProcess: (enabled: boolean) => void;
}

export function createSettingsWriter(
  configService: ConfigService,
  intranetMappingService: IntranetMappingService,
): SettingsWriter {
  const saved = <A extends unknown[]>(apply: (...args: A) => void) => (...args: A): void => {
    apply(...args);
    broadcastConfig(configService);
  };
  return {
    setOutputDirectory: saved((directory) => configService.setOutputDirectory(directory)),
    setConnectionMode: saved((mode) => {
      configService.setConnectionMode(mode);
      intranetMappingService.setMode(configService.getConfig().connectionMode);
    }),
    setIntranetInterfaceIp: saved((ip) => intranetMappingService.setInterfaceIp(ip)),
    setPreferAnonymousApiRequests: saved((enabled) => configService.setPreferAnonymousApiRequests(enabled)),
    setMaxConcurrentDownloads: saved((count) => configService.setMaxConcurrentDownloads(count)),
    setDownloadMaxWorkers: saved((count) => configService.setDownloadMaxWorkers(count)),
    setDownloadNumRetries: saved((count) => configService.setDownloadNumRetries(count)),
    setQtExtractorAutoRun: saved((enabled) => configService.setQtExtractorAutoRun(enabled)),
    setQtExtractorAutoPostProcess: saved((enabled) => configService.setQtExtractorAutoPostProcess(enabled)),
  };
}
