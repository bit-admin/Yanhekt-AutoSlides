import { describe, expect, it } from 'vitest';
import { createLocalAccessSecret, hasLocalAccess, isAppPageUrl, isLocalProxyUrl, isLoopbackHost } from './localAccess';

describe('localAccess', () => {
  const secret = createLocalAccessSecret();

  it('accepts only this launch secret', () => {
    expect(secret).toMatch(/^[0-9a-f]{64}$/);
    expect(hasLocalAccess({ 'x-autoslides-local': secret }, secret)).toBe(true);
    expect(hasLocalAccess({ 'x-autoslides-local': createLocalAccessSecret() }, secret)).toBe(false);
    expect(hasLocalAccess({ 'x-autoslides-local': secret.slice(1) }, secret)).toBe(false);
    expect(hasLocalAccess({}, secret)).toBe(false);
    expect(hasLocalAccess({ 'x-autoslides-local': '' }, '')).toBe(false);
  });

  it('accepts only a loopback Host for its own port (no DNS rebinding)', () => {
    expect(isLoopbackHost('localhost:5050', 5050)).toBe(true);
    expect(isLoopbackHost('127.0.0.1:5050', 5050)).toBe(true);
    expect(isLoopbackHost('[::1]:5050', 5050)).toBe(true);
    expect(isLoopbackHost('evil.example:5050', 5050)).toBe(false);
    expect(isLoopbackHost('localhost:5051', 5050)).toBe(false);
    expect(isLoopbackHost(undefined, 5050)).toBe(false);
    expect(isLoopbackHost('localhost:0', 0)).toBe(false);
  });

  it('matches proxy URLs on the port only', () => {
    expect(isLocalProxyUrl('http://localhost:5050/recorded?x=1', 5050)).toBe(true);
    expect(isLocalProxyUrl('http://127.0.0.1:5050/seg.ts', 5050)).toBe(true);
    expect(isLocalProxyUrl('http://localhost:50501/seg.ts', 5050)).toBe(false);
    expect(isLocalProxyUrl('http://localhost:5050/seg.ts', 0)).toBe(false);
  });

  it('trusts only the app pages', () => {
    const dev = ['http://localhost:5173', undefined];
    expect(isAppPageUrl('file:///Applications/AutoSlides.app/Contents/Resources/app.asar/.vite/renderer/main_window/index.html', [])).toBe(true);
    expect(isAppPageUrl('http://localhost:5173/#/home', dev)).toBe(true);
    expect(isAppPageUrl('http://localhost:5174/', dev)).toBe(false);
    expect(isAppPageUrl('https://www.yanhekt.cn/', dev)).toBe(false);
    expect(isAppPageUrl('', dev)).toBe(false);
  });
});
