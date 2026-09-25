<template>
  <div class="notion-picker">
    <div class="np-head">
      <input
        ref="inputEl"
        v-model="query"
        type="search"
        class="text-input np-search"
        :placeholder="$t('cloudNotes.watchNotes.external.notionSearchPlaceholder')"
      />
      <button type="button" class="btn btn--ghost btn--sm" @click="emit('cancel')">
        {{ $t('cloudNotes.cancel') }}
      </button>
    </div>

    <div class="np-list custom-scrollbar">
      <ul v-if="rows.length > 0" class="np-rows">
        <li v-for="row in rows" :key="row.page.id" class="np-item">
          <button
            type="button"
            class="np-row"
            :style="{ paddingLeft: `${12 + Math.min(row.depth, MAX_INDENT_DEPTH) * INDENT_PX}px` }"
            @click="emit('pick', row.page.id)"
          >
            <span v-if="row.page.emoji" class="np-emoji" aria-hidden="true">{{ row.page.emoji }}</span>
            <svg v-else class="np-doc" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span class="np-text">
              <span class="np-title">{{ row.page.title || $t('cloudNotes.watchNotes.external.notionUntitled') }}</span>
              <span v-if="row.path" class="np-path">{{ row.path }}</span>
            </span>
          </button>
        </li>
      </ul>

      <p v-if="loading" class="np-note">{{ $t('cloudNotes.watchNotes.external.notionLoading') }}</p>
      <p v-else-if="error" class="np-note np-error">{{ errorText }}</p>
      <div v-else-if="rows.length === 0" class="np-note">
        <p>{{ searching ? $t('cloudNotes.watchNotes.external.notionNoMatch') : $t('cloudNotes.watchNotes.external.notionNoPages') }}</p>
        <button type="button" class="np-link" @click="openConnections">
          {{ $t('cloudNotes.watchNotes.external.notionOpenConnections') }}
        </button>
      </div>

      <div v-if="nextCursor && !loading" class="np-more">
        <button type="button" class="btn btn--sm" @click="loadMore">
          {{ $t('cloudNotes.watchNotes.external.notionLoadMore') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Notion page picker for the Notes tab: pages the connection was granted under
// Content access (and their sub-pages).
// - Browsing (empty search): every page the connection can see, fetched
//   cursor by cursor (up to BROWSE_LIMIT), indented under its parent. Rows are
//   only ever "pick this page" — no collapse control, so a parent row never
//   looks like a toggle.
// - Searching: Notion's own search, flat, each match labelled with its parent
//   path. A generation counter drops responses a newer query overtook.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { NotionErrorCode, NotionPageSummary } from '@common/notionNotesTypes'
import { NOTION_CONNECTIONS_URL } from '@common/notionLinks'
import { buildPageRows, pageAncestors } from '@features/cloudNotes/notionPageTree'

/** Stop walking cursors after this many pages; Load More continues. */
const BROWSE_LIMIT = 500
/** Indent per level, and the depth beyond which rows stop moving right. */
const INDENT_PX = 12
const MAX_INDENT_DEPTH = 6

const emit = defineEmits<{ pick: [pageId: string]; cancel: [] }>()

const { t } = useI18n()
const bridge = window.electronAPI.notionNotes

const query = ref('')
const searching = computed(() => query.value.trim() !== '')
/** Browse results (the tree), kept while searching to name parent paths. */
const allPages = ref<NotionPageSummary[]>([])
const searchPages = ref<NotionPageSummary[]>([])
const nextCursor = ref<string | null>(null)
const loading = ref(false)
const error = ref<NotionErrorCode | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)

let generation = 0
let debounce: ReturnType<typeof setTimeout> | null = null

const byId = computed(() => {
  const map = new Map<string, NotionPageSummary>()
  for (const page of [...allPages.value, ...searchPages.value]) map.set(page.id, page)
  return map
})

const rows = computed(() => {
  if (!searching.value) {
    return buildPageRows(allPages.value).map((row) => ({ ...row, path: '' }))
  }
  return searchPages.value.map((page) => ({
    page,
    depth: 0,
    path: pageAncestors(page, byId.value).map((title) => title || t('cloudNotes.watchNotes.external.notionUntitled')).join(' › '),
  }))
})

async function fetchInto(target: typeof allPages, cursor: string | null, gen: number, limit: number): Promise<void> {
  let next = cursor
  let fetched = 0
  do {
    const res = await bridge.searchPages(query.value, next)
    if (gen !== generation) return
    if (!res.ok) {
      error.value = res.error
      nextCursor.value = null
      return
    }
    target.value = [...target.value, ...res.data.pages]
    fetched += res.data.pages.length
    next = res.data.nextCursor
  } while (next && fetched < limit)
  nextCursor.value = next
}

async function run(task: (gen: number) => Promise<void>): Promise<void> {
  const gen = ++generation
  loading.value = true
  error.value = null
  try {
    await task(gen)
  } catch {
    if (gen === generation) error.value = 'network'
  } finally {
    if (gen === generation) loading.value = false
  }
}

function reload(): Promise<void> {
  nextCursor.value = null
  if (searching.value) {
    searchPages.value = []
    // One page of matches at a time; Load More for the rest.
    return run((gen) => fetchInto(searchPages, null, gen, 1))
  }
  allPages.value = []
  return run((gen) => fetchInto(allPages, null, gen, BROWSE_LIMIT))
}

function loadMore(): Promise<void> {
  const cursor = nextCursor.value
  return searching.value
    ? run((gen) => fetchInto(searchPages, cursor, gen, 1))
    : run((gen) => fetchInto(allPages, cursor, gen, BROWSE_LIMIT))
}

watch(query, () => {
  if (debounce) clearTimeout(debounce)
  // Back to browsing: the tree is still loaded, no need to refetch it.
  if (!searching.value && allPages.value.length > 0) {
    generation++
    loading.value = false
    error.value = null
    searchPages.value = []
    nextCursor.value = null
    return
  }
  debounce = setTimeout(() => void reload(), 300)
})

onMounted(() => {
  inputEl.value?.focus()
  void reload()
})

onBeforeUnmount(() => {
  if (debounce) clearTimeout(debounce)
  generation++
})

const errorText = computed(() => {
  switch (error.value) {
    case 'no_token':
    case 'unauthorized': return t('cloudNotes.watchNotes.external.notionErrors.unauthorized')
    case 'rate_limited': return t('cloudNotes.watchNotes.external.notionErrors.rateLimited')
    case 'network': return t('cloudNotes.watchNotes.external.notionErrors.network')
    default: return t('cloudNotes.watchNotes.external.notionErrors.search')
  }
})

function openConnections(): void {
  void window.electronAPI.shell.openExternal(NOTION_CONNECTIONS_URL)
}
</script>

<style scoped>
.notion-picker {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.np-head {
  display: flex;
  align-items: stretch;
  gap: 6px;
  height: 24px;
  margin: 10px 12px 8px;
  flex-shrink: 0;
}

/* Same compact field as the Download tab's by-session row: 24px tall, 11px
   text, sized to the .btn--sm beside it (the shared field is 30px). */
.np-search {
  flex: 1;
  min-width: 0;
  min-height: 0;
  height: 100%;
  padding: 0 8px;
  font-size: 11px;
}

.np-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  border-top: 1px solid var(--border-color);
}

.np-rows {
  margin: 0;
  padding: 0;
  list-style: none;
}

.np-row {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 7px 12px;
  border: none;
  border-bottom: 1px solid var(--border-color);
  background: none;
  color: var(--text-primary);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.np-row:hover {
  background-color: var(--bg-hover);
}

.np-emoji {
  flex-shrink: 0;
  width: 18px;
  text-align: center;
}

.np-doc {
  flex-shrink: 0;
  width: 18px;
  color: var(--text-secondary);
}

.np-text {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.np-title,
.np-path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.np-path {
  font-size: 11px;
  color: var(--text-muted);
}

.np-note {
  margin: 0;
  padding: 20px 16px;
  text-align: center;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-muted);
}

.np-note p {
  margin: 0 0 6px;
}

.np-error {
  color: var(--danger);
}

.np-link {
  padding: 0;
  border: none;
  background: none;
  color: var(--link-color);
  font-size: 12px;
  cursor: pointer;
}

.np-link:hover {
  text-decoration: underline;
}

.np-more {
  display: flex;
  justify-content: center;
  padding: 10px;
}
</style>
