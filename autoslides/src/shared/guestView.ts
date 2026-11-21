/** Embedded web surfaces, hosted in main as WebContentsViews. */
export type GuestKind = 'browserLogin' | 'webCapture' | 'yuketang';

export interface GuestRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type GuestEvent =
  | { kind: GuestKind; type: 'did-navigate' | 'did-navigate-in-page'; url: string }
  | { kind: GuestKind; type: 'did-start-loading' | 'did-stop-loading' | 'did-finish-load' | 'dom-ready' }
  | { kind: GuestKind; type: 'page-title-updated'; title: string }
  /** The main frame could not load (never a navigation the page itself replaced). */
  | { kind: GuestKind; type: 'did-fail-load'; url: string; errorCode: number }
  | { kind: GuestKind; type: 'message'; channel: string; payload: unknown }
  | { kind: GuestKind; type: 'menu-hover' | 'menu-pick'; index: number };

export interface GuestMenuTheme {
  background: string;
  text: string;
  muted: string;
  border: string;
  selected: string;
  shadow: string;
}

export interface GuestMenuState {
  heading: string;
  rows: { username: string; badge: string }[];
  highlight: number;
  /** Top-left of the menu and its width, in guest CSS pixels. */
  left: number;
  top: number;
  width: number;
  /** Top of the field it belongs to: the menu opens above it when there is more room. */
  anchorTop?: number;
  theme: GuestMenuTheme;
}

export const GUEST_MESSAGE_CHANNEL = 'guest:message';
export const GUEST_MENU_RENDER_CHANNEL = 'guest-menu:render';
export const GUEST_MENU_EVENT_CHANNEL = 'guest-menu:event';

/** Guest-to-host channels each surface may use. Yuketang has no preload. */
export const GUEST_INBOUND: Record<GuestKind, readonly string[]> = {
  browserLogin: ['autofill:focus', 'autofill:rect', 'autofill:input', 'autofill:blur', 'autofill:key', 'autofill:filled'],
  webCapture: [
    'video:detected', 'video:none', 'frame', 'capture:tainted', 'capture:noVideo',
    'picker:result', 'picker:cancel', 'blocker:result', 'blocker:cancel',
  ],
  yuketang: [],
};

/** Host-to-guest channels each surface accepts. */
export const GUEST_OUTBOUND: Record<GuestKind, readonly string[]> = {
  browserLogin: ['autofill:state', 'autofill:fill'],
  webCapture: [
    'capture:start', 'capture:tick', 'capture:stop', 'picker:start', 'picker:cancel',
    'blocker:start', 'blocker:cancel', 'blocker:clear', 'detect:video',
  ],
  yuketang: [],
};

export function isGuestKind(value: unknown): value is GuestKind {
  return value === 'browserLogin' || value === 'webCapture' || value === 'yuketang';
}

/** Web Capture is the only surface whose address bar accepts local files. */
export function isGuestUrlAllowed(kind: GuestKind, raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  try {
    const { protocol, href } = new URL(raw);
    if (protocol === 'http:' || protocol === 'https:') return true;
    if (href === 'about:blank') return true;
    return protocol === 'file:' && kind === 'webCapture';
  } catch {
    return false;
  }
}

/** Converts a rectangle in host CSS pixels to whole window DIPs. */
export function scaleGuestRect(rect: GuestRect, zoom: number): GuestRect {
  const left = Math.round(rect.x * zoom);
  const top = Math.round(rect.y * zoom);
  return {
    x: left,
    y: top,
    width: Math.max(0, Math.round((rect.x + rect.width) * zoom) - left),
    height: Math.max(0, Math.round((rect.y + rect.height) * zoom) - top),
  };
}

export function parseGuestRect(value: unknown): GuestRect | null {
  if (!value || typeof value !== 'object') return null;
  const { x, y, width, height } = value as Record<string, unknown>;
  if (![x, y, width, height].every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
  if ((width as number) < 0 || (height as number) < 0) return null;
  return { x, y, width, height } as GuestRect;
}
