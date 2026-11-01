import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserWindow, shell } from 'electron';
import { CommunityWindow, isCommunityDeepLink, isCommunityWebUrl } from './communityWindow';

const mocks = vi.hoisted(() => ({
  loadURL: vi.fn().mockResolvedValue(undefined),
  openExternal: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@main/infra/logger', () => ({
  createLogger: () => ({ error: vi.fn() }),
}));
vi.mock('electron', async () => {
  const { EventEmitter } = await import('node:events');
  return {
    shell: { openExternal: mocks.openExternal },
    BrowserWindow: vi.fn(function () {
      let destroyed = false;
      const window = new EventEmitter();
      const session = Object.assign(new EventEmitter(), {
        setPermissionCheckHandler: vi.fn(),
        setPermissionRequestHandler: vi.fn(),
      });
      const webContents = Object.assign(new EventEmitter(), {
        session,
        loadURL: mocks.loadURL,
        setWindowOpenHandler: vi.fn(),
      });
      return Object.assign(window, {
        webContents,
        show: vi.fn(),
        focus: vi.fn(),
        isDestroyed: () => destroyed,
        close: vi.fn(() => { destroyed = true; window.emit('closed'); }),
      });
    }),
  };
});

// Synthetic payload: no group/member data is needed to test protocol routing.
const invite = 'tencent://groupwpa/?subcmd=all&param=7b7d&jump_from=webapi';
const parent = {} as BrowserWindow;
const latestWindow = () => vi.mocked(BrowserWindow).mock.results.at(-1)!.value as BrowserWindow;
const navigation = (url: string, isMainFrame = true) => ({ url, isMainFrame, preventDefault: vi.fn() });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadURL.mockReset().mockResolvedValue(undefined);
  mocks.openExternal.mockReset().mockResolvedValue(undefined);
});

describe('community URL policy', () => {
  it.each(['https://qm.qq.com/cgi-bin/qm/qr?k=example', 'https://im.qq.com/'])('allows %s', (url) => {
    expect(isCommunityWebUrl(url)).toBe(true);
  });

  it.each([
    'http://qm.qq.com/', 'https://qm.qq.com.evil.example/', 'https://evil.example/',
    'https://qm.qq.com@evil.example/', 'https://user:pass@qm.qq.com/',
    'https://qm.qq.com:8080/', 'file:///tmp/invite.html', 'javascript:alert(1)', 'not a URL',
  ])('rejects web navigation to %s', (url) => {
    expect(isCommunityWebUrl(url)).toBe(false);
  });

  it('allows the desktop group-invitation command', () => {
    expect(isCommunityDeepLink(invite)).toBe(true);
  });

  it.each([
    'tencent://message/?uin=123', 'tencent://groupwpa.evil.example/?subcmd=all&param=7b7d',
    'tencent://groupwpa/other?subcmd=all&param=7b7d',
    'tencent://groupwpa/?subcmd=other&param=7b7d', 'tencent://groupwpa/?subcmd=all',
    'tencent://groupwpa/?subcmd=all&param=not-hex', 'mqqapi://card/show_pslcard',
    'file:///tmp/invite', 'javascript:alert(1)', 'not a URL',
  ])('rejects app command %s', (url) => {
    expect(isCommunityDeepLink(url)).toBe(false);
  });
});

describe('CommunityWindow', () => {
  it('opens a sandboxed, session-isolated modal with no preload or arbitrary URL input', async () => {
    const pending = new CommunityWindow().open(parent);
    const window = latestWindow();
    const options = vi.mocked(BrowserWindow).mock.calls[0][0]!;
    expect(options).toMatchObject({ parent, modal: true, width: 560, height: 640 });
    expect(options.webPreferences).toEqual({
      nodeIntegration: false, contextIsolation: true, sandbox: true,
      webviewTag: false, partition: 'autoslides-community',
    });
    expect(mocks.loadURL).toHaveBeenCalledTimes(1);
    expect(mocks.loadURL.mock.calls[0][0]).toMatch(/^https:\/\/qm\.qq\.com\/cgi-bin\/qm\/qr\?/);
    expect(window.show).not.toHaveBeenCalled();
    window.emit('ready-to-show');
    expect(window.show).toHaveBeenCalledOnce();
    expect(shell.openExternal).not.toHaveBeenCalled();
    window.close();
    await pending;
  });

  it('reuses the open modal, and permits a new one after closing', async () => {
    const manager = new CommunityWindow();
    const pending = manager.open(parent);
    const window = latestWindow();
    expect(manager.open(parent)).toBe(pending);
    expect(BrowserWindow).toHaveBeenCalledTimes(1);
    expect(window.focus).toHaveBeenCalled();
    window.close();
    await pending;
    const reopened = manager.open(parent);
    expect(BrowserWindow).toHaveBeenCalledTimes(2);
    latestWindow().close();
    await reopened;
  });

  it.each(['will-frame-navigate', 'will-redirect'])('hands off QQ from %s exactly once', async (event) => {
    const pending = new CommunityWindow().open(parent);
    const window = latestWindow();
    const nav = navigation(invite);
    window.webContents.emit(event, nav);
    window.webContents.emit(event, navigation(invite, false));
    expect(nav.preventDefault).toHaveBeenCalled();
    await pending;
    expect(shell.openExternal).toHaveBeenCalledExactlyOnceWith(invite);
    expect(window.isDestroyed()).toBe(true);
  });

  it('blocks arbitrary navigation while allowing QQ HTTPS and blank subframes', async () => {
    const pending = new CommunityWindow().open(parent);
    const window = latestWindow();
    for (const url of ['file:///tmp/page', 'javascript:alert(1)', 'https://evil.example/', 'tencent://message/', 'about:blank']) {
      const nav = navigation(url);
      window.webContents.emit('will-frame-navigate', nav);
      expect(nav.preventDefault).toHaveBeenCalled();
    }
    for (const nav of [navigation('https://qm.qq.com/'), navigation('about:blank', false)]) {
      window.webContents.emit('will-frame-navigate', nav);
      expect(nav.preventDefault).not.toHaveBeenCalled();
    }
    expect(shell.openExternal).not.toHaveBeenCalled();
    window.close();
    await pending;
  });

  it('handles window.open without allowing popup windows', async () => {
    const pending = new CommunityWindow().open(parent);
    const window = latestWindow();
    const handler = vi.mocked(window.webContents.setWindowOpenHandler).mock.calls[0][0];
    const open = (url: string) => handler({ url } as Electron.HandlerDetails);
    expect(open('https://evil.example/')).toEqual({ action: 'deny' });
    expect(mocks.loadURL).toHaveBeenCalledTimes(1);
    expect(open('https://im.qq.com/')).toEqual({ action: 'deny' });
    expect(mocks.loadURL).toHaveBeenLastCalledWith('https://im.qq.com/');
    expect(open(invite)).toEqual({ action: 'deny' });
    await pending;
    expect(shell.openExternal).toHaveBeenCalledExactlyOnceWith(invite);
  });

  it('denies permissions and downloads, but explicitly handles the QQ protocol permission path', async () => {
    const pending = new CommunityWindow().open(parent);
    const window = latestWindow();
    const session = window.webContents.session;
    const check = vi.mocked(session.setPermissionCheckHandler).mock.calls[0][0]!;
    expect(check(window.webContents, 'notifications', 'https://qm.qq.com', {} as Electron.PermissionCheckHandlerHandlerDetails)).toBe(false);
    const download = { preventDefault: vi.fn() };
    session.emit('will-download', download);
    expect(download.preventDefault).toHaveBeenCalled();
    const request = vi.mocked(session.setPermissionRequestHandler).mock.calls[0][0]!;
    const callback = vi.fn();
    request(window.webContents, 'notifications', callback, {} as Electron.PermissionRequest);
    request(window.webContents, 'openExternal', callback, { externalURL: 'tencent://message/' } as Electron.OpenExternalPermissionRequest);
    expect(shell.openExternal).not.toHaveBeenCalled();
    request(window.webContents, 'openExternal', callback, { externalURL: invite } as Electron.OpenExternalPermissionRequest);
    await pending;
    expect(callback.mock.calls).toEqual([[false], [false], [false]]);
    expect(shell.openExternal).toHaveBeenCalledExactlyOnceWith(invite);
    expect(session.listenerCount('will-download')).toBe(0);
  });

  it('reports a failed page load instead of opening the system browser', async () => {
    mocks.loadURL.mockRejectedValueOnce(new Error('network unavailable'));
    await expect(new CommunityWindow().open(parent)).rejects.toThrow('network unavailable');
    expect(latestWindow().isDestroyed()).toBe(true);
    expect(shell.openExternal).not.toHaveBeenCalled();
  });

  it('reports a failed OS handoff instead of leaving a blank modal open', async () => {
    mocks.openExternal.mockRejectedValueOnce(new Error('QQ not installed'));
    const pending = new CommunityWindow().open(parent);
    latestWindow().webContents.emit('will-frame-navigate', navigation(invite));
    await expect(pending).rejects.toThrow('QQ not installed');
    expect(latestWindow().isDestroyed()).toBe(true);
  });

  it('does not report an initial load abort during successful QQ handoff', async () => {
    let abortLoad!: (error: Error) => void;
    let launched!: () => void;
    mocks.loadURL.mockReturnValueOnce(new Promise<void>((_resolve, reject) => { abortLoad = reject; }));
    mocks.openExternal.mockReturnValueOnce(new Promise<void>((resolve) => { launched = resolve; }));
    const pending = new CommunityWindow().open(parent);
    latestWindow().webContents.emit('will-frame-navigate', navigation(invite));
    abortLoad(Object.assign(new Error('ERR_ABORTED'), { code: 'ERR_ABORTED', errno: -3 }));
    launched();
    await expect(pending).resolves.toBeUndefined();
  });

  it('does not treat a window.open load abort as QQ launch failure or flash an empty modal', async () => {
    let abortPopupLoad!: (error: Error) => void;
    let launched!: () => void;
    mocks.loadURL.mockResolvedValueOnce(undefined).mockReturnValueOnce(
      new Promise<void>((_resolve, reject) => { abortPopupLoad = reject; }),
    );
    mocks.openExternal.mockReturnValueOnce(new Promise<void>((resolve) => { launched = resolve; }));
    const pending = new CommunityWindow().open(parent);
    const window = latestWindow();
    const handler = vi.mocked(window.webContents.setWindowOpenHandler).mock.calls[0][0];
    handler({ url: 'https://qm.qq.com/cgi-bin/qm/qr?k=example' } as Electron.HandlerDetails);
    window.webContents.emit('will-frame-navigate', navigation(invite));
    window.emit('ready-to-show');
    abortPopupLoad(Object.assign(new Error('ERR_ABORTED loading QQ invitation'), {
      code: 'ERR_ABORTED', errno: -3, url: invite,
    }));
    // Let the page rejection run while the actual OS handoff is still pending.
    await Promise.resolve();
    expect(window.isDestroyed()).toBe(false);
    expect(window.show).not.toHaveBeenCalled();
    launched();
    await expect(pending).resolves.toBeUndefined();
    expect(shell.openExternal).toHaveBeenCalledExactlyOnceWith(invite);
    expect(window.isDestroyed()).toBe(true);
    window.emit('ready-to-show');
    expect(window.show).not.toHaveBeenCalled();
  });

  it('ignores the old load abort when a permitted popup replaces the initial page', async () => {
    let abortInitialLoad!: (error: Error) => void;
    mocks.loadURL.mockReturnValueOnce(new Promise<void>((_resolve, reject) => { abortInitialLoad = reject; }));
    const pending = new CommunityWindow().open(parent);
    const window = latestWindow();
    const handler = vi.mocked(window.webContents.setWindowOpenHandler).mock.calls[0][0];
    handler({ url: 'https://im.qq.com/' } as Electron.HandlerDetails);
    abortInitialLoad(Object.assign(new Error('ERR_ABORTED'), { code: 'ERR_ABORTED' }));
    await Promise.resolve();
    expect(window.isDestroyed()).toBe(false);
    window.close();
    await expect(pending).resolves.toBeUndefined();
  });

  it.each(['initial', 'popup'])('completes native QQ handoff from the %s load without our navigation hook firing', async (source) => {
    const error = Object.assign(new Error('ERR_ABORTED (-3) loading QQ'), {
      code: 'ERR_ABORTED', errno: -3, url: invite,
    });
    if (source === 'initial') mocks.loadURL.mockRejectedValueOnce(error);
    else mocks.loadURL.mockResolvedValueOnce(undefined).mockRejectedValueOnce(error);
    const pending = new CommunityWindow().open(parent);
    const window = latestWindow();
    if (source === 'popup') {
      const handler = vi.mocked(window.webContents.setWindowOpenHandler).mock.calls[0][0];
      handler({ url: 'https://qm.qq.com/cgi-bin/qm/qr?k=example' } as Electron.HandlerDetails);
    }
    await expect(pending).resolves.toBeUndefined();
    expect(window.isDestroyed()).toBe(true);
    expect(window.show).not.toHaveBeenCalled();
    // Chromium already dispatched this protocol; do not open QQ a second time.
    expect(shell.openExternal).not.toHaveBeenCalled();
  });

  it('recognizes native QQ handoff errors from a different JavaScript realm', async () => {
    const { runInNewContext } = await import('node:vm');
    const error: unknown = runInNewContext('Object.assign(new Error("ERR_ABORTED"), { code: "ERR_ABORTED", errno: -3 })');
    expect(error).not.toBeInstanceOf(Error);
    Object.assign(error as object, { url: invite });
    mocks.loadURL.mockRejectedValueOnce(error);
    await expect(new CommunityWindow().open(parent)).resolves.toBeUndefined();
    expect(latestWindow().isDestroyed()).toBe(true);
    expect(shell.openExternal).not.toHaveBeenCalled();
  });

  it.each(['https://qm.qq.com/', 'tencent://message/', 'https://evil.example/'])('does not treat an aborted non-invite URL as successful QQ handoff: %s', async (url) => {
    mocks.loadURL.mockRejectedValueOnce(Object.assign(new Error('Unexpected abort'), {
      code: 'ERR_ABORTED', errno: -3, url,
    }));
    await expect(new CommunityWindow().open(parent)).rejects.toThrow('Unexpected abort');
    expect(shell.openExternal).not.toHaveBeenCalled();
  });

  it('does not suppress other load failures just because their URL is a QQ invitation', async () => {
    mocks.loadURL.mockRejectedValueOnce(Object.assign(new Error('ERR_FAILED'), {
      code: 'ERR_FAILED', errno: -2, url: invite,
    }));
    await expect(new CommunityWindow().open(parent)).rejects.toThrow('ERR_FAILED');
    expect(shell.openExternal).not.toHaveBeenCalled();
  });

  it('still reports an aborted page load if no QQ handoff or replacement has started', async () => {
    mocks.loadURL.mockRejectedValueOnce(Object.assign(new Error('Unexpected abort'), { code: 'ERR_ABORTED' }));
    await expect(new CommunityWindow().open(parent)).rejects.toThrow('Unexpected abort');
    expect(shell.openExternal).not.toHaveBeenCalled();
  });

  it('still reports an actual OS launch failure after an expected page abort', async () => {
    let abortLoad!: (error: Error) => void;
    let rejectLaunch!: (error: Error) => void;
    mocks.loadURL.mockReturnValueOnce(new Promise<void>((_resolve, reject) => { abortLoad = reject; }));
    mocks.openExternal.mockReturnValueOnce(new Promise<void>((_resolve, reject) => { rejectLaunch = reject; }));
    const pending = new CommunityWindow().open(parent);
    latestWindow().webContents.emit('will-frame-navigate', navigation(invite));
    abortLoad(Object.assign(new Error('ERR_ABORTED'), { code: 'ERR_ABORTED' }));
    await Promise.resolve();
    rejectLaunch(new Error('QQ not installed'));
    await expect(pending).rejects.toThrow('QQ not installed');
    expect(latestWindow().isDestroyed()).toBe(true);
  });
});
