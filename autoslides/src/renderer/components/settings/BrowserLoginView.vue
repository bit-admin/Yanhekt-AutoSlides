<template>
  <div class="browser-login-view">
    <!-- Control Bar -->
    <div class="control-bar">
      <button class="btn control-btn close-btn" @click="closeBrowser" :title="$t('browserLogin.close')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
        <span class="btn-text">{{ $t('browserLogin.close') }}</span>
      </button>
      <button class="btn control-btn" @click="loadLoginPage" :title="$t('browserLogin.loginPage')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
        <span class="btn-text">{{ $t('browserLogin.loginPage') }}</span>
      </button>
      <button class="btn control-btn" @click="refresh" :title="$t('browserLogin.refresh')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10"></polyline>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
        </svg>
        <span class="btn-text">{{ $t('browserLogin.refresh') }}</span>
      </button>
      <div class="control-spacer"></div>
      <button class="btn btn--primary control-btn token-btn" @click="getTokenManually" :title="$t('browserLogin.getToken')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
        <span class="btn-text">{{ $t('browserLogin.getToken') }}</span>
      </button>
      <button class="btn control-btn" @click="clearBrowserData" :title="$t('browserLogin.clearData')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
        <span class="btn-text">{{ $t('browserLogin.clearData') }}</span>
      </button>
    </div>

    <!-- Webview Container -->
    <div ref="containerRef" class="webview-container">
      <!-- Mounted once the guest preload path is known: a webview reads its
           preload attribute only when it first loads. -->
      <webview
        v-if="guestPreload !== null"
        ref="webviewRef"
        :src="loginUrl"
        :preload="guestPreload || undefined"
        partition="persist:browserlogin"
        class="login-webview"
        @did-navigate="onNavigate"
        @did-navigate-in-page="onNavigateInPage"
        @did-start-loading="menu.close()"
        @dom-ready="onDomReady"
        @ipc-message="onGuestMessage"
      ></webview>

      <!-- Saved-logins menu over the CAS form, placed under the field the
           guest preload reported. -->
      <SavedLoginMenu
        v-if="menu.visible.value && menuStyle"
        class="autofill-flyout"
        :style="menuStyle"
        :rows="menu.matches.value"
        :highlight="menu.highlight.value"
        @hover="menu.highlight.value = $event"
        @pick="pick"
      />
    </div>

    <!-- Status Bar -->
    <div class="status-bar">
      <div class="url-display">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="url-icon">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>
        <span class="url-text">{{ currentUrl }}</span>
      </div>
      <span :class="['status-message', statusType]">{{ statusMessage || 'Ready' }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { createLogger } from '@shared/utils/logger';
const log = createLogger('BrowserLoginView');
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useSavedLoginMenu, type SavedLoginRow } from '@features/platform/useSavedLoginMenu';
import { useAuth, type BrowserLoginTarget } from '@features/platform/useAuth';
import { describeYanhe2Failure } from '@features/platform/yanhe2AccountUi';
import { YANHE2_CASAPI_CAS_URL, YANHE2_CASAPI_ENTRY_URL, YANHE2_ORIGIN } from '@common/yanhe2';
import SavedLoginMenu from './SavedLoginMenu.vue';

const props = withDefaults(defineProps<{ target?: BrowserLoginTarget }>(), { target: 'yanhekt' });

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'token-received', token: string): void;
  /** Yanhe 2.0 target: main has verified and stored the session. */
  (e: 'yanhe2-signed-in'): void;
}>();

const isYanhe2 = props.target === 'yanhe2';
const { userId } = useAuth();

// Yanhe 2.0 starts at casapi hop 1 (seats PHPSESSID). That lands on yjlogin's
// "choose your school" page, which onNavigate skips by opening hop 2 — the
// same URL yjlogin opens once BIT is picked — so the user goes straight to CAS.
const loginUrl = isYanhe2
  ? YANHE2_CASAPI_ENTRY_URL
  : 'https://sso.bit.edu.cn/cas/login?service=https:%2F%2Fcbiz.yanhekt.cn%2Fv1%2Fcas%2Fcallback';
const targetUrl = isYanhe2 ? `${YANHE2_ORIGIN}/` : 'https://www.yanhekt.cn/';

// Back on the site after CAS. For Yanhe 2.0 the casapi/yjlogin hops are on the
// same origin but come *before* sign-in, so they do not count.
const reachedTarget = (url: string): boolean =>
  url.startsWith(targetUrl) && !(isYanhe2 && /\/(casapi|yjlogin)\//.test(url));

const webviewRef = ref<Electron.WebviewTag | null>(null);
const containerRef = ref<HTMLElement | null>(null);
// null = still resolving; '' = unavailable (the webview then loads without it).
const guestPreload = ref<string | null>(null);
const currentUrl = ref(loginUrl);
const statusMessage = ref('');
const statusType = ref<'info' | 'success' | 'error'>('info');

let autoTokenCheckInterval: ReturnType<typeof setInterval> | null = null;

const showStatus = (message: string, type: 'info' | 'success' | 'error' = 'info', duration = 3000) => {
  statusMessage.value = message;
  statusType.value = type;
  if (duration > 0) {
    setTimeout(() => {
      statusMessage.value = '';
    }, duration);
  }
};

const closeBrowser = () => {
  stopAutoTokenCheck();
  emit('close');
};

const loadLoginPage = () => {
  if (webviewRef.value) {
    webviewRef.value.src = loginUrl;
    currentUrl.value = loginUrl;
    showStatus('Loading login page...', 'info');
  }
};

const refresh = () => {
  if (webviewRef.value) {
    webviewRef.value.reload();
    showStatus('Refreshing...', 'info');
  }
};

// Yanhe 2.0: the token is the `_token` cookie, which main reads straight from
// the partition and verifies itself, so the renderer never holds it. Returns
// true once the session is stored; reports a definite failure on the bar.
let adopting = false;
const adoptYanhe2Session = async (manual: boolean): Promise<boolean> => {
  if (adopting) return false;
  adopting = true;
  try {
    const result = await window.electronAPI.yanhe2.adoptBrowserSession(userId.value);
    if (result.success) {
      showStatus('Signed in to Yanhe 2.0.', 'success');
      stopAutoTokenCheck();
      emit('yanhe2-signed-in');
      return true;
    }
    if (result.reason !== 'pending') {
      stopAutoTokenCheck();
      showStatus(describeYanhe2Failure(result), 'error', 0);
    } else if (manual) {
      showStatus('No token found. Please complete login first.', 'error', 5000);
    }
    return false;
  } catch (error) {
    log.error('Failed to read the Yanhe 2.0 session:', error);
    return false;
  } finally {
    adopting = false;
  }
};

const extractToken = async (): Promise<string | null> => {
  if (!webviewRef.value) return null;

  try {
    const result = await webviewRef.value.executeJavaScript(`
      (function() {
        try {
          const auth = localStorage.getItem('auth');
          if (auth) {
            const parsed = JSON.parse(auth);
            return parsed.token || null;
          }
          return null;
        } catch (e) {
          return null;
        }
      })()
    `);
    return result;
  } catch (error) {
    log.error('Failed to extract token:', error);
    return null;
  }
};

const getTokenManually = async () => {
  showStatus('Extracting token...', 'info');
  if (isYanhe2) {
    await adoptYanhe2Session(true);
    return;
  }
  const token = await extractToken();

  if (token) {
    showStatus('Token found!', 'success');
    emit('token-received', token);
  } else {
    showStatus('No token found. Please complete login first.', 'error', 5000);
  }
};

const clearBrowserData = async () => {
  if (!webviewRef.value) return;

  showStatus('Clearing browser data...', 'info');

  try {
    // Clear localStorage for yanhekt.cn
    await webviewRef.value.executeJavaScript(`
      (function() {
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch (e) {
          log.error('Failed to clear storage:', e);
        }
      })()
    `);

    // Use Electron's session to clear cookies and cache
    // This is done via IPC to the main process
    await window.electronAPI.auth.clearBrowserData();

    showStatus('Browser data cleared. Reloading login page...', 'success');

    // Reload login page after clearing
    setTimeout(() => {
      loadLoginPage();
    }, 500);
  } catch (error) {
    log.error('Failed to clear browser data:', error);
    showStatus('Failed to clear browser data', 'error');
  }
};

const startAutoTokenCheck = () => {
  stopAutoTokenCheck();
  autoTokenCheckInterval = setInterval(async () => {
    if (isYanhe2) {
      await adoptYanhe2Session(false);
      return;
    }
    const token = await extractToken();
    if (token) {
      showStatus('Token detected automatically!', 'success');
      stopAutoTokenCheck();
      emit('token-received', token);
    }
  }, 1000);
};

const stopAutoTokenCheck = () => {
  if (autoTokenCheckInterval) {
    clearInterval(autoTokenCheckInterval);
    autoTokenCheckInterval = null;
  }
};

// ---- Saved-logins menu ------------------------------------------------------
// The guest preload (src/webviewSsoPreload.ts) reports the CAS fields; the
// menu itself is host UI drawn over the webview. A password is decrypted and
// sent to the guest only when the user picks a row, and only while the
// webview is still on the SSO origin.

const SSO_ORIGIN = 'https://sso.bit.edu.cn';
const MENU_MIN_WIDTH = 240;

interface GuestRect {
  left: number;
  top: number;
  bottom: number;
  width: number;
}

const autofillQuery = ref('');
const autofillRect = ref<GuestRect | null>(null);
const menu = useSavedLoginMenu(autofillQuery);

const menuStyle = computed(() => {
  const rect = autofillRect.value;
  if (!rect) return null;
  const containerWidth = containerRef.value?.clientWidth ?? 0;
  const width = Math.max(rect.width, MENU_MIN_WIDTH);
  const maxLeft = Math.max(8, containerWidth - width - 8);
  return {
    left: `${Math.min(Math.max(rect.left, 8), maxLeft)}px`,
    top: `${rect.bottom + 4}px`,
    width: `${width}px`,
  };
});

const parseRect = (value: unknown): GuestRect | null => {
  if (!value || typeof value !== 'object') return null;
  const { left, top, bottom, width } = value as Record<string, unknown>;
  if (![left, top, bottom, width].every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
  return { left, top, bottom, width } as GuestRect;
};

const sendToGuest = (channel: string, payload: unknown) => {
  try {
    webviewRef.value?.send(channel, payload);
  } catch {
    // The guest is between pages; the next focus report resyncs it.
  }
};

const isOnSsoPage = () => {
  try {
    return new URL(webviewRef.value?.getURL() ?? '').origin === SSO_ORIGIN;
  } catch {
    return false;
  }
};

// The guest intercepts arrows / Escape / Enter only while it knows the menu is
// open, and Enter only once a row is highlighted — otherwise Enter submits.
watch([menu.visible, menu.highlight], ([visible, highlight]) => {
  sendToGuest('autofill:state', { open: visible, highlighted: visible && highlight >= 0 });
});

const pick = async (row: SavedLoginRow) => {
  menu.close();
  if (!isOnSsoPage()) return;
  const saved = await menu.reveal(row);
  if (!saved || !isOnSsoPage()) return;
  webviewRef.value?.focus();
  sendToGuest('autofill:fill', { username: saved.username, password: saved.password });
};

const onGuestMessage = (event: Electron.IpcMessageEvent) => {
  const payload = (event.args?.[0] ?? {}) as Record<string, unknown>;
  switch (event.channel) {
    case 'autofill:focus': {
      const rect = parseRect(payload.rect);
      if (!rect) return;
      autofillRect.value = rect;
      autofillQuery.value = typeof payload.username === 'string' ? payload.username : '';
      void menu.show();
      break;
    }
    case 'autofill:rect': {
      const rect = parseRect(payload.rect);
      if (rect) autofillRect.value = rect;
      break;
    }
    case 'autofill:input':
      autofillQuery.value = typeof payload.username === 'string' ? payload.username : '';
      // Typing a password means the user is not picking a saved one.
      if (payload.field === 'password') menu.close();
      break;
    case 'autofill:blur':
    case 'autofill:filled':
      menu.close();
      break;
    case 'autofill:key':
      if (payload.key === 'ArrowDown') menu.move(1);
      else if (payload.key === 'ArrowUp') menu.move(-1);
      else if (payload.key === 'Escape') menu.close();
      else if (payload.key === 'Enter' && menu.current.value) void pick(menu.current.value);
      break;
  }
};

const onNavigate = (event: Electron.DidNavigateEvent) => {
  currentUrl.value = event.url;

  if (isYanhe2 && event.url.startsWith(`${YANHE2_ORIGIN}/yjlogin/`)) {
    webviewRef.value?.loadURL(YANHE2_CASAPI_CAS_URL);
    return;
  }

  // Check if we've reached the target URL
  if (reachedTarget(event.url)) {
    showStatus('Login successful! Checking for token...', 'info', 0);
    startAutoTokenCheck();
  }
};

const onNavigateInPage = (event: Electron.DidNavigateInPageEvent) => {
  currentUrl.value = event.url;

  if (reachedTarget(event.url)) {
    showStatus('Login successful! Checking for token...', 'info', 0);
    startAutoTokenCheck();
  }
};

const onDomReady = () => {
  // Check if we're already on the target page (e.g., if user was already logged in)
  if (reachedTarget(currentUrl.value)) {
    startAutoTokenCheck();
  }
};

onMounted(async () => {
  if (isYanhe2) {
    // Drop a leftover `_token` first, so the one we pick up is this sign-in's.
    try {
      await window.electronAPI.yanhe2.prepareBrowserSignIn();
    } catch (error) {
      log.warn('Could not clear the previous Yanhe 2.0 browser session:', error);
    }
  }
  try {
    guestPreload.value = await window.electronAPI.auth.getBrowserLoginPreloadPath();
  } catch (error) {
    log.warn('Browser sign-in preload unavailable; saved logins will not be offered:', error);
    guestPreload.value = '';
  }
});

onUnmounted(() => {
  stopAutoTokenCheck();
});
</script>

<style scoped>
.browser-login-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: var(--bg-page);
}

.control-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.control-spacer {
  flex: 1;
}

/* Close / Get Token are the shared .btn / .btn--primary; only Get Token is
   filled (the one primary on this bar). */
.control-btn svg {
  flex-shrink: 0;
}

.btn-text {
  white-space: nowrap;
}

.webview-container {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.login-webview {
  width: 100%;
  height: 100%;
  border: none;
}

.autofill-flyout {
  position: absolute;
  z-index: var(--z-dropdown);
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 6px 16px;
  background: var(--bg-elevated);
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
  min-height: 28px;
  margin-bottom: 5px;
}

.url-display {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  min-width: 0;
}

.url-icon {
  flex-shrink: 0;
  stroke: var(--text-muted);
}

.url-text {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-message {
  font-size: 11px;
  flex-shrink: 0;
  white-space: nowrap;
}

.status-message.info {
  color: var(--text-secondary);
}

.status-message.success {
  color: var(--success);
}

.status-message.error {
  color: var(--danger);
}

/* Responsive adjustments */
@media (max-width: 900px) {
  .btn-text {
    display: none;
  }

  .control-btn {
    padding: 6px 8px;
  }
}
</style>
