<template>
  <div class="onboarding-overlay">
    <div class="onboarding-card">
      <!-- Welcome intro -->
      <template v-if="step === 0">
        <div class="onboarding-hero">
          <h2 class="hero-title">{{ $t('onboarding.welcomeTitle') }}</h2>
          <p class="hero-subtitle">{{ $t('onboarding.welcomeSubtitle') }}</p>
          <button class="btn btn--primary btn--lg hero-cta" @click="next">
            {{ $t('onboarding.getStarted') }}
          </button>
          <button class="skip-link" @click="finish">{{ $t('onboarding.skip') }}</button>
        </div>
      </template>

      <!-- Configuration steps -->
      <template v-else>
        <div class="onboarding-progress">
          <span
            v-for="n in totalSteps"
            :key="n"
            class="progress-dot"
            :class="{ active: n === step, done: n < step }"
          />
        </div>

        <div class="onboarding-body">
          <span class="step-label">{{ $t('onboarding.stepLabel', { current: step, total: totalSteps }) }}</span>

          <!-- 1. Output directory -->
          <template v-if="step === 1">
            <h3 class="step-title">{{ $t('onboarding.outputTitle') }}</h3>
            <p class="step-description">{{ $t('onboarding.outputDescription') }}</p>
            <div class="input-group">
              <input
                :value="outputDirectory"
                type="text"
                readonly
                class="text-input directory-input"
                :title="outputDirectory"
              />
              <button @click="selectOutputDirectory" class="btn btn--primary">{{ $t('settings.browse') }}</button>
            </div>
          </template>

          <!-- 2. Connection mode -->
          <template v-else-if="step === 2">
            <h3 class="step-title">{{ $t('onboarding.connectionTitle') }}</h3>
            <p class="step-description">{{ $t('onboarding.connectionDescription') }}</p>
            <div class="mode-toggle">
              <button
                @click="setConnectionMode('internal')"
                :class="['mode-btn', { active: connectionMode === 'internal' }]"
              >
                {{ $t('settings.internalNetwork') }}
              </button>
              <button
                @click="setConnectionMode('external')"
                :class="['mode-btn', { active: connectionMode === 'external' }]"
              >
                {{ $t('settings.externalNetwork') }}
              </button>
            </div>
          </template>

          <!-- 3. Audio mode -->
          <template v-else-if="step === 3">
            <h3 class="step-title">{{ $t('onboarding.audioTitle') }}</h3>
            <p class="step-description">{{ $t('onboarding.audioDescription') }}</p>
            <select v-model="muteMode" @change="setMuteMode" class="select-field">
              <option value="normal">{{ $t('settings.normal') }}</option>
              <option value="mute_all">{{ $t('settings.muteAll') }}</option>
              <option value="mute_live">{{ $t('settings.muteLive') }}</option>
              <option value="mute_recorded">{{ $t('settings.muteRecorded') }}</option>
            </select>
          </template>

          <!-- 4. Task speed -->
          <template v-else-if="step === 4">
            <h3 class="step-title">{{ $t('onboarding.taskSpeedTitle') }}</h3>
            <p class="step-description">{{ $t('onboarding.taskSpeedDescription') }}</p>
            <select v-model="taskSpeed" @change="setTaskSpeed" class="select-field">
              <option v-for="n in 16" :key="n" :value="n">{{ n }}x</option>
            </select>
          </template>
        </div>

        <div class="onboarding-footer">
          <button class="btn" @click="back">{{ $t('onboarding.back') }}</button>
          <button v-if="step < totalSteps" class="btn btn--primary" @click="next">
            {{ $t('onboarding.next') }}
          </button>
          <button v-else class="btn btn--primary" @click="finish">
            {{ $t('onboarding.finish') }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useSettings } from '@features/settings/useSettings'

const emit = defineEmits<{
  (e: 'finish'): void
}>()

const totalSteps = 4
const step = ref(0)

const settings = useSettings()
const {
  outputDirectory,
  connectionMode,
  muteMode,
  taskSpeed,
  selectOutputDirectory,
  setConnectionMode,
  setMuteMode,
  setTaskSpeed,
} = settings

onMounted(() => {
  settings.loadConfig()
})

const next = () => {
  if (step.value < totalSteps) step.value += 1
}
const back = () => {
  if (step.value > 0) step.value -= 1
}
const finish = () => {
  emit('finish')
}
</script>

<style scoped>
.onboarding-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-super-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--overlay-dark);
  backdrop-filter: blur(2px);
}

.onboarding-card {
  width: 460px;
  max-width: calc(100vw - 48px);
  min-height: 320px;
  background-color: var(--bg-modal);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  box-shadow: 0 12px 48px var(--shadow-lg);
  padding: 28px 28px 22px;
  display: flex;
  flex-direction: column;
}

/* ── Welcome hero ─────────────────────────────────────── */
.onboarding-hero {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 8px;
}

.hero-title {
  margin: 0 0 12px;
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
}

.hero-subtitle {
  margin: 0 0 24px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-secondary);
  max-width: 360px;
}

.hero-cta {
  min-width: 200px;
}

.skip-link {
  margin-top: 14px;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: color 0.2s;
}

.skip-link:hover {
  color: var(--text-secondary);
  text-decoration: underline;
}

/* ── Stepped configuration ────────────────────────────── */
.onboarding-progress {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 22px;
}

.progress-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--border-strong);
  transition: all 0.25s ease;
}

.progress-dot.active {
  width: 22px;
  border-radius: 4px;
  background-color: var(--accent);
}

.progress-dot.done {
  background-color: var(--accent);
}

.onboarding-body {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.step-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 10px;
}

.step-title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.step-description {
  margin: 0 0 20px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-secondary);
}

.directory-input {
  flex: 1;
  min-width: 0;
}

.mode-toggle {
  display: flex;
  gap: 8px;
}

.onboarding-footer {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: 24px;
  padding-top: 18px;
  border-top: 1px solid var(--border-color);
}
</style>
