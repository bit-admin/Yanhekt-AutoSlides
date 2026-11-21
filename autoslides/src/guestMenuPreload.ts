/**
 * Draws the saved-logins menu in its own native view above the sign-in page,
 * so the page's scripts never see the saved usernames. It takes plain data
 * from main and renders with textContent only.
 */
import { ipcRenderer } from 'electron';
import { GUEST_MENU_EVENT_CHANNEL, GUEST_MENU_RENDER_CHANNEL, type GuestMenuState } from '@common/guestView';

const MARGIN = 12;

function report(payload: Record<string, unknown>): void {
  ipcRenderer.send(GUEST_MENU_EVENT_CHANNEL, payload);
}

function render(state: GuestMenuState): void {
  const { theme } = state;
  document.documentElement.style.background = 'transparent';
  Object.assign(document.body.style, {
    margin: `${MARGIN}px`,
    background: 'transparent',
    font: '13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    overflow: 'hidden',
    userSelect: 'none',
  });

  const panel = document.createElement('div');
  panel.setAttribute('role', 'listbox');
  panel.setAttribute('aria-label', state.heading);
  Object.assign(panel.style, {
    boxSizing: 'border-box',
    padding: '4px',
    border: `1px solid ${theme.border}`,
    borderRadius: '10px',
    background: theme.background,
    boxShadow: `0 4px 10px ${theme.shadow}`,
  });
  panel.addEventListener('mousedown', (event) => event.preventDefault());

  const heading = document.createElement('div');
  heading.textContent = state.heading;
  Object.assign(heading.style, { padding: '4px 8px 6px', fontSize: '11px', fontWeight: '600', color: theme.muted });
  panel.appendChild(heading);

  state.rows.forEach((row, index) => {
    const item = document.createElement('div');
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', String(index === state.highlight));
    Object.assign(item.style, {
      padding: '6px 8px',
      borderRadius: '6px',
      color: theme.text,
      cursor: 'pointer',
      background: index === state.highlight ? theme.selected : 'transparent',
    });
    const name = document.createElement('div');
    name.textContent = row.username;
    Object.assign(name.style, { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
    item.appendChild(name);
    if (row.badge !== row.username) {
      const badge = document.createElement('div');
      badge.textContent = row.badge;
      Object.assign(badge.style, {
        fontSize: '11px', color: theme.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      });
      item.appendChild(badge);
    }
    item.addEventListener('mouseenter', () => report({ type: 'hover', index }));
    item.addEventListener('mousedown', (event) => {
      if (event.button === 0) report({ type: 'pick', index });
    });
    panel.appendChild(item);
  });

  document.body.replaceChildren(panel);
  report({ type: 'size', height: Math.ceil(panel.getBoundingClientRect().height) });
}

ipcRenderer.on(GUEST_MENU_RENDER_CHANNEL, (_event, state: GuestMenuState) => render(state));
