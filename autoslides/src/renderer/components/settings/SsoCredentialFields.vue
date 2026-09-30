<template>
  <div class="credential-fields">
    <input
      :value="username"
      type="text"
      autocomplete="off"
      :placeholder="$t('auth.username')"
      class="input-field"
      @input="onUsernameInput"
      @focus="onFocus"
      @blur="onBlur"
      @keydown="onKeydown"
    />
    <div class="password-line">
      <input
        ref="passwordRef"
        :value="password"
        type="password"
        autocomplete="off"
        :placeholder="$t('auth.password')"
        :class="['input-field', { 'has-key': menu.hasLogins.value }]"
        @input="onPasswordInput"
        @focus="onFocus"
        @blur="onBlur"
        @keydown="onKeydown"
      />
      <button
        v-if="menu.hasLogins.value"
        type="button"
        class="key-btn"
        :title="$t('auth.passwords')"
        :aria-label="$t('auth.passwords')"
        :aria-expanded="menu.visible.value"
        @mousedown.prevent="onKeyMouseDown"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="8" cy="15" r="4"/>
          <path d="M11.5 12.5 20 4"/>
          <path d="M17 4l3 3"/>
          <path d="M15 8l2 2"/>
        </svg>
      </button>
    </div>

    <SavedLoginMenu
      v-if="menu.visible.value"
      class="autofill-flyout"
      :rows="menu.matches.value"
      :highlight="menu.highlight.value"
      @hover="menu.highlight.value = $event"
      @pick="pick"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, toRef } from 'vue'
import { useSavedLoginMenu, type SavedLoginRow } from '@features/platform/useSavedLoginMenu'
import SavedLoginMenu from './SavedLoginMenu.vue'

const props = defineProps<{
  username: string
  password: string
}>()

const emit = defineEmits<{
  (e: 'update:username', value: string): void
  (e: 'update:password', value: string): void
  (e: 'submit'): void
}>()

const menu = useSavedLoginMenu(toRef(props, 'username'))
const passwordRef = ref<HTMLInputElement | null>(null)
let closeTimer = 0

onMounted(() => {
  void menu.refresh()
})

function onUsernameInput(event: Event): void {
  emit('update:username', (event.target as HTMLInputElement).value)
}

function onPasswordInput(event: Event): void {
  // Typing a password means the user is not picking a saved one.
  menu.close()
  emit('update:password', (event.target as HTMLInputElement).value)
}

function onFocus(): void {
  window.clearTimeout(closeTimer)
  void menu.show()
}

function onBlur(): void {
  closeTimer = window.setTimeout(() => menu.close(), 150)
}

// Focus the field first so the menu has something to close it on blur.
function onKeyMouseDown(): void {
  window.clearTimeout(closeTimer)
  const wasOpen = menu.visible.value
  if (document.activeElement !== passwordRef.value) passwordRef.value?.focus()
  if (wasOpen) menu.close()
  else void menu.show()
}

function onKeydown(event: KeyboardEvent): void {
  if (!menu.visible.value) {
    if (event.key === 'Enter') emit('submit')
    return
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    menu.close()
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    menu.move(1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    menu.move(-1)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const row = menu.current.value
    if (row) {
      void pick(row)
    } else {
      menu.close()
      emit('submit')
    }
  }
}

async function pick(row: SavedLoginRow): Promise<void> {
  menu.close()
  // Filling the username still helps when the password cannot be decrypted.
  const saved = await menu.reveal(row)
  emit('update:username', saved?.username ?? row.username)
  if (saved?.password) emit('update:password', saved.password)
}
</script>

<style scoped>
.credential-fields {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  margin-bottom: 12px;
}

.password-line {
  position: relative;
}

.input-field {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-input);
  border-radius: 4px;
  font-size: 14px;
  background-color: var(--bg-input);
  color: var(--text-primary);
}

.input-field.has-key {
  padding-right: 34px;
}

.input-field::placeholder {
  color: var(--text-muted);
}

.input-field:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--focus-ring);
}

.key-btn {
  position: absolute;
  top: 50%;
  right: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  margin-top: -13px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
}

.key-btn:hover,
.key-btn[aria-expanded='true'] {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.autofill-flyout {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: var(--z-dropdown);
}
</style>
