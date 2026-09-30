/**
 * Guest preload for the "Sign in with browser" <webview> (BrowserLoginView).
 *
 * On the BIT CAS login page it reports focus and typing in the username and
 * password fields, so the host can draw the saved-logins menu over the page,
 * and it fills both fields when the user picks a row. It does nothing on any
 * other origin — the same webview ends up on yanhekt.cn after sign-in.
 *
 * This runs in the preload's isolated world. The page's own scripts cannot
 * read the saved usernames, cannot fake a pick, and see a password only once
 * the user has chosen one (as typed input, the same as if they had typed it).
 *
 * The CAS form is an Angular app (`/gate/public/cas-login`): `#nameInput`
 * (name=username) plus a password input with no name or id inside
 * `.passwordInput`, whose type flips to "text" while the page's own eye toggle
 * is on. Both are bound with ngModel, which listens to `input` events. A hidden
 * duplicate username input is filtered out by `isShown`.
 *
 * Guest -> Host (ipcRenderer.sendToHost):
 *   autofill:focus { field, rect, username }
 *   autofill:rect  { rect }                    field moved (scroll/resize)
 *   autofill:input { field, username }
 *   autofill:blur
 *   autofill:key   { key }                     only while the host menu is open
 *   autofill:filled                            after a fill; the host closes the menu
 * Host -> Guest (webview.send):
 *   autofill:state { open, highlighted }
 *   autofill:fill  { username, password }
 */

import { ipcRenderer } from 'electron';

const SSO_ORIGIN = 'https://sso.bit.edu.cn';

type Field = 'username' | 'password';

interface GuestRect {
  left: number;
  top: number;
  bottom: number;
  width: number;
}

const USERNAME_SELECTORS = [
  '#normalLoginForm #nameInput',
  '#normalLoginForm input[name="username"]',
  'input[autocomplete="username"]',
];

const PASSWORD_SELECTORS = [
  '#normalLoginForm .passwordInput input',
  'input[autocomplete="new-password"]',
  'input[type="password"]',
];

const state = {
  menuOpen: false,
  rowHighlighted: false,
  focused: null as HTMLInputElement | null,
  // Set while we fill, so our own focus/input events are not reported back.
  quiet: false,
  // Enter picked a row on keydown; the page submits on keyup, so eat that too.
  swallowEnterKeyup: false,
};

function onSsoPage(): boolean {
  return location.origin === SSO_ORIGIN;
}

function isShown(el: HTMLInputElement): boolean {
  return el.type !== 'hidden' && !el.disabled && el.getClientRects().length > 0;
}

function firstShown(selectors: string[]): HTMLInputElement | null {
  for (const selector of selectors) {
    for (const el of Array.from(document.querySelectorAll<HTMLInputElement>(selector))) {
      if (isShown(el)) return el;
    }
  }
  return null;
}

function usernameInput(): HTMLInputElement | null {
  return firstShown(USERNAME_SELECTORS);
}

function passwordInput(): HTMLInputElement | null {
  return firstShown(PASSWORD_SELECTORS);
}

function fieldOf(target: EventTarget | null): Field | null {
  if (!(target instanceof HTMLInputElement)) return null;
  if (target === usernameInput()) return 'username';
  if (target === passwordInput()) return 'password';
  return null;
}

function rectOf(el: HTMLElement): GuestRect {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, bottom: r.bottom, width: r.width };
}

function currentUsername(): string {
  return usernameInput()?.value ?? '';
}

function setValue(el: HTMLInputElement, value: string): void {
  // Use the prototype setter so frameworks tracking the value see a change.
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

document.addEventListener('focusin', (event) => {
  if (!onSsoPage()) return;
  const field = fieldOf(event.target);
  if (!field) return;
  const el = event.target as HTMLInputElement;
  state.focused = el;
  if (state.quiet) return;
  ipcRenderer.sendToHost('autofill:focus', { field, rect: rectOf(el), username: currentUsername() });
}, true);

document.addEventListener('focusout', (event) => {
  if (!onSsoPage() || event.target !== state.focused) return;
  state.focused = null;
  if (state.quiet) return;
  ipcRenderer.sendToHost('autofill:blur');
}, true);

document.addEventListener('input', (event) => {
  if (!onSsoPage() || state.quiet) return;
  const field = fieldOf(event.target);
  if (!field) return;
  ipcRenderer.sendToHost('autofill:input', { field, username: currentUsername() });
}, true);

const reportRect = () => {
  if (!onSsoPage() || !state.focused) return;
  ipcRenderer.sendToHost('autofill:rect', { rect: rectOf(state.focused) });
};
window.addEventListener('scroll', reportRect, true);
window.addEventListener('resize', reportRect);

// Capture phase on window runs before the page's own key handlers on the input.
window.addEventListener('keydown', (event) => {
  if (!onSsoPage() || !state.focused || !state.menuOpen) return;
  const { key } = event;
  const handled = key === 'ArrowDown' || key === 'ArrowUp' || key === 'Escape'
    || (key === 'Enter' && state.rowHighlighted);
  if (!handled) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (key === 'Enter') state.swallowEnterKeyup = true;
  ipcRenderer.sendToHost('autofill:key', { key });
}, true);

window.addEventListener('keyup', (event) => {
  if (event.key !== 'Enter' || !state.swallowEnterKeyup) return;
  state.swallowEnterKeyup = false;
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);

ipcRenderer.on('autofill:state', (_event, payload: unknown) => {
  const next = (payload ?? {}) as { open?: unknown; highlighted?: unknown };
  state.menuOpen = next.open === true;
  state.rowHighlighted = state.menuOpen && next.highlighted === true;
});

ipcRenderer.on('autofill:fill', (_event, payload: unknown) => {
  if (!onSsoPage()) return;
  const { username, password } = (payload ?? {}) as { username?: unknown; password?: unknown };
  if (typeof username !== 'string' || typeof password !== 'string') return;
  const userEl = usernameInput();
  const passEl = passwordInput();
  state.quiet = true;
  try {
    if (userEl) setValue(userEl, username);
    if (passEl && password) setValue(passEl, password);
    // Leave focus on the password so Enter signs in.
    (passEl ?? userEl)?.focus();
  } finally {
    state.quiet = false;
  }
  // The host's webview.focus() before the fill restores focus to the field
  // the user left, which reports as an ordinary focus and reopens the menu.
  // This arrives after that report, so the menu ends closed.
  ipcRenderer.sendToHost('autofill:filled');
});
