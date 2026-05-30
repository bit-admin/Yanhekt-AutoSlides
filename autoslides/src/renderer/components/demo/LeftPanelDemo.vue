<template>
  <div class="flex flex-col h-full p-0">
    <div class="p-4 border-b border-border bg-elevated">
      <!-- Step 1: Show login form (not logged in state) -->
      <div v-if="!isDemoLoggedIn" class="min-h-[140px] flex flex-col justify-between">
        <h3 class="m-0 mb-2 text-base font-semibold">{{ $t('auth.signIn') }}</h3>
        <p class="m-0 mb-3 text-xs text-text-secondary">{{ $t('auth.signInMessage') }}</p>
        <div class="flex flex-col gap-2 mb-3">
          <input
            type="text"
            :placeholder="$t('auth.username')"
            class="py-2 px-3 border border-border-input rounded text-sm bg-elevated text-text-muted"
            readonly
            value=""
          />
          <input
            type="password"
            :placeholder="$t('auth.password')"
            class="py-2 px-3 border border-border-input rounded text-sm bg-elevated text-text-muted"
            readonly
            value=""
          />
        </div>
        <div class="flex flex-row gap-2 w-full">
          <button class="flex-1 py-2 px-3 border-none rounded text-[13px] cursor-not-allowed bg-[var(--border-strong)] text-white" disabled>
            {{ $t('auth.signIn') }}
          </button>
          <button class="flex-1 py-2 px-3 border border-accent rounded text-[13px] cursor-not-allowed bg-transparent text-accent whitespace-nowrap opacity-60" disabled>
            {{ $t('auth.signInWithBrowser') }}
          </button>
        </div>
      </div>

      <!-- Step 2: Show logged in state with user-banner -->
      <div v-else class="relative" ref="userInfoRef">
        <button type="button" class="w-full flex items-center gap-[10px] border border-border-border border-b-none rounded-t-lg py-[5px] px-2 bg-surface cursor-default" disabled>
          <span class="w-6 h-6 rounded-full bg-text-accent text-white flex items-center justify-center text-[11px] font-bold shrink-0">K</span>
          <span class="flex-1 min-w-0 text-left text-[13px] font-semibold text-[#1f2937] overflow-hidden text-ellipsis whitespace-nowrap">Kate</span>
          <svg
            class="w-[14px] h-[14px] text-[#6b7280] rotate-180"
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
        <div class="border border-border-border border-t-none rounded-b-lg bg-surface shadow-[0_6px_14px_rgba(15,23,42,0.08)] p-2">
          <p class="m-0 text-xs font-semibold text-[#1f2937]">{{ $t('auth.signInAs', { userId: '0000000000' }) }}</p>
          <p class="mt-1 mb-2 mx-0 text-xs text-[#6b7280] leading-[1.35]">{{ $t('auth.accessMessage') }}</p>
          <button class="rounded text-xs cursor-not-allowed w-auto bg-transparent text-danger border border-danger py-[6px] px-[10px] opacity-60 w-full text-center" disabled>{{ $t('auth.signOut') }}</button>
        </div>
      </div>
    </div>

    <div class="flex-1 p-4 overflow-y-auto">
      <div class="flex justify-between items-center mb-4">
        <h3 class="m-0 text-base font-semibold">{{ $t('settings.settings') }}</h3>
        <button class="flex items-center gap-1 py-[6px] px-3 bg-elevated border border-border-input rounded text-xs cursor-not-allowed text-text-muted opacity-60" disabled>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          {{ $t('settings.advancedSettings') }}
        </button>
      </div>
      <div>
        <div class="mb-4">
          <div class="flex items-center justify-between mb-[6px]">
            <label class="block text-xs font-medium text-text mb-[6px]">{{ $t('settings.outputDirectory') }}</label>
            <button class="bg-none border-none cursor-not-allowed p-[2px] rounded-[3px] text-text-muted flex items-center justify-center opacity-50" disabled :title="$t('settings.openFolder')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
            </button>
          </div>
          <div class="flex gap-2">
            <input
              type="text"
              readonly
              class="flex-1 py-[6px] px-2 border border-border-input rounded text-xs bg-elevated text-text-secondary overflow-hidden text-ellipsis whitespace-nowrap"
              value="/Users/Kate/Documents/AutoSlides"
            />
            <button class="py-[6px] px-3 bg-[var(--border-strong)] text-white border-none rounded text-xs cursor-not-allowed" disabled>{{ $t('settings.browse') }}</button>
          </div>
        </div>

        <div class="mb-4 relative">
          <label class="block text-xs font-semibold text-text mb-[6px]">{{ $t('settings.connectionMode') }}</label>
          <div class="flex gap-1">
            <button class="flex-1 py-[6px] px-2 border border-border-input bg-elevated text-text-secondary text-[11px] rounded cursor-not-allowed bg-accent text-white border-accent" disabled>
              {{ $t('settings.internalNetwork') }}
            </button>
            <button class="flex-1 py-[6px] px-2 border border-border-input bg-elevated text-text-secondary text-[11px] rounded cursor-not-allowed" disabled>
              {{ $t('settings.externalNetwork') }}
            </button>
          </div>
        </div>

        <div class="mb-4">
          <label class="block text-xs font-medium text-text mb-[6px]">{{ $t('settings.audioMode') }}</label>
          <div class="w-full">
            <select class="w-full py-[6px] px-2 border border-border-input rounded bg-elevated text-xs cursor-not-allowed text-text-secondary" disabled>
              <option value="normal">{{ $t('settings.normal') }}</option>
            </select>
          </div>
        </div>

        <div class="mb-4">
          <div class="flex items-center justify-between mb-[6px]">
            <label class="block text-xs font-medium text-text mb-[6px]">{{ $t('settings.slideDetectionInterval') }}</label>
            <button class="bg-none border-none cursor-not-allowed p-[2px] rounded-[3px] text-text-muted flex items-center justify-center opacity-50" disabled>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                <path d="M21 3v5h-5"/>
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                <path d="M3 21v-5h5"/>
              </svg>
            </button>
          </div>
          <div class="text-[11px] text-text-secondary mb-[6px] leading-[1.3] mt-[2px]">{{ $t('settings.slideDetectionDescription') }}</div>
          <div class="flex items-center">
            <div class="relative flex items-center w-full bg-elevated border border-border-input rounded">
              <input
                type="number"
                class="flex-1 py-[6px] px-2 border-none bg-transparent text-xs outline-none text-text-secondary"
                value="2000"
                readonly
              />
              <span class="py-[6px] px-2 text-[11px] text-text-secondary bg-elevated border-l border-border whitespace-nowrap">{{ $t('settings.milliseconds') }}</span>
            </div>
          </div>
        </div>

        <div class="mb-4">
          <div class="flex items-center justify-between mb-[6px]">
            <label class="block text-xs font-medium text-text mb-[6px]">{{ $t('settings.slideStabilityVerification') }}</label>
            <button class="bg-none border-none cursor-not-allowed p-[2px] rounded-[3px] text-text-muted flex items-center justify-center opacity-50" disabled>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                <path d="M21 3v5h-5"/>
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                <path d="M3 21v-5h5"/>
              </svg>
            </button>
          </div>
          <div class="text-[11px] text-text-secondary mb-[6px] leading-[1.3] mt-[2px]">{{ $t('settings.slideStabilityDescription') }}</div>
          <div class="flex items-stretch bg-elevated border border-border-input rounded-[6px] overflow-hidden h-[35px]">
            <label class="flex items-center gap-2 text-xs text-text cursor-not-allowed py-2 px-3 bg-transparent border-none rounded-none select-none flex-1">
              <input
                type="checkbox"
                checked
                disabled
                class="m-0 cursor-not-allowed w-4 h-4 accent-accent"
              />
              {{ $t('settings.enableChecks') }}
            </label>
            <div class="flex items-center gap-[6px] py-2 px-3 bg-white/70 border-l border-border-input">
              <select class="py-1 px-[6px] border border-border-input rounded bg-elevated text-[11px] cursor-not-allowed min-w-[50px] text-text-secondary" disabled>
                <option value="2" selected>2</option>
              </select>
              <span class="text-[11px] text-text-secondary whitespace-nowrap">{{ $t('settings.counts') }}</span>
            </div>
          </div>
        </div>

        <div class="mb-4">
          <label class="block text-xs font-medium text-text mb-[6px]">{{ $t('settings.taskSpeed') }}</label>
          <div class="text-[11px] text-text-secondary mb-[6px] leading-[1.3] mt-[2px]">{{ $t('settings.taskSpeedDescription') }}</div>
          <div class="w-full">
            <select class="w-full py-[6px] px-2 border border-border-input rounded bg-elevated text-xs cursor-not-allowed text-text-secondary" disabled>
              <option value="10" selected>10x</option>
            </select>
          </div>
        </div>

        <div class="mb-4 last:mb-0 last:mt-[6px]">
          <label class="block text-xs font-medium text-text mb-[6px]">{{ $t('settings.autoPostProcessing') }}</label>
          <div class="text-[11px] text-text-secondary mb-[6px] leading-[1.3] mt-[2px]">{{ $t('settings.autoPostProcessingDescription') }}</div>
          <div class="flex flex-col bg-elevated border border-border-input rounded-[6px] overflow-hidden">
            <label class="flex items-center gap-2 text-xs cursor-not-allowed py-2 px-3 text-text [&:not(:last-child)]:border-b [&:not(:last-child)]:border-border-input">
              <input type="checkbox" disabled class="m-0 cursor-not-allowed w-4 h-4 accent-accent" />
              {{ $t('settings.enableAutoPostProcessingLive') }}
            </label>
            <label class="flex items-center gap-2 text-xs cursor-not-allowed py-2 px-3 text-text">
              <input type="checkbox" checked disabled class="m-0 cursor-not-allowed w-4 h-4 accent-accent" />
              {{ $t('settings.enableAutoPostProcessingRecorded') }}
            </label>
          </div>
        </div>
      </div>
    </div>

    <div class="p-4 border-t border-border bg-elevated">
      <div id="tour-tools-launchers">
        <div class="mb-[10px]">
          <button class="flex items-center gap-1 w-full py-[6px] px-2 border border-border-input rounded bg-surface text-text text-[11px] font-medium cursor-not-allowed opacity-60" disabled>
            <svg width="14" height="14" viewBox="0 0 16 16" class="shrink-0 opacity-70">
              <path d="M1 3h4v4H1V3zm5 0h4v4H6V3zm5 0h4v4h-4V3zM1 9h4v4H1V9zm5 0h4v4H6V9zm5 0h4v4h-4V9z" fill="currentColor"/>
            </svg>
            <span>{{ $t('tools.openTools') }}</span>
            <svg width="10" height="10" viewBox="0 0 10 10" class="ml-auto opacity-45">
              <path d="M3 2l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
          </button>
        </div>

        <div class="mb-[10px]">
          <button class="flex items-center gap-1 w-full py-[6px] px-2 border border-border-input rounded bg-surface text-text text-[11px] font-medium cursor-not-allowed opacity-60" disabled>
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

      <div class="flex justify-between items-center mb-2 text-xs last:mb-0">
        <span class="font-medium text-text">{{ $t('status.taskStatus') }}</span>
        <span class="text-text-secondary">{{ $t('status.noTasks') }}</span>
      </div>
      <div class="flex justify-between items-center mb-2 text-xs last:mb-0">
        <span class="font-medium text-text">{{ $t('status.downloadQueue') }}</span>
        <span class="text-text-secondary">{{ $t('status.noDownloads') }}</span>
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
