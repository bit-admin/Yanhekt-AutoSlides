<template>
  <div class="menu-links">
    <!-- Feedback flyout (hover to open) -->
    <div class="menu-link-feedback">
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
      <div class="feedback-flyout">
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

    <!-- GitHub repository -->
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

    <!-- User Manual / IT Center -->
    <button type="button" class="signin-option" @click="openITCenter">
      <svg class="signin-option-icon" width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M1 2.828c.885-.37 2.154-.769 3.388-.893 1.33-.134 2.458.063 3.112.752v9.746c-.935-.53-2.12-.603-3.213-.493-1.18.12-2.37.461-3.287.811V2.828zm7.5-.141c.654-.689 1.782-.886 3.112-.752 1.234.124 2.503.523 3.388.893v9.923c-.918-.35-2.107-.692-3.287-.81-1.094-.111-2.278-.039-3.213.492V2.687zM8 1.783C7.015.936 5.587.81 4.287.94c-1.514.153-3.042.672-3.994 1.105A.5.5 0 0 0 0 2.5v11a.5.5 0 0 0 .707.455c.882-.4 2.303-.881 3.68-1.02 1.409-.142 2.59.087 3.223.877a.5.5 0 0 0 .78 0c.633-.79 1.814-1.019 3.222-.877 1.378.139 2.8.62 3.681 1.02A.5.5 0 0 0 16 13.5v-11a.5.5 0 0 0-.293-.455c-.952-.433-2.48-.952-3.994-1.105C10.413.809 8.985.936 8 1.783z"/>
      </svg>
      <span>{{ $t('titlebar.itCenterSoftware') }}</span>
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

const { t: $t } = useI18n()

const openGitHub = async () => {
  try {
    await (window as any).electronAPI.shell.openExternal('https://github.com/bit-admin/Yanhekt-AutoSlides')
  } catch (error) {
    log.error('Failed to open GitHub repository:', error)
  }
}

const openITCenter = async () => {
  try {
    await (window as any).electronAPI.shell.openExternal('https://it.ruc.edu.kg/zh/software')
  } catch (error) {
    log.error('Failed to open User Manual:', error)
  }
}

const openFeedbackIssue = async () => {
  try {
    await (window as any).electronAPI.shell.openExternal('https://github.com/bit-admin/Yanhekt-AutoSlides/issues/new')
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
    appVersion = await (window as any).electronAPI.app.getVersion()
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
    await (window as any).electronAPI.shell.openExternal(`mailto:info@ruc.edu.kg?subject=${subject}&body=${body}`)
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

.menu-link-feedback {
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

.feedback-flyout {
  position: absolute;
  left: 100%;
  /* Align top border with the parent dropup's top border (8px padding + 1px border) */
  top: -9px;
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
.feedback-flyout::before {
  content: '';
  position: absolute;
  top: 0;
  left: -12px;
  width: 12px;
  height: 100%;
}

.menu-link-feedback:hover .feedback-flyout {
  visibility: visible;
  opacity: 1;
}
</style>
