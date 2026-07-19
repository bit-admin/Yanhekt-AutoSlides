// GitHub Copilot connect flow for the AI-filtering settings section.
// Web port of autoslides/src/renderer/features/ai/useCopilotOAuth.ts: same
// state machine (idle → waiting → polling → success / error), backed by the
// copilot-proxy API client instead of IPC and by configStore instead of the
// electron config. Fields persist immediately on connect/disconnect (the web
// settings page has no commit/discard cycle).

import { ref } from 'vue';
import { configStore, persistConfig } from '../stores/configStore';
import {
  requestDeviceCode,
  pollForAccessToken,
  getUserInfo,
} from '../lib/ai/copilotAuth';
import { createLogger } from '../lib/logger';

const log = createLogger('CopilotOAuth');

export type CopilotOAuthStep = 'idle' | 'waiting' | 'polling' | 'success' | 'error';

export function useCopilotOAuth() {
  const copilotOAuthStep = ref<CopilotOAuthStep>(configStore.aiCopilotToken ? 'success' : 'idle');
  const copilotUserCode = ref('');
  const copilotVerificationUri = ref('');
  // 'expired_token' | 'access_denied' | 'invalid_token' | free-form message.
  const copilotOAuthError = ref('');
  const isCopilotLoading = ref(false);
  let pollAbort: AbortController | null = null;

  // Backfill identity for tokens saved before the username was captured.
  if (configStore.aiCopilotToken && !configStore.aiCopilotUsername) {
    getUserInfo(configStore.aiCopilotToken)
      .then((user) => {
        configStore.aiCopilotUsername = user.login;
        configStore.aiCopilotAvatarUrl = user.avatar_url;
        persistConfig();
      })
      .catch(() => log.warn('Failed to fetch Copilot user info on load'));
  }

  function adoptToken(token: string, user: { login: string; avatar_url: string }) {
    configStore.aiCopilotToken = token;
    configStore.aiCopilotUsername = user.login;
    configStore.aiCopilotAvatarUrl = user.avatar_url;
    persistConfig();
    copilotOAuthStep.value = 'success';
  }

  async function startCopilotOAuth() {
    copilotOAuthError.value = '';
    copilotOAuthStep.value = 'waiting';
    isCopilotLoading.value = true;
    pollAbort = new AbortController();
    const signal = pollAbort.signal;

    try {
      const deviceCode = await requestDeviceCode();
      if (signal.aborted) return;

      copilotUserCode.value = deviceCode.user_code;
      copilotVerificationUri.value = deviceCode.verification_uri;
      try {
        await navigator.clipboard.writeText(deviceCode.user_code);
      } catch {
        // Clipboard may be unavailable (permissions); the code is shown anyway.
      }
      window.open(deviceCode.verification_uri, '_blank', 'noopener');

      copilotOAuthStep.value = 'polling';
      const { token, user } = await pollForAccessToken(deviceCode, signal);
      if (signal.aborted) return;

      const identity = user ?? (await getUserInfo(token));
      adoptToken(token, identity);
    } catch (error) {
      if (signal.aborted) return;
      const msg = error instanceof Error ? error.message : String(error);
      copilotOAuthStep.value = 'error';
      if (msg.includes('expired_token')) copilotOAuthError.value = 'expired_token';
      else if (msg.includes('access_denied')) copilotOAuthError.value = 'access_denied';
      else copilotOAuthError.value = msg;
    } finally {
      if (!pollAbort?.signal.aborted) isCopilotLoading.value = false;
      pollAbort = null;
    }
  }

  /** Paste-token fallback: validate via /api/auth/me, then adopt. */
  async function validateCopilotToken(token: string): Promise<boolean> {
    const trimmed = token.trim();
    if (!trimmed) return false;
    isCopilotLoading.value = true;
    copilotOAuthError.value = '';
    try {
      const user = await getUserInfo(trimmed);
      adoptToken(trimmed, user);
      return true;
    } catch {
      copilotOAuthStep.value = 'error';
      copilotOAuthError.value = 'invalid_token';
      return false;
    } finally {
      isCopilotLoading.value = false;
    }
  }

  function disconnectCopilot() {
    configStore.aiCopilotToken = '';
    configStore.aiCopilotUsername = '';
    configStore.aiCopilotAvatarUrl = '';
    persistConfig();
    copilotOAuthStep.value = 'idle';
    copilotOAuthError.value = '';
    copilotUserCode.value = '';
    copilotVerificationUri.value = '';
  }

  /** Abort an in-flight device flow (also called on settings unmount). */
  function cancelCopilotOAuth() {
    pollAbort?.abort();
    pollAbort = null;
    isCopilotLoading.value = false;
    if (copilotOAuthStep.value === 'waiting' || copilotOAuthStep.value === 'polling') {
      copilotOAuthStep.value = configStore.aiCopilotToken ? 'success' : 'idle';
    }
    copilotUserCode.value = '';
    copilotVerificationUri.value = '';
    copilotOAuthError.value = '';
  }

  return {
    copilotOAuthStep,
    copilotUserCode,
    copilotVerificationUri,
    copilotOAuthError,
    isCopilotLoading,
    startCopilotOAuth,
    validateCopilotToken,
    disconnectCopilot,
    cancelCopilotOAuth,
  };
}
