// Saving a setting and putting it into effect, in one place for both writers:
// the Settings page (its IPC handlers) and `autoslides config <key> <value>`.
// Each method saves through ConfigService (which checks and clamps), applies
// whatever else the setting drives, and sends the new config to every window,
// so neither writer can leave the app half-updated.
import type { ConnectionMode, ProxySettings } from '@common/types';
import type { ConfigService } from '@main/platform/configService';
import type { IntranetMappingService } from '@main/platform/intranetMappingService';
import { applyProxySettings } from '@main/platform/proxyControl';
import type { RendererBridge } from '@main/cli';
import { hasOutputFolderWork, OutputFolderBusyError, type OutputFolderWork } from '@common/outputFolderWork';
import { createLogger } from '@main/infra/logger';
import { broadcastConfig } from './broadcastConfig';

const log = createLogger('SettingsWriter');

/**
 * What the renderer is still writing into the output folder, or null when no
 * renderer is up (then nothing is: the queues live there).
 */
export type OutputFolderWorkSource = () => Promise<OutputFolderWork | null>;

/** Ask the main window's renderer (through the `autoslides` control bridge, which knows when it is up). */
export const outputFolderWorkFrom =
  (bridge: Pick<RendererBridge, 'requestIfReady'>): OutputFolderWorkSource =>
  () => bridge.requestIfReady('outputFolderWork', {});

export interface SettingsWriter {
  /** Rejects with `OutputFolderBusyError`, changing nothing, while work is unfinished. */
  setOutputDirectory: (directory: string) => Promise<void>;
  /** The same refusal, for a caller that asks before opening the folder picker. */
  assertOutputFolderIdle: () => Promise<void>;
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
  outputFolderWork: OutputFolderWorkSource,
): SettingsWriter {
  const saved = <A extends unknown[]>(apply: (...args: A) => void) => (...args: A): void => {
    apply(...args);
    broadcastConfig(configService);
  };
  const assertOutputFolderIdle = async (): Promise<void> => {
    let work: OutputFolderWork | null;
    try {
      work = await outputFolderWork();
    } catch (error) {
      // A reload or crash in between: it took the queues with it.
      log.warn('Could not ask the renderer for output folder work; allowing the change:', error);
      return;
    }
    if (work && hasOutputFolderWork(work)) throw new OutputFolderBusyError(work);
  };
  return {
    assertOutputFolderIdle,
    setOutputDirectory: async (directory) => {
      await assertOutputFolderIdle();
      configService.setOutputDirectory(directory);
      broadcastConfig(configService);
    },
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
