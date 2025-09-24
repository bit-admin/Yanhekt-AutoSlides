<template>
  <div class="left-panel">
    <div class="login-section">
      <div v-if="!isLoggedIn" class="login-form">
        <h3>Sign In</h3>
        <p>Please sign in to access your courses and settings.</p>
        <div class="input-group">
          <input
            v-model="username"
            type="text"
            placeholder="Username"
            class="input-field"
          />
          <input
            v-model="password"
            type="password"
            placeholder="Password"
            class="input-field"
          />
        </div>
        <button @click="login" class="login-btn">Sign In</button>
      </div>
      <div v-else class="user-info">
        <h3>Hi there, {{ userNickname }}</h3>
        <p>Sign in as {{ userId }}</p>
        <button @click="logout" class="logout-btn">Sign Out</button>
      </div>
    </div>

    <div class="control-section">
      <div class="control-header">
        <h3>Settings</h3>
        <button @click="openAdvancedSettings" class="advanced-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
          </svg>
          Advanced Settings
        </button>
      </div>
      <div class="settings-content">
        <p class="placeholder">Settings will be implemented here</p>
      </div>
    </div>

    <div class="status-section">
      <div class="status-row">
        <span class="status-label">Connection:</span>
        <span :class="['status-value', connectionMode]">
          {{ connectionMode === 'internal' ? 'Internal Network' : 'External Network' }}
        </span>
      </div>
      <div class="status-row">
        <span class="status-label">Task Status:</span>
        <span class="status-value">{{ taskStatus }}</span>
      </div>
      <div class="status-row">
        <span class="status-label">Download:</span>
        <span class="status-value">{{ downloadSpeed }}</span>
      </div>
    </div>

    <div v-if="showAdvancedModal" class="modal-overlay" @click="closeAdvancedSettings">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Advanced Settings</h3>
          <button @click="closeAdvancedSettings" class="close-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <p>Advanced settings will be implemented here</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const isLoggedIn = ref(false)
const username = ref('')
const password = ref('')
const userNickname = ref('User')
const userId = ref('user123')
const connectionMode = ref<'internal' | 'external'>('internal')
const taskStatus = ref('Ready')
const downloadSpeed = ref('0 KB/s')
const showAdvancedModal = ref(false)

const login = () => {
  if (username.value && password.value) {
    isLoggedIn.value = true
    userNickname.value = username.value
  }
}

const logout = () => {
  isLoggedIn.value = false
  username.value = ''
  password.value = ''
}

const openAdvancedSettings = () => {
  showAdvancedModal.value = true
}

const closeAdvancedSettings = () => {
  showAdvancedModal.value = false
}
</script>

<style scoped>
.left-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0;
}

.login-section {
  padding: 16px;
  border-bottom: 1px solid #e0e0e0;
  background-color: #f8f9fa;
}

.login-form h3, .user-info h3 {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
}

.login-form p, .user-info p {
  margin: 0 0 12px 0;
  font-size: 12px;
  color: #666;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.input-field {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.login-btn, .logout-btn {
  width: 100%;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.login-btn {
  background-color: #007acc;
  color: white;
}

.login-btn:hover {
  background-color: #005a9e;
}

.logout-btn {
  background-color: #dc3545;
  color: white;
}

.logout-btn:hover {
  background-color: #c82333;
}

.control-section {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.control-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.control-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.advanced-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background-color: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.advanced-btn:hover {
  background-color: #e9ecef;
}

.settings-content {
  color: #666;
  font-style: italic;
}

.placeholder {
  margin: 0;
  font-size: 14px;
}

.status-section {
  padding: 16px;
  border-top: 1px solid #e0e0e0;
  background-color: #f8f9fa;
}

.status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
}

.status-row:last-child {
  margin-bottom: 0;
}

.status-label {
  font-weight: 500;
  color: #333;
}

.status-value {
  color: #666;
}

.status-value.internal {
  color: #28a745;
}

.status-value.external {
  color: #ffc107;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background-color: white;
  border-radius: 8px;
  width: 400px;
  max-width: 90vw;
  max-height: 80vh;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background-color: #f8f9fa;
}

.modal-body {
  padding: 16px;
  color: #666;
  font-style: italic;
}
</style>