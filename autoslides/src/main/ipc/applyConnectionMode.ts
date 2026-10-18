import type { ConnectionMode } from '@common/types';
import type { ConfigService } from '@main/platform/configService';
import type { IntranetMappingService } from '@main/platform/intranetMappingService';
import { broadcastConfig } from './broadcastConfig';

/**
 * Save Connection Mode and put it into effect: the route every request takes
 * from now on, and every window's copy of the config. Shared by the Settings
 * page (`config:setConnectionMode`) and `autoslides config connection_mode`.
 * Returns the mode as saved (an unknown one leaves the old mode).
 */
export function applyConnectionMode(
  configService: ConfigService,
  intranetMappingService: IntranetMappingService,
  mode: ConnectionMode,
): ConnectionMode {
  configService.setConnectionMode(mode);
  const saved = configService.getConfig().connectionMode;
  intranetMappingService.setMode(saved);
  broadcastConfig(configService);
  return saved;
}
