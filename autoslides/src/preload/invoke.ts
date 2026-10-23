import { ipcRenderer } from 'electron';
import { userFacingIpcError } from '@common/ipcError';

/**
 * `ipcRenderer.invoke`, but a rejection carries only the main-process message,
 * without Electron's "Error invoking remote method '…': Error: " prefix. Every
 * preload namespace calls main through this.
 */
export function invoke(channel: string, ...args: unknown[]): Promise<any> {
  return ipcRenderer.invoke(channel, ...args).catch((error: unknown) => {
    throw new Error(userFacingIpcError(error));
  });
}
