<template>
  <div ref="containerRef" class="num">
    <!-- Signed out: Notion-like row -->
    <button
      v-if="!isLoggedIn"
      type="button"
      class="num-btn"
      @click="goToLogin"
    >
      <span class="num-avatar num-avatar--empty" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </span>
      <span class="num-label">{{ $t('auth.signIn') }}</span>
    </button>

    <!-- Signed in: button + dropup share one elevated shell when open -->
    <div v-else class="num-user" :class="{ open: showMenu }">
      <div v-if="showMenu" class="num-dropup" role="menu">
        <div class="num-header">
          <div class="num-header-name">{{ userNickname }}</div>
          <div v-if="userId" class="num-header-id">@{{ userId }}</div>
        </div>
        <div class="num-divider" />
        <button type="button" class="num-item num-item--danger" role="menuitem" @click="onSignOut">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span>{{ $t('auth.signOut') }}</span>
        </button>
        <div class="num-divider" />
      </div>

      <button
        type="button"
        class="num-btn"
        :class="{ active: showMenu }"
        :aria-expanded="showMenu"
        :title="workspaceLabel"
        @click="showMenu = !showMenu"
      >
        <span class="num-avatar">{{ userInitial }}</span>
        <span class="num-label">{{ workspaceLabel }}</span>
        <!-- Single up caret (^) -->
        <span class="num-caret" :class="{ open: showMenu }" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { authStore } from '../../stores/authStore'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { isLoggedIn, userNickname, userId, signOut } = authStore

const showMenu = ref(false)
const containerRef = ref<HTMLElement | null>(null)

const userInitial = computed(() => {
  const name = userNickname.value.trim()
  return name ? name.charAt(0).toUpperCase() : 'U'
})

// Notion-style possessive workspace title: "Catherine Wong's Notes"
const workspaceLabel = computed(() =>
  t('cloudNotes.workspaceUserLabel', {
    name: userNickname.value.trim() || 'User',
  }),
)

function goToLogin(): void {
  void router.push({ name: 'login', query: { redirect: route.fullPath } })
}

function onSignOut(): void {
  showMenu.value = false
  signOut()
}

function onDocClick(e: MouseEvent): void {
  if (showMenu.value && containerRef.value && !containerRef.value.contains(e.target as Node)) {
    showMenu.value = false
  }
}

onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))
</script>

<style scoped>
.num {
  position: relative;
  flex-shrink: 0;
  width: 100%;
  padding: 8px 8px 10px;
  box-sizing: border-box;
}

.num-user {
  position: relative;
  width: 100%;
  border-radius: 8px;
  /* Transparent shell when closed so the row sits flush on the sidebar */
  background: transparent;
  border: 1px solid transparent;
  box-shadow: none;
  transition: background 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease;
}

/* Open: one shared elevated card wrapping menu + trigger */
.num-user.open {
  background: var(--nt-elevated, #ffffff);
  border-color: var(--nt-border, rgba(0, 0, 0, 0.06));
  box-shadow: var(--nt-elevated-shadow, 0 4px 16px rgba(0, 0, 0, 0.1));
}

/* Single horizontal row: [avatar] Name's Notes  ^^ */
.num-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  padding: 6px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--nt-text, #37352f);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: -0.01em;
  cursor: pointer;
  text-align: left;
}

/* Closed hover only — when open, the shell already provides the surface */
.num-user:not(.open) .num-btn:hover {
  background: var(--nt-sidebar-hover, rgba(0, 0, 0, 0.04));
}

.num-user.open .num-btn {
  border-radius: 0 0 7px 7px;
}

/* Notion-style rounded square (not circle) */
.num-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  background: var(--nt-avatar-bg, #37352f);
  color: var(--nt-avatar-fg, #ffffff);
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  flex-shrink: 0;
  user-select: none;
}

.num-avatar--empty {
  background: var(--nt-sidebar-active, rgba(0, 0, 0, 0.08));
  color: var(--nt-text-muted, #787774);
}

.num-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.num-caret {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--nt-text-muted, #787774);
  opacity: 0.75;
}

.num-btn:hover .num-caret,
.num-btn.active .num-caret {
  opacity: 1;
  color: var(--nt-text, #37352f);
}

/* Menu is in-flow above the button so they share the open shell — no gap, no second card */
.num-dropup {
  padding: 6px 4px 0;
}

.num-header {
  padding: 6px 10px 8px;
}

.num-header-name {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--nt-text, #37352f);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.num-header-id {
  margin-top: 2px;
  font-size: 11.5px;
  font-weight: 400;
  color: var(--nt-text-muted, #787774);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.num-divider {
  height: 1px;
  margin: 2px 6px;
  background: var(--nt-border, rgba(0, 0, 0, 0.06));
}

.num-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--nt-text, #37352f);
  font-size: 13.5px;
  cursor: pointer;
  text-align: left;
}

.num-item:hover {
  background: var(--nt-sidebar-hover, rgba(0, 0, 0, 0.04));
}

.num-item--danger {
  color: var(--danger, #c4554d);
}

.num-item--danger:hover {
  background: color-mix(in srgb, var(--danger, #c4554d) 10%, transparent);
}
</style>
