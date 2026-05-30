<template>
  <div class="browser-login-view">
    <!-- Control Bar -->
    <div class="control-bar">
      <button class="control-btn close-btn" @click="closeBrowser" :title="$t('browserLogin.close')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
        <span class="btn-text">{{ $t('browserLogin.close') }}</span>
      </button>
      <button class="control-btn" @click="loadLoginPage" :title="$t('browserLogin.loginPage')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
        <span class="btn-text">{{ $t('browserLogin.loginPage') }}</span>
      </button>
      <button class="control-btn" @click="refresh" :title="$t('browserLogin.refresh')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10"></polyline>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
        </svg>
        <span class="btn-text">{{ $t('browserLogin.refresh') }}</span>
      </button>
      <div class="control-spacer"></div>
      <button class="control-btn token-btn" @click="getTokenManually" :title="$t('browserLogin.getToken')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
        <span class="btn-text">{{ $t('browserLogin.getToken') }}</span>
      </button>
      <button class="control-btn" @click="clearBrowserData" :title="$t('browserLogin.clearData')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
        <span class="btn-text">{{ $t('browserLogin.clearData') }}</span>
      </button>
    </div>

    <!-- Webview Container -->
    <div class="webview-container">
      <webview
        ref="webviewRef"
        :src="loginUrl"
        partition="persist:browserlogin"
        class="login-webview"
        @did-navigate="onNavigate"
        @did-navigate-in-page="onNavigateInPage"
        @dom-ready="onDomReady"
      ></webview>
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
import { ref, onUnmounted } from 'vue';

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'token-received', token: string): void;
}>();

const loginUrl = 'https://sso.bit.edu.cn/cas/login?service=https:%2F%2Fcbiz.yanhekt.cn%2Fv1%2Fcas%2Fcallback';
const targetUrl = 'https://www.yanhekt.cn/';

const webviewRef = ref<Electron.WebviewTag | null>(null);
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
    console.error('Failed to extract token:', error);
    return null;
  }
};

const getTokenManually = async () => {
  showStatus('Extracting token...', 'info');
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
          console.error('Failed to clear storage:', e);
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
    console.error('Failed to clear browser data:', error);
    showStatus('Failed to clear browser data', 'error');
  }
};

const startAutoTokenCheck = () => {
  stopAutoTokenCheck();
  autoTokenCheckInterval = setInterval(async () => {
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

const onNavigate = (event: Electron.DidNavigateEvent) => {
  currentUrl.value = event.url;

  // Check if we've reached the target URL
  if (event.url.startsWith(targetUrl)) {
    showStatus('Login successful! Checking for token...', 'info', 0);
    startAutoTokenCheck();
  }
};

const onNavigateInPage = (event: Electron.DidNavigateInPageEvent) => {
  currentUrl.value = event.url;

  if (event.url.startsWith(targetUrl)) {
    showStatus('Login successful! Checking for token...', 'info', 0);
    startAutoTokenCheck();
  }
};

const onDomReady = () => {
  // Check if we're already on the target page (e.g., if user was already logged in)
  if (currentUrl.value.startsWith(targetUrl)) {
    startAutoTokenCheck();
  }
};

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
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.control-spacer {
  flex: 1;
}

.control-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--bg-page);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s ease;
}

.control-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-input);
}

.control-btn.close-btn {
  background: var(--bg-surface);
  color: var(--danger);
  border-color: var(--danger);
}

.control-btn.close-btn:hover {
  background: var(--danger);
  color: var(--text-on-accent);
}

.control-btn.close-btn svg {
  stroke: currentColor;
}

.control-btn.token-btn {
  background: var(--accent);
  color: var(--text-on-accent);
  border-color: var(--accent);
}

.control-btn.token-btn:hover {
  background: var(--accent-strong);
  border-color: var(--accent-strong);
}

.control-btn.token-btn svg {
  stroke: var(--text-on-accent);
}

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

.status-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 6px 16px;
  background: var(--bg-surface);
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
  color: var(--text-muted);
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
