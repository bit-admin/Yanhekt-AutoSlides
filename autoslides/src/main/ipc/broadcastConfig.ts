import { BrowserWindow } from 'electron';
import type { ConfigService } from '@main/platform/configService';

// Push the current AppConfig snapshot to every live BrowserWindow. The
// renderer-side configStore listens for 'config:onUpdate' and merges the
// payload into its reactive state, so any consumer that reads configStore
// sees the new values within one event-loop tick of a setter completing.
export function broadcastConfig(configService: ConfigService): void {
  const cfg = configService.getConfig();
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) {
      w.webContents.send('config:onUpdate', cfg);
    }
  }
}
