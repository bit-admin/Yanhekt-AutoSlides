<template>
  <!-- 'left-panel' retained as a Driver.js tour hook -->
  <div class="left-panel flex h-full flex-col">
    <!-- 'login-section' retained as a Driver.js tour hook -->
    <div class="login-section border-b border-line bg-elevated p-4">
      <!-- Step 1: Show login form (not logged in state) -->
      <div v-if="!isDemoLoggedIn" class="flex min-h-[140px] flex-col justify-between">
        <h3 class="m-0 mb-2 text-base font-semibold text-fg">{{ $t('auth.signIn') }}</h3>
        <p class="m-0 mb-3 text-xs text-fg-secondary">{{ $t('auth.signInMessage') }}</p>
        <div class="mb-3 flex flex-col gap-2">
          <input
            type="text"
            :placeholder="$t('auth.username')"
            class="rounded border border-line-input bg-elevated px-3 py-2 text-sm text-fg-muted"
            readonly
            value=""
          />
          <input
            type="password"
            :placeholder="$t('auth.password')"
            class="rounded border border-line-input bg-elevated px-3 py-2 text-sm text-fg-muted"
            readonly
            value=""
          />
        </div>
        <div class="flex w-full flex-row gap-2">
          <button class="flex-1 cursor-not-allowed rounded border-none bg-[#ccc] px-3 py-2 text-[13px] text-white dark:bg-[#555]" disabled>
            {{ $t('auth.signIn') }}
          </button>
          <button class="flex-1 cursor-not-allowed whitespace-nowrap rounded border border-accent bg-transparent px-3 py-2 text-[13px] text-accent opacity-60" disabled>
            {{ $t('auth.signInWithBrowser') }}
          </button>
        </div>
      </div>

      <!-- Step 2: Show logged in state with user-banner -->
      <div v-else class="relative" ref="userInfoRef">
        <button type="button" class="flex w-full cursor-default items-center gap-2.5 rounded-t-lg border border-b-0 border-[#d5d9de] bg-white px-2 py-[5px] dark:border-[#404040] dark:bg-[#2d2d2d]" disabled>
          <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2563eb] text-[11px] font-bold text-white">K</span>
          <span class="min-w-0 flex-1 truncate text-left text-[13px] font-semibold text-[#1f2937] dark:text-[#e0e0e0]">Kate</span>
          <svg
            class="h-3.5 w-3.5 rotate-180 text-[#6b7280]"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <div class="rounded-b-lg border border-t-0 border-[#d5d9de] bg-white p-2 shadow-[0_6px_14px_rgba(15,23,42,0.08)] dark:border-[#404040] dark:bg-[#2d2d2d]">
          <p class="m-0 text-xs font-semibold text-[#1f2937] dark:text-[#e0e0e0]">{{ $t('auth.signInAs', { userId: '0000000000' }) }}</p>
          <p class="m-0 mb-2 mt-1 text-xs leading-[1.35] text-[#6b7280] dark:text-[#b0b0b0]">{{ $t('auth.accessMessage') }}</p>
          <button class="w-full cursor-not-allowed rounded border border-[#dc3545] bg-transparent px-2.5 py-1.5 text-center text-xs text-[#dc3545] opacity-60" disabled>{{ $t('auth.signOut') }}</button>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-4">
      <div class="mb-4 flex items-center justify-between">
        <h3 class="m-0 text-base font-semibold text-fg">{{ $t('settings.settings') }}</h3>
        <button class="flex cursor-not-allowed items-center gap-1 rounded border border-line-input bg-elevated px-3 py-1.5 text-xs text-fg-muted opacity-60" disabled>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          {{ $t('settings.advancedSettings') }}
        </button>
      </div>
      <div>
        <div class="mb-4">
          <div class="mb-1.5 flex items-center justify-between">
            <label class="block text-xs font-medium text-fg">{{ $t('settings.outputDirectory') }}</label>
            <button class="flex cursor-not-allowed items-center justify-center rounded-[3px] border-none bg-transparent p-0.5 text-fg-muted opacity-50" disabled :title="$t('settings.openFolder')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
            </button>
          </div>
          <div class="flex gap-2">
            <input
              type="text"
              readonly
              class="flex-1 truncate rounded border border-line-input bg-elevated px-2 py-1.5 text-xs text-fg-secondary"
              value="/Users/Kate/Documents/AutoSlides"
            />
            <button class="cursor-not-allowed rounded border-none bg-[#ccc] px-3 py-1.5 text-xs text-white dark:bg-[#555]" disabled>{{ $t('settings.browse') }}</button>
          </div>
        </div>

        <!-- 'connection-mode-setting' retained as a Driver.js tour hook -->
        <div class="connection-mode-setting relative mb-4">
          <label class="mb-1.5 block text-xs font-semibold text-fg">{{ $t('settings.connectionMode') }}</label>
          <div class="flex gap-1">
            <button class="flex-1 cursor-not-allowed rounded border border-accent bg-accent px-2 py-1.5 text-[11px] text-white dark:text-[#1a1a1a]" disabled>
              {{ $t('settings.internalNetwork') }}
            </button>
            <button class="flex-1 cursor-not-allowed rounded border border-line-input bg-elevated px-2 py-1.5 text-[11px] text-fg-secondary" disabled>
              {{ $t('settings.externalNetwork') }}
            </button>
          </div>
        </div>

        <div class="mb-4">
          <label class="mb-1.5 block text-xs font-medium text-fg">{{ $t('settings.audioMode') }}</label>
          <div class="w-full">
            <select class="w-full cursor-not-allowed rounded border border-line-input bg-elevated px-2 py-1.5 text-xs text-fg-secondary" disabled>
              <option value="normal">{{ $t('settings.normal') }}</option>
            </select>
          </div>
        </div>

        <div class="mb-4">
          <div class="mb-1.5 flex items-center justify-between">
            <label class="block text-xs font-medium text-fg">{{ $t('settings.slideDetectionInterval') }}</label>
            <button class="flex cursor-not-allowed items-center justify-center rounded-[3px] border-none bg-transparent p-0.5 text-fg-muted opacity-50" disabled>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                <path d="M21 3v5h-5"/>
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                <path d="M3 21v-5h5"/>
              </svg>
            </button>
          </div>
          <div class="mb-1.5 mt-0.5 text-[11px] leading-[1.3] text-fg-secondary">{{ $t('settings.slideDetectionDescription') }}</div>
          <div class="flex items-center">
            <div class="relative flex w-full items-center rounded border border-line-input bg-elevated">
              <input
                type="number"
                class="flex-1 border-none bg-transparent px-2 py-1.5 text-xs text-fg-secondary outline-none"
                value="2000"
                readonly
              />
              <span class="whitespace-nowrap border-l border-line bg-elevated px-2 py-1.5 text-[11px] text-fg-secondary">{{ $t('settings.milliseconds') }}</span>
            </div>
          </div>
        </div>

        <div class="mb-4">
          <div class="mb-1.5 flex items-center justify-between">
            <label class="block text-xs font-medium text-fg">{{ $t('settings.slideStabilityVerification') }}</label>
            <button class="flex cursor-not-allowed items-center justify-center rounded-[3px] border-none bg-transparent p-0.5 text-fg-muted opacity-50" disabled>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                <path d="M21 3v5h-5"/>
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                <path d="M3 21v-5h5"/>
              </svg>
            </button>
          </div>
          <div class="mb-1.5 mt-0.5 text-[11px] leading-[1.3] text-fg-secondary">{{ $t('settings.slideStabilityDescription') }}</div>
          <div class="flex h-[35px] items-stretch overflow-hidden rounded-md border border-line-input bg-elevated">
            <label class="flex flex-1 cursor-not-allowed select-none items-center gap-2 px-3 py-2 text-xs text-fg">
              <input
                type="checkbox"
                class="m-0 h-4 w-4 cursor-not-allowed accent-accent"
                checked
                disabled
              />
              {{ $t('settings.enableChecks') }}
            </label>
            <div class="flex items-center gap-1.5 border-l border-line-input bg-white/70 px-3 py-2 dark:bg-white/5">
              <select class="min-w-[50px] cursor-not-allowed rounded border border-line-input bg-elevated px-1.5 py-1 text-[11px] text-fg-secondary" disabled>
                <option value="2" selected>2</option>
              </select>
              <span class="whitespace-nowrap text-[11px] text-fg-secondary">{{ $t('settings.counts') }}</span>
            </div>
          </div>
        </div>

        <div class="mb-4">
          <label class="mb-1.5 block text-xs font-medium text-fg">{{ $t('settings.taskSpeed') }}</label>
          <div class="mb-1.5 mt-0.5 text-[11px] leading-[1.3] text-fg-secondary">{{ $t('settings.taskSpeedDescription') }}</div>
          <div class="w-full">
            <select class="w-full cursor-not-allowed rounded border border-line-input bg-elevated px-2 py-1.5 text-xs text-fg-secondary" disabled>
              <option value="10" selected>10x</option>
            </select>
          </div>
        </div>

        <div class="mb-0 mt-1.5">
          <label class="mb-1.5 block text-xs font-medium text-fg">{{ $t('settings.autoPostProcessing') }}</label>
          <div class="mb-1.5 mt-0.5 text-[11px] leading-[1.3] text-fg-secondary">{{ $t('settings.autoPostProcessingDescription') }}</div>
          <div class="flex flex-col overflow-hidden rounded-md border border-line-input bg-elevated">
            <label class="flex cursor-not-allowed select-none items-center gap-2 border-b border-line-input px-3 py-2 text-xs text-fg">
              <input type="checkbox" class="m-0 h-4 w-4 cursor-not-allowed accent-accent" disabled />
              {{ $t('settings.enableAutoPostProcessingLive') }}
            </label>
            <label class="flex cursor-not-allowed select-none items-center gap-2 px-3 py-2 text-xs text-fg">
              <input type="checkbox" class="m-0 h-4 w-4 cursor-not-allowed accent-accent" checked disabled />
              {{ $t('settings.enableAutoPostProcessingRecorded') }}
            </label>
          </div>
        </div>
      </div>
    </div>

    <div class="border-t border-line bg-elevated p-4">
      <div id="tour-tools-launchers">
        <div class="mb-2.5">
          <button class="flex w-full cursor-not-allowed items-center gap-1 rounded border border-line-input bg-white px-2 py-1.5 text-[11px] font-medium text-fg opacity-60 dark:bg-[#2d2d2d]" disabled>
            <svg width="14" height="14" viewBox="0 0 16 16" class="shrink-0 opacity-70">
              <path d="M1 3h4v4H1V3zm5 0h4v4H6V3zm5 0h4v4h-4V3zM1 9h4v4H1V9zm5 0h4v4H6V9zm5 0h4v4h-4V9z" fill="currentColor"/>
            </svg>
            <span>{{ $t('tools.openTools') }}</span>
            <svg width="10" height="10" viewBox="0 0 10 10" class="ml-auto opacity-45">
              <path d="M3 2l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
          </button>
        </div>

        <div class="mb-2.5">
          <button class="flex w-full cursor-not-allowed items-center gap-1 rounded border border-line-input bg-white px-2 py-1.5 text-[11px] font-medium text-fg opacity-60 dark:bg-[#2d2d2d]" disabled>
            <svg width="14" height="14" viewBox="0 0 16 16" class="shrink-0 opacity-70">
              <path d="M8 1L1 5v6l7 4 7-4V5L8 1zm0 2l4.5 2.5L8 8 3.5 5.5 8 3zM2.5 6.3L7.5 9v4.2l-5-2.8V6.3zm11 0v4.1l-5 2.8V9l5-2.7z" fill="currentColor"/>
            </svg>
            <span>{{ $t('addons.openAddons') }}</span>
            <svg width="10" height="10" viewBox="0 0 10 10" class="ml-auto opacity-45">
              <path d="M3 2l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="mb-2 flex items-center justify-between text-xs">
        <span class="font-medium text-fg">{{ $t('status.taskStatus') }}</span>
        <span class="text-fg-secondary">{{ $t('status.noTasks') }}</span>
      </div>
      <div class="flex items-center justify-between text-xs">
        <span class="font-medium text-fg">{{ $t('status.downloadQueue') }}</span>
        <span class="text-fg-secondary">{{ $t('status.noDownloads') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const isDemoLoggedIn = ref(false)

const loginDemo = () => {
  isDemoLoggedIn.value = true
}

const resetDemo = () => {
  isDemoLoggedIn.value = false
}

defineExpose({
  loginDemo,
  resetDemo,
  isDemoLoggedIn
})
</script>
