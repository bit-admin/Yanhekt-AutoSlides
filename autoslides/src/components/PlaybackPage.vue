<template>
  <div class="playback-page">
    <div class="header">
      <button @click="goBack" class="back-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15,18 9,12 15,6"/>
        </svg>
        Back
      </button>
      <div class="title-info">
        <h2>{{ course?.title }}</h2>
        <p v-if="session">{{ session.title }}</p>
      </div>
    </div>

    <div class="content">
      <div class="placeholder-content">
        <div class="video-placeholder">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <polygon points="5,3 19,12 5,21"/>
          </svg>
          <p>Playback interface will be implemented here</p>
        </div>

        <div class="info-section">
          <h3>Course Information</h3>
          <p><strong>Course:</strong> {{ course?.title }}</p>
          <p><strong>Instructor:</strong> {{ course?.instructor }}</p>
          <p v-if="session"><strong>Session:</strong> {{ session.title }}</p>
          <p v-if="session"><strong>Date:</strong> {{ session.date }}</p>
          <p v-if="session"><strong>Duration:</strong> {{ session.duration }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Course {
  id: string
  title: string
  instructor: string
  time: string
}

interface Session {
  id: string
  title: string
  date: string
  duration: string
}

const props = defineProps<{
  course: Course | null
  session?: Session | null
}>()

const emit = defineEmits<{
  back: []
}>()

const goBack = () => {
  emit('back')
}
</script>

<style scoped>
.playback-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
}

.header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  color: #666;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.back-btn:hover {
  border-color: #007acc;
  color: #007acc;
}

.title-info h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #333;
}

.title-info p {
  margin: 4px 0 0 0;
  font-size: 14px;
  color: #666;
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.placeholder-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.video-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  border: 2px dashed #ddd;
  border-radius: 8px;
  background-color: #f8f9fa;
  color: #666;
  gap: 16px;
}

.video-placeholder p {
  margin: 0;
  font-size: 16px;
  font-style: italic;
}

.info-section {
  padding: 20px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background-color: white;
}

.info-section h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.info-section p {
  margin: 8px 0;
  font-size: 14px;
  color: #666;
}

.info-section strong {
  color: #333;
}
</style>