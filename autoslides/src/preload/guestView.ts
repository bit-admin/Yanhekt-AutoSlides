import { ipcRenderer } from 'electron';
import type { GuestEvent } from '@common/guestView';
import { invoke } from './invoke';
import type { ElectronAPI } from './electronApi';

export const guestView: ElectronAPI['guestView'] = {
  open: (kind, url) => invoke('guestView:open', kind, url),
  close: (kind) => invoke('guestView:close', kind),
  layout: (kind, rect) => invoke('guestView:layout', kind, rect),
  navigate: (kind, action, url) => invoke('guestView:navigate', kind, action, url),
  getUrl: (kind) => invoke('guestView:getUrl', kind),
  send: (kind, channel, payload) => invoke('guestView:send', kind, channel, payload),
  executeJavaScript: (kind, code) => invoke('guestView:executeJavaScript', kind, code),
  focus: (kind) => invoke('guestView:focus', kind),
  capture: (kind, rect) => invoke('guestView:capture', kind, rect),
  setOutline: (kind, rect, color) => invoke('guestView:setOutline', kind, rect, color),
  setMenu: (state) => invoke('guestView:setMenu', 'browserLogin', state),
  onEvent: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: GuestEvent) => callback(payload);
    ipcRenderer.on('guestView:event', listener);
    return () => ipcRenderer.removeListener('guestView:event', listener);
  },
};
