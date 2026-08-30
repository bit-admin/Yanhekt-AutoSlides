<template>
  <div class="no-courses-empty">
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
        <circle cx="12" cy="12" r="7" />
        <line x1="6" y1="18" x2="18" y2="6" />
      </g>
    </svg>
    <span class="no-courses-empty-title">{{ $t('courses.noResults') }}</span>
  </div>
</template>

<style scoped>
.no-courses-empty {
  flex: 1;
  width: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: var(--text-secondary);
}

.no-courses-empty-title {
  font-size: 0.875rem;
}
</style>
