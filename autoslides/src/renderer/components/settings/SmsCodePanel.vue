<template>
  <div class="sms-panel" :class="{ 'sms-panel--embed': embedded }">
    <!-- The "code sent to …" prompt lives in the card's description slot rather
         than here, so this panel stays no taller than the credential form it
         replaces and the card keeps its usual height.

         One input per digit: `inputmode: numeric` keeps it a number pad on
         touch, and a pasted code is spread across the boxes. -->
    <div class="sms-digits" @paste="onPaste">
      <input
        v-for="(_, index) in CODE_LENGTH"
        :key="index"
        :ref="(el) => registerDigit(el, index)"
        :value="digits[index]"
        type="text"
        inputmode="numeric"
        autocomplete="one-time-code"
        maxlength="1"
        class="sms-digit"
        :class="{ 'sms-digit--error': Boolean(error) }"
        :disabled="isSubmitting"
        :aria-label="$t('auth.smsDigitLabel', { index: index + 1 })"
        @input="onInput(index, $event)"
        @keydown="onKeydown(index, $event)"
      />
    </div>

    <p v-if="error" class="sms-error">{{ errorMessage }}</p>
    <p class="sms-note">{{ $t('auth.smsPrivacyNote') }}</p>

    <button
      type="button"
      class="btn btn--primary sms-submit"
      :disabled="isSubmitting || code.length < CODE_LENGTH"
      @click="$emit('submit')"
    >
      {{ isSubmitting ? $t('auth.smsVerifying') : $t('auth.smsVerify') }}
    </button>
    <button type="button" class="sms-cancel" :disabled="isSubmitting" @click="$emit('cancel')">
      {{ $t('advanced.cancel') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * CAS accepts 4–8 digits but only ever issues six, so six boxes is the honest
 * affordance. `useAuth.submitSmsCode` re-validates the wider range.
 */
const CODE_LENGTH = 6

const props = defineProps<{
  /** Two-way bound digit string, owned by useAuth. */
  code: string
  /** A `SignInFailureReason`, or 'invalidFormat' from client-side validation. */
  error: string
  isSubmitting: boolean
  /** Onboarding embed: keep original box size, center in the wizard card. */
  embedded?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:code', value: string): void
  (e: 'submit'): void
  (e: 'cancel'): void
}>()

const { t } = useI18n()

const inputs = ref<HTMLInputElement[]>([])
const digits = computed(() => {
  const characters = props.code.split('')
  return Array.from({ length: CODE_LENGTH }, (_, index) => characters[index] ?? '')
})

/**
 * Reasons worth naming for a user staring at an OTP box. Anything else (a
 * transport failure, an unparseable page) falls back to a generic line rather
 * than leaking main-process phrasing into the panel.
 */
const NAMED_REASONS = new Set([
  'invalidFormat',
  'code_rejected',
  'sms_send_failed',
  'risk_rejected',
  'network',
])

const errorMessage = computed(() => {
  if (!props.error) return ''
  const key = NAMED_REASONS.has(props.error) ? props.error : 'unknown'
  return t(`auth.smsError.${key}`)
})

const registerDigit = (el: unknown, index: number) => {
  if (el instanceof HTMLInputElement) inputs.value[index] = el
}

const focusDigit = (index: number) => {
  const clamped = Math.min(Math.max(index, 0), CODE_LENGTH - 1)
  void nextTick(() => inputs.value[clamped]?.focus())
}

const writeCode = (next: string) => {
  emit('update:code', next.replace(/\D/g, '').slice(0, CODE_LENGTH))
}

const onInput = (index: number, event: Event) => {
  const input = event.target as HTMLInputElement
  const typed = input.value.replace(/\D/g, '')
  // Rendering is driven by `props.code`, so reset the DOM value and let the
  // parent's update flow put the digit back — otherwise a rejected character
  // would linger in the box.
  input.value = digits.value[index] ?? ''

  if (!typed) return

  const characters = [...digits.value]
  // Autofill can drop the whole code into one box; spread it from here.
  for (let offset = 0; offset < typed.length && index + offset < CODE_LENGTH; offset++) {
    characters[index + offset] = typed[offset]
  }
  writeCode(characters.join(''))
  focusDigit(index + typed.length)
}

const onKeydown = (index: number, event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    if (props.code.length >= CODE_LENGTH) emit('submit')
    return
  }
  if (event.key === 'Backspace') {
    event.preventDefault()
    const characters = [...digits.value]
    // Deleting an empty box steps back and clears the previous one.
    const target = characters[index] ? index : index - 1
    if (target < 0) return
    characters[target] = ''
    writeCode(characters.join('').trimEnd())
    focusDigit(target)
    return
  }
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    focusDigit(index - 1)
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    focusDigit(index + 1)
  }
}

const onPaste = (event: ClipboardEvent) => {
  const pasted = event.clipboardData?.getData('text') ?? ''
  const numeric = pasted.replace(/\D/g, '')
  if (!numeric) return
  event.preventDefault()
  writeCode(numeric)
  focusDigit(numeric.length)
}

onMounted(() => focusDigit(0))

// A rejected code clears the boxes upstream; put the cursor back at the start.
watch(
  () => props.code,
  (value) => {
    if (value === '') focusDigit(0)
  }
)
</script>

<style scoped>
.sms-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 300px;
}

.sms-digits {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.sms-digit {
  width: 38px;
  height: 46px;
  padding: 0;
  border: 1px solid var(--border-input);
  border-radius: 6px;
  background-color: var(--bg-input);
  color: var(--text-primary);
  font-size: 20px;
  font-weight: 600;
  text-align: center;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.sms-digit:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--focus-ring);
}

.sms-digit:disabled {
  opacity: 0.6;
}

.sms-digit--error {
  border-color: var(--danger);
}

.sms-error {
  margin: 0 0 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--danger);
  text-align: center;
}

.sms-note {
  margin: 0 0 16px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-muted);
  text-align: center;
}

.sms-submit {
  width: 100%;
}

.sms-cancel {
  margin-top: 14px;
  border: none;
  background: none;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: color 0.2s;
}

.sms-cancel:hover:not(:disabled) {
  color: var(--text-secondary);
  text-decoration: underline;
}

.sms-cancel:disabled {
  cursor: default;
  opacity: 0.6;
}

/* Onboarding: compact centered digits; note + Verify match the credential form. */
.sms-panel--embed {
  align-items: stretch;
  max-width: none;
}

.sms-panel--embed .sms-digits {
  justify-content: center;
}

.sms-panel--embed .sms-note,
.sms-panel--embed .sms-error {
  text-align: left;
}

.sms-panel--embed .sms-cancel {
  align-self: center;
}
</style>
