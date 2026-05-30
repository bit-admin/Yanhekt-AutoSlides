<template>
  <div class="grid gap-4" :style="{ gridTemplateColumns: `repeat(auto-fill, minmax(${thumbnailSize}px, 1fr))` }">
    <div
      v-for="item in items"
      :key="item.id"
      class="relative bg-surface border-2 rounded-lg overflow-hidden cursor-pointer transition-all"
      :class="{
        'border-accent bg-accent/10': selectedIds.includes(item.id) && item.status !== 'removed',
        'border-border hover:border-accent hover:shadow-lg': !selectedIds.includes(item.id) && item.status !== 'removed',
        'border-danger': item.status === 'removed' && !selectedIds.includes(item.id),
        'border-danger bg-danger/5': item.status === 'removed' && selectedIds.includes(item.id),
      }"
      @click="$emit('toggleSelection', item.id)"
    >
      <div class="absolute top-2 left-2 z-10">
        <input
          type="checkbox"
          :checked="selectedIds.includes(item.id)"
          class="w-[18px] h-[18px] cursor-pointer"
          @click.stop
          @change="$emit('toggleSelection', item.id)"
        />
      </div>

      <button class="absolute top-2 right-2 z-10 w-7 h-7 border-none rounded-full bg-surface/90 text-text-secondary cursor-pointer flex items-center justify-center hover:bg-surface" @click.stop="$emit('preview', item)" :title="$t('trash.preview')">
        <svg width="14" height="14" viewBox="0 0 16 16">
          <path d="M2 2v5h2V4h3V2H2zm9 0v2h3v3h2V2h-5zM4 11H2v5h5v-2H4v-3zm10 0v3h-3v2h5v-5h-2z" fill="currentColor"/>
        </svg>
      </button>

      <div class="w-full aspect-video bg-page flex items-center justify-center overflow-hidden">
        <img v-if="thumbnails[item.id]" :src="thumbnails[item.id]" :alt="item.name" class="w-full h-full object-contain" />
        <div v-else class="text-text-muted">
          <svg width="32" height="32" viewBox="0 0 32 32">
            <rect x="4" y="4" width="24" height="24" fill="currentColor" opacity="0.2"/>
          </svg>
        </div>
      </div>

      <div class="p-2.5 flex items-center gap-2 min-w-0">
        <div class="flex-1 min-w-0 text-[11px] text-text-secondary overflow-hidden text-ellipsis whitespace-nowrap">{{ formatImageName(item.name) }}</div>
        <div class="flex gap-1.5 shrink-0">
          <span v-if="item.status === 'active' && item.isCropped" class="inline-flex items-center rounded-full py-0.5 px-2 text-[11px] font-semibold bg-elevated text-text-secondary">{{ getCropLabel(item) }}</span>
          <span
            class="inline-flex items-center rounded-full py-0.5 px-2 text-[11px] font-semibold"
            :class="{
              'bg-accent/10 text-accent-strong': item.status === 'active',
              'bg-danger/10 text-danger': item.status === 'removed',
            }"
          >{{ getStatusLabel(item.status) }}</span>
          <span
            v-if="item.status === 'removed' && item.reason"
            class="inline-flex items-center rounded-full py-0.5 px-2 text-[11px] font-semibold"
            :class="{
              'bg-bg-warning-bg text-warning': item.reason === 'duplicate',
              'bg-[#ede7ff] text-[#6546c2]': item.reason === 'exclusion',
              'bg-[#dff7ea] text-success': item.reason === 'ai_filtered',
              'bg-warning-bg text-warning': item.reason === 'ai_filtered_edit',
              'bg-danger/10 text-danger': item.reason === 'manual',
            }"
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
