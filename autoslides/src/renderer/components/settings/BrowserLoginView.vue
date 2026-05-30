<template>
  <div class="flex h-full w-full flex-col bg-page">
    <!-- Control Bar -->
    <div class="flex flex-shrink-0 items-center gap-2 border-b border-line bg-modal px-4 py-2.5">
      <button :class="[ctrlBtn, ctrlBtnClose]" @click="closeBrowser" :title="$t('browserLogin.close')">
        <svg class="shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
        <span class="whitespace-nowrap max-[900px]:hidden">{{ $t('browserLogin.close') }}</span>
      </button>
      <button :class="[ctrlBtn, ctrlBtnNeutral]" @click="loadLoginPage" :title="$t('browserLogin.loginPage')">
        <svg class="shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
        <span class="whitespace-nowrap max-[900px]:hidden">{{ $t('browserLogin.loginPage') }}</span>
      </button>
      <button :class="[ctrlBtn, ctrlBtnNeutral]" @click="refresh" :title="$t('browserLogin.refresh')">
        <svg class="shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10"></polyline>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
        </svg>
        <span class="whitespace-nowrap max-[900px]:hidden">{{ $t('browserLogin.refresh') }}</span>
      </button>
      <div class="flex-1"></div>
      <button :class="[ctrlBtn, ctrlBtnToken]" @click="getTokenManually" :title="$t('browserLogin.getToken')">
        <svg class="shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
        <span class="whitespace-nowrap max-[900px]:hidden">{{ $t('browserLogin.getToken') }}</span>
      </button>
      <button :class="[ctrlBtn, ctrlBtnNeutral]" @click="clearBrowserData" :title="$t('browserLogin.clearData')">
        <svg class="shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
        <span class="whitespace-nowrap max-[900px]:hidden">{{ $t('browserLogin.clearData') }}</span>
      </button>
    </div>

    <!-- Webview Container -->
    <div class="relative flex-1 overflow-hidden">
      <webview
        ref="webviewRef"
        :src="loginUrl"
        partition="persist:browserlogin"
        class="h-full w-full border-none"
        @did-navigate="onNavigate"
        @did-navigate-in-page="onNavigateInPage"
        @dom-ready="onDomReady"
      ></webview>
    </div>

    <!-- Status Bar -->
    <div class="mb-[5px] flex min-h-[28px] flex-shrink-0 items-center gap-4 border-t border-line bg-modal px-4 py-1.5">
      <div class="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shrink-0 stroke-[#888] dark:stroke-[#666]">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>
        <span class="truncate text-[11px] text-fg-secondary">{{ currentUrl }}</span>
      </div>
      <span :class="['flex-shrink-0 whitespace-nowrap text-[11px]', statusMsgClass]">{{ statusMessage || 'Ready' }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'token-received', token: string): void;
}>();

// Control-bar button class strings (neutral / destructive close / accent token).
const ctrlBtn =
  'flex items-center gap-1.5 rounded border px-3 py-1.5 text-[13px] cursor-pointer transition-colors max-[900px]:px-2';
const ctrlBtnNeutral =
  'border-[#e0e0e0] bg-[#f5f5f5] text-fg hover:border-[#d0d0d0] hover:bg-[#e8e8e8] dark:border-[#505050] dark:bg-[#3d3d3d] dark:text-[#e0e0e0] dark:hover:border-[#606060] dark:hover:bg-[#4d4d4d]';
const ctrlBtnClose =
  'border-[#dc3545] bg-white text-[#dc3545] hover:bg-[#dc3545] hover:text-white dark:border-[#ff6b6b] dark:bg-[#3d3d3d] dark:text-[#ff6b6b] dark:hover:bg-[#ff6b6b] dark:hover:text-white';
const ctrlBtnToken =
  'border-[#007acc] bg-[#007acc] text-white hover:border-[#005a9e] hover:bg-[#005a9e] dark:border-[#2563eb] dark:bg-[#2563eb] dark:hover:border-[#1d4ed8] dark:hover:bg-[#1d4ed8]';

const loginUrl = 'https://sso.bit.edu.cn/cas/login?service=https:%2F%2Fcbiz.yanhekt.cn%2Fv1%2Fcas%2Fcallback';
const targetUrl = 'https://www.yanhekt.cn/';

const webviewRef = ref<Electron.WebviewTag | null>(null);
const currentUrl = ref(loginUrl);
const statusMessage = ref('');
const statusType = ref<'info' | 'success' | 'error'>('info');

const statusMsgClass = computed(() =>
  statusType.value === 'success'
    ? 'text-[#28a745] dark:text-[#4caf50]'
    : statusType.value === 'error'
      ? 'text-[#dc3545] dark:text-[#ff6b6b]'
      : 'text-[#888] dark:text-[#b0b0b0]'
);

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

