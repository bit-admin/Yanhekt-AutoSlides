// Saving a setting and putting it into effect, in one place for both writers:
// the Settings page (its IPC handlers) and `autoslides config <key> <value>`.
// Each method saves through ConfigService (which checks and clamps), applies
// whatever else the setting drives, and sends the new config to every window,
// so neither writer can leave the app half-updated.
import type { ConnectionMode, ProxySettings } from '@common/types';
import type { ConfigService } from '@main/platform/configService';
import type { IntranetMappingService } from '@main/platform/intranetMappingService';
import { applyProxySettings } from '@main/platform/proxyControl';
import { broadcastConfig } from './broadcastConfig';

export interface SettingsWriter {
  setOutputDirectory: (directory: string) => void;
  setConnectionMode: (mode: ConnectionMode) => void;
  /** null = the system default. */
  setIntranetInterfaceIp: (ip: string | null) => void;
  setPreferAnonymousApiRequests: (enabled: boolean) => void;
  /** Any subset; the rest stays as saved. */
  setProxySettings: (next: Partial<ProxySettings>) => void;
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
    setProxySettings: saved((next) => {
      configService.setProxySettings(next);
      void applyProxySettings(configService.getProxySettings());
    }),
    setMaxConcurrentDownloads: saved((count) => configService.setMaxConcurrentDownloads(count)),
    setDownloadMaxWorkers: saved((count) => configService.setDownloadMaxWorkers(count)),
    setDownloadNumRetries: saved((count) => configService.setDownloadNumRetries(count)),
    setQtExtractorAutoRun: saved((enabled) => configService.setQtExtractorAutoRun(enabled)),
    setQtExtractorAutoPostProcess: saved((enabled) => configService.setQtExtractorAutoPostProcess(enabled)),
  };
}
