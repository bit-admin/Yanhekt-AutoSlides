<template>
  <div class="main-content">
    <div class="content-area">
      <RouterView v-slot="{ Component, route }">
        <!-- Browsing surfaces stay cached (state survives navigation, like the
             desktop app's always-mounted mode containers). -->
        <KeepAlive :include="CACHE_NAMES" :max="10">
          <component
            :is="Component"
            v-if="route.meta.keepAlive"
            :key="cacheKey(route)"
            class="route-view"
          />
        </KeepAlive>
        <!-- Playback is never cached: unmount stops extraction/player, and a
             sibling-session route change remounts the player (fullPath key). -->
        <component
          :is="Component"
          v-if="!route.meta.keepAlive"
          :key="route.fullPath"
          class="route-view"
        />
      </RouterView>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RouteLocationNormalizedLoaded } from 'vue-router'

// Component names eligible for the KeepAlive cache (each cached SFC declares
// its name via defineOptions so include-matching survives production builds).
const CACHE_NAMES = [
  'HomePage',
  'SearchPage',
  'CoursePage',
  'RecordedCourseRoute',
  'SlidesPage',
  'NotesPage',
  'SettingsPage',
]

// One cached instance per nav target; /live and /recorded share CoursePage but
// get independent instances via distinct keys, and each recorded course keeps
// its own sessions-list instance (LRU-bounded by :max above).
const cacheKey = (route: RouteLocationNormalizedLoaded) =>
  route.name === 'recorded-course' ? route.fullPath : String(route.name)
</script>

<style scoped>
.main-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-page);
  color: var(--text-primary);
}

.content-area {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.route-view {
  height: 100%;
  width: 100%;
}
</style>
