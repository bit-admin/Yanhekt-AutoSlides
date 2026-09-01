<template>
  <div class="menu-links">
    <!-- Feedback flyout (hover to open) -->
    <div class="menu-link-flyout">
      <button type="button" class="signin-option">
        <svg class="signin-option-icon" width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M2.5 2A1.5 1.5 0 0 0 1 3.5v6A1.5 1.5 0 0 0 2.5 11H4v2.5a.5.5 0 0 0 .82.384L7.714 11H13.5A1.5 1.5 0 0 0 15 9.5v-6A1.5 1.5 0 0 0 13.5 2h-11z"/>
        </svg>
        <span>{{ $t('titlebar.feedback') }}</span>
        <svg
          class="menu-link-chevron"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
      <div class="menu-link-flyout-panel">
        <button type="button" class="signin-option" @click="openFeedbackIssue">
          <svg class="signin-option-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>{{ $t('titlebar.openIssue') }}</span>
          <svg class="menu-link-external" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M15 3h6v6"/>
            <path d="M10 14L21 3"/>
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          </svg>
        </button>
        <button type="button" class="signin-option" @click="openFeedbackEmail">
          <svg class="signin-option-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          <span>{{ $t('titlebar.sendEmail') }}</span>
          <svg class="menu-link-external" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M15 3h6v6"/>
            <path d="M10 14L21 3"/>
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="menu-links-separator"></div>

    <!-- AutoSlides product links (hover flyout). Yanhekt stays first-class below. -->
    <div class="menu-link-flyout">
      <button type="button" class="signin-option">
        <svg class="signin-option-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 16v-4"/>
          <path d="M12 8h.01"/>
        </svg>
        <span>{{ $t('titlebar.autoslides') }}</span>
        <svg
          class="menu-link-chevron"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
      <div class="menu-link-flyout-panel">
        <button type="button" class="signin-option" @click="openGitHub">
          <svg class="signin-option-icon" width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          <span>{{ $t('titlebar.visitGitHub') }}</span>
          <svg class="menu-link-external" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M15 3h6v6"/>
            <path d="M10 14L21 3"/>
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          </svg>
        </button>
        <button type="button" class="signin-option" @click="openITCenter">
          <svg class="signin-option-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <path d="M8 21h8"/>
            <path d="M12 17v4"/>
            <path d="m9 8 3 2.5L9 13"/>
          </svg>
          <span>{{ $t('titlebar.itCenterSoftware') }}</span>
          <svg class="menu-link-external" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M15 3h6v6"/>
            <path d="M10 14L21 3"/>
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          </svg>
        </button>
        <button type="button" class="signin-option" @click="openAutoSlidesWeb">
          <svg class="signin-option-icon" width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" d="M22 8.4c0-1.9-1.6-3.4-3.5-3.4h-13C3.6 5 2 6.5 2 8.4v7.2C2 17.5 3.6 19 5.5 19h13c1.9 0 3.5-1.5 3.5-3.4V8.4zM10 9.25v5.5l5-2.75-5-2.75z"/>
          </svg>
          <span>{{ $t('titlebar.webVersion') }}</span>
          <svg class="menu-link-external" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M15 3h6v6"/>
            <path d="M10 14L21 3"/>
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          </svg>
        </button>
        <button type="button" class="signin-option" @click="openPublicIndex">
          <svg class="signin-option-icon" width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="3" y="3" width="3.6" height="3.6" rx="0.7"/>
            <rect x="8.13" y="3" width="3.6" height="3.6" rx="0.7"/>
            <rect x="13.27" y="3" width="3.6" height="3.6" rx="0.7"/>
            <rect x="18.4" y="3" width="3.6" height="3.6" rx="0.7"/>
            <rect x="3" y="8.13" width="3.6" height="3.6" rx="0.7"/>
            <rect x="8.13" y="8.13" width="3.6" height="3.6" rx="0.7"/>
            <rect x="13.27" y="8.13" width="3.6" height="3.6" rx="0.7"/>
            <rect x="18.4" y="8.13" width="3.6" height="3.6" rx="0.7"/>
            <rect x="3" y="13.27" width="3.6" height="3.6" rx="0.7"/>
            <rect x="8.13" y="13.27" width="3.6" height="3.6" rx="0.7"/>
            <rect x="13.27" y="13.27" width="3.6" height="3.6" rx="0.7"/>
            <rect x="18.4" y="13.27" width="3.6" height="3.6" rx="0.7"/>
            <rect x="3" y="18.4" width="3.6" height="3.6" rx="0.7"/>
            <rect x="8.13" y="18.4" width="3.6" height="3.6" rx="0.7"/>
            <rect x="13.27" y="18.4" width="3.6" height="3.6" rx="0.7"/>
            <rect x="18.4" y="18.4" width="3.6" height="3.6" rx="0.7"/>
          </svg>
          <span>{{ $t('titlebar.publicIndex') }}</span>
          <svg class="menu-link-external" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M15 3h6v6"/>
            <path d="M10 14L21 3"/>
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Open Yanhekt website with the current auth token (homepage when signed out) -->
    <button type="button" class="signin-option" @click="openYanhekt">
      <svg class="signin-option-icon" width="15" height="15" viewBox="-1 0 40 40" fill="currentColor" aria-hidden="true">
        <path d="M13.25,26.42 C10.87,27.01 0.22,29.46 0,29.55 L0,0 L15.42,4.68 L14.63,4.93 L13.22,5.36 L13.22,26.42 Z"/>
        <path d="M8.45,34.91 C10.02,34.23 11.62,33.61 13.25,32.99 L13.25,37.15 L7.41,35.35 C7.76,35.19 8.1,35.07 8.45,34.91 Z"/>
        <path d="M37.65,0 L37.65,11.16 C35.49,11.72 33.29,12.31 31.12,12.99 C29.43,13.52 27.76,14.11 26.07,14.85 C25.22,15.22 24.37,15.63 23.52,16.19 C23.15,16.43 22.8,16.68 22.42,17.05 C22.36,17.12 22.27,17.21 22.2,17.27 C21.98,17.52 21.73,17.83 21.54,18.26 C21.45,18.48 21.36,18.73 21.32,19.01 C21.29,19.29 21.29,19.6 21.32,19.91 C21.39,20.22 21.48,20.5 21.61,20.74 C21.73,20.99 21.89,21.18 22.05,21.36 C22.17,21.52 22.3,21.64 22.42,21.74 C22.58,21.89 22.77,22.02 22.93,22.11 C23.46,22.48 23.96,22.7 24.46,22.91 C24.72,23.01 24.97,23.1 25.25,23.19 C24.78,23.35 24.31,23.5 23.8,23.66 C23.37,23.78 22.93,23.94 22.45,24.06 C22.11,24.16 21.73,24.28 21.36,24.37 C19.72,24.81 18.03,25.24 16.33,25.67 C15.99,25.77 15.64,25.86 15.29,25.92 L15.29,6.82 L18.87,5.74 L37.65,0 Z"/>
        <path d="M37.65,13.4 L37.65,33.12 L22.42,37.74 L18.84,38.82 L15.26,39.91 L15.26,32.22 C16.2,31.88 17.12,31.53 18.06,31.19 C19.5,30.67 20.95,30.14 22.39,29.55 C22.58,29.49 22.8,29.4 22.99,29.3 C23.8,28.96 24.65,28.65 25.5,28.28 C26.35,27.91 27.2,27.53 28.04,27.07 C28.48,26.82 28.92,26.57 29.4,26.26 C29.65,26.11 29.9,25.92 30.15,25.67 C30.27,25.55 30.43,25.43 30.59,25.24 C30.75,25.05 30.9,24.87 31.06,24.59 C31.22,24.31 31.37,23.94 31.4,23.47 C31.47,23.01 31.37,22.48 31.19,22.08 C31,21.67 30.78,21.4 30.56,21.18 C30.34,20.96 30.15,20.84 29.99,20.71 C29.65,20.5 29.33,20.34 29.05,20.22 C28.77,20.09 28.52,20 28.23,19.94 C27.98,19.88 27.73,19.78 27.48,19.75 L27.1,19.66 L26.79,19.6 C26.41,19.5 26.03,19.44 25.69,19.32 C25.5,19.26 25.34,19.19 25.19,19.13 C25.28,19.07 25.34,18.98 25.44,18.91 C26,18.48 26.69,18.05 27.42,17.64 C28.86,16.87 30.43,16.16 32,15.5 C33.89,14.76 35.77,14.08 37.65,13.4 Z"/>
      </svg>
      <span>{{ $t('titlebar.openYanhekt') }}</span>
      <svg class="menu-link-external" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M15 3h6v6"/>
        <path d="M10 14L21 3"/>
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      </svg>
    </button>

    <div class="menu-links-separator"></div>
  </div>
</template>

<script setup lang="ts">
import { createLogger } from '@shared/utils/logger';
const log = createLogger('UserMenuLinks');
import { useI18n } from 'vue-i18n'
import { tokenManager } from '@shared/services/authService'

const { t: $t } = useI18n()

const openGitHub = async () => {
  try {
    await window.electronAPI.shell.openExternal('https://github.com/bit-admin/Yanhekt-AutoSlides')
  } catch (error) {
    log.error('Failed to open GitHub repository:', error)
  }
}

const openITCenter = async () => {
  try {
    await window.electronAPI.shell.openExternal('https://it.ruc.edu.kg/zh/software')
  } catch (error) {
    log.error('Failed to open Official Website:', error)
  }
}

const openPublicIndex = async () => {
  try {
    await window.electronAPI.shell.openExternal('https://share.ruc.edu.kg')
  } catch (error) {
    log.error('Failed to open Public Index:', error)
  }
}

const openYanhekt = async () => {
  try {
    const token = tokenManager.getToken()
    // Signed in: open /login with token so the site picks up the session.
    // Signed out: homepage only — no /login?... path.
    const url = token
      ? `https://www.yanhekt.cn/login?token=${encodeURIComponent(token)}&type=Bearer&expired_at=${Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60}`
      : 'https://www.yanhekt.cn'
    await window.electronAPI.shell.openExternal(url)
  } catch (error) {
    log.error('Failed to open Yanhekt website:', error)
  }
}

const openAutoSlidesWeb = async () => {
  try {
    const token = tokenManager.getToken()
    // Web adopts ?token= on load (bookmarklet return shape). Signed out: bare origin.
    const url = token
      ? `https://learn.ruc.edu.kg?token=${encodeURIComponent(token)}`
      : 'https://learn.ruc.edu.kg'
    await window.electronAPI.shell.openExternal(url)
  } catch (error) {
    log.error('Failed to open AutoSlides Web:', error)
  }
}

const openFeedbackIssue = async () => {
  try {
    await window.electronAPI.shell.openExternal('https://github.com/bit-admin/Yanhekt-AutoSlides/issues/new')
  } catch (error) {
    log.error('Failed to open issue page:', error)
  }
}

const openFeedbackEmail = async () => {
  const now = new Date()
  const timestampLocal = now.toLocaleString()
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown'
  let appVersion = ''
  try {
    appVersion = await window.electronAPI.app?.getVersion() ?? ''
  } catch (error) {
    log.error('Failed to get app version:', error)
  }
  appVersion = appVersion || 'Unknown'
  const electronVersion = navigator.userAgent.match(/Electron\/([\d.]+)/)?.[1] || 'Unknown'
  const platform = navigator.platform || 'Unknown'

  const subject = encodeURIComponent(`[AutoSlides Feedback] ${timestampLocal.slice(0, 10)}`)
  const body = encodeURIComponent(
    `Hello AutoSlides Team,\n\n` +
    `- What happened:\n` +
    `- Steps to reproduce:\n` +
    `- Expected result:\n` +
    `- Actual result:\n` +
    `- Additional notes:\n\n` +
    `────────────────────────\n` +
    `Environment Snapshot\n` +
    `────────────────────────\n` +
    `Timestamp: ${timestampLocal}\n` +
    `Time zone: ${timezone}\n` +
    `App version: ${appVersion}\n` +
    `Electron: ${electronVersion}\n` +
    `Platform: ${platform}\n`
  )

  try {
    await window.electronAPI.shell.openExternal(`mailto:info@ruc.edu.kg?subject=${subject}&body=${body}`)
  } catch (error) {
    log.error('Failed to open email client:', error)
  }
}
</script>

<style scoped>
.menu-links {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Reuse the dropup menu-item idiom from LeftPanel's .signin-option */
.signin-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background-color: transparent;
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.signin-option:hover {
  background-color: var(--bg-hover);
}

.signin-option-icon {
  flex-shrink: 0;
  color: var(--text-muted);
}

.menu-links-separator {
  height: 1px;
  background-color: var(--border-input);
  margin: 4px 0;
}

.menu-link-flyout {
  position: relative;
}

.menu-link-chevron {
  margin-left: auto;
  color: var(--text-muted);
}

.menu-link-external {
  margin-left: auto;
  flex-shrink: 0;
  color: var(--text-muted);
  opacity: 0.45;
}

.menu-link-flyout-panel {
  position: absolute;
  left: 100%;
  /* Sit flush with the trigger row (6px panel padding). Feedback (first
     row) additionally aligns to the parent dropup chrome — see below. */
  top: -6px;
  margin-left: 12px;
  min-width: 190px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  border: 1px solid var(--border-input);
  border-radius: 8px;
  background-color: var(--bg-card);
  box-shadow: var(--shadow-md);
  z-index: 30;
  visibility: hidden;
  opacity: 0;
  transition: opacity 0.15s ease, visibility 0.15s ease;
}

/* Transparent bridge spanning the gap so hover stays continuous */
.menu-link-flyout-panel::before {
  content: '';
  position: absolute;
  top: 0;
  left: -12px;
  width: 12px;
  height: 100%;
}

.menu-link-flyout:hover .menu-link-flyout-panel {
  visibility: visible;
  opacity: 1;
}

/* First flyout (Feedback) lines up with the parent dropup's top border
   (8px padding + 1px border). */
.menu-link-flyout:first-child .menu-link-flyout-panel {
  top: -9px;
}
</style>
