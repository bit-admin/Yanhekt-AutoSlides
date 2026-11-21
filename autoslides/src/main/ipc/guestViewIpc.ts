import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { isGuestKind, parseGuestRect, type GuestKind, type GuestMenuState } from '@common/guestView';
import type { GuestViewManager } from '@main/platform/guestViewManager';

export function registerGuestViewIpcHandlers(guests: GuestViewManager): void {
  const handle = <A extends unknown[], R>(
    name: string,
    run: (kind: GuestKind, ...args: A) => R,
  ) => {
    ipcMain.handle(`guestView:${name}`, (event: IpcMainInvokeEvent, kind: unknown, ...args: unknown[]) => {
      if (!guests.isHost(event.sender) || !isGuestKind(kind)) throw new Error('Not allowed.');
      return run(kind, ...(args as A));
    });
  };

  handle('open', (kind, url: string) => guests.open(kind, url));
  handle('close', (kind) => guests.close(kind));
  handle('layout', (kind, rect: unknown) => guests.layout(kind, parseGuestRect(rect)));
  handle('navigate', (kind, action: unknown, url?: unknown) => {
    if (action !== 'load' && action !== 'reload' && action !== 'back' && action !== 'forward') {
      throw new Error('Unknown navigation.');
    }
    guests.navigate(kind, action, url);
  });
  handle('getUrl', (kind) => guests.getUrl(kind));
  handle('send', (kind, channel: unknown, payload: unknown) => {
    if (typeof channel === 'string') guests.send(kind, channel, payload);
  });
  handle('executeJavaScript', (kind, code: unknown) => {
    if (typeof code !== 'string') throw new Error('Invalid script.');
    return guests.executeJavaScript(kind, code);
  });
  handle('focus', (kind) => guests.focus(kind));
  handle('capture', (kind, rect: unknown) => guests.capture(kind, parseGuestRect(rect)));
  handle('setOutline', (kind, rect: unknown, color: unknown) => {
    guests.setOutline(kind, parseGuestRect(rect), typeof color === 'string' ? color : '#000000');
  });
  handle('setMenu', (kind, state: unknown) => {
    if (kind !== 'browserLogin') throw new Error('Not allowed.');
    return guests.setMenu((state ?? null) as GuestMenuState | null);
  });
}
