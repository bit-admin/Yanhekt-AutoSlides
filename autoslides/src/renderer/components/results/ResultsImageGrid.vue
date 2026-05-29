<template>
  <div class="grid gap-4" :style="{ gridTemplateColumns: `repeat(auto-fill, minmax(${thumbnailSize}px, 1fr))` }">
    <div
      v-for="item in items"
      :key="item.id"
      class="relative cursor-pointer overflow-hidden rounded-lg border-2 bg-modal text-fg transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
      :class="selectedIds.includes(item.id) && item.status === 'removed' ? 'border-[#d9534f] bg-[#fff1f0] dark:bg-[#482220]'
        : item.status === 'removed' ? 'border-[#d9534f]'
        : selectedIds.includes(item.id) ? 'border-accent bg-[#e7f3ff] dark:bg-[#1a3a5c]'
        : 'border-line hover:border-accent'"
      @click="$emit('toggleSelection', item.id)"
    >
      <div class="absolute left-2 top-2 z-[1]">
        <input
          type="checkbox"
          class="h-[18px] w-[18px] cursor-pointer"
          :checked="selectedIds.includes(item.id)"
          @click.stop
          @change="$emit('toggleSelection', item.id)"
        />
      </div>

      <button
        class="absolute right-2 top-2 z-[1] flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-none bg-[rgba(255,255,255,0.92)] text-[#555] dark:bg-[rgba(40,40,40,0.92)] dark:text-[#ddd]"
        @click.stop="$emit('preview', item)"
        :title="$t('trash.preview')"
      >
        <svg width="14" height="14" viewBox="0 0 16 16">
          <path d="M2 2v5h2V4h3V2H2zm9 0v2h3v3h2V2h-5zM4 11H2v5h5v-2H4v-3zm10 0v3h-3v2h5v-5h-2z" fill="currentColor"/>
        </svg>
      </button>

      <div class="flex aspect-video w-full items-center justify-center overflow-hidden bg-[#f5f5f5] dark:bg-[#252525]">
        <img v-if="thumbnails[item.id]" :src="thumbnails[item.id]" :alt="item.name" class="h-full w-full object-contain" />
        <div v-else class="text-[#c3c7cb]">
          <svg width="32" height="32" viewBox="0 0 32 32">
            <rect x="4" y="4" width="24" height="24" fill="currentColor" opacity="0.2"/>
          </svg>
        </div>
      </div>

      <div class="flex min-w-0 items-center gap-2 p-2.5">
        <div class="min-w-0 flex-1 truncate text-[11px] text-fg-secondary">{{ formatImageName(item.name) }}</div>
        <div class="flex flex-shrink-0 gap-1.5">
          <span v-if="item.status === 'active' && item.isCropped" :class="croppedBadgeClass">{{ getCropLabel(item) }}</span>
          <span :class="statusBadgeClass(item.status)">{{ getStatusLabel(item.status) }}</span>
          <span
            v-if="item.status === 'removed' && item.reason"
            :class="reasonBadgeClass(item.reason)"
          >
            {{ getReasonLabel(item.reason) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { ResultsItem, ResultsReason } from '@features/results/resultsTypes'

defineProps<{
  items: ResultsItem[]
  selectedIds: string[]
  thumbnails: Record<string, string>
  thumbnailSize: number
}>()

defineEmits<{
  (e: 'toggleSelection', id: string): void
  (e: 'preview', item: ResultsItem): void
}>()

const { t } = useI18n()

// Pastel badge palette is intentionally theme-independent (same in light/dark)
// except the neutral "cropped" badge, which gets a dark variant.
const badgeBase = 'inline-flex items-center rounded-full px-2 py-[3px] text-[11px] font-semibold'
const croppedBadgeClass = `${badgeBase} bg-[#edf0f3] text-[#58616b] dark:bg-[#40464d] dark:text-[#d9dde1]`

const statusBadgeClass = (status: 'active' | 'removed') =>
  status === 'active'
    ? `${badgeBase} bg-[#e7f3ff] text-[#1768a8]`
    : `${badgeBase} bg-[#ffe8e6] text-[#b63a30]`

const reasonBadgeClass = (reason: ResultsReason) => {
  switch (reason) {
    case 'duplicate':
      return `${badgeBase} bg-[#fff2cc] text-[#8a5b00]`
    case 'exclusion':
      return `${badgeBase} bg-[#ede7ff] text-[#6546c2]`
    case 'ai_filtered':
      return `${badgeBase} bg-[#dff7ea] text-[#257550]`
    case 'ai_filtered_edit':
      return `${badgeBase} bg-[#fff3d6] text-[#955800]`
    case 'manual':
    default:
      return `${badgeBase} bg-[#ffe8e6] text-[#b63a30]`
  }
}

const formatImageName = (name: string): string => {
  return name.replace(/\.png$/i, '')
}

const getReasonLabel = (reason: ResultsReason) => {
  switch (reason) {
    case 'duplicate':
      return t('trash.duplicate')
    case 'exclusion':
      return t('trash.exclusion')
    case 'ai_filtered':
      return t('trash.aiFilteredNotSlide')
    case 'ai_filtered_edit':
      return t('trash.aiFilteredEdit')
    case 'manual':
      return t('trash.manual')
    default:
      return reason
  }
}

const getStatusLabel = (status: 'active' | 'removed') => {
  return status === 'active' ? t('trash.active') : t('trash.removed')
}

const getCropLabel = (item: ResultsItem) => {
  return item.isAutoCropped ? t('trash.autoCropped') : t('trash.cropped')
}
</script>
