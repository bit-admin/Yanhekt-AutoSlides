<template>
  <div class="app">
    <h1>{{ title }}</h1>
    <p>{{ message }}</p>
    <button @click="incrementCount">点击次数: {{ count }}</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const title = ref('AutoSlides - Vue + Electron')
const message = ref('Vue 框架已成功配置!')
const count = ref(0)

const incrementCount = () => {
  count.value++
}
</script>

<style scoped>
.app {
  text-align: center;
  padding: 2rem;
  font-family: Arial, sans-serif;
}

h1 {
  color: #42b883;
  margin-bottom: 1rem;
}

button {
  background-color: #42b883;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}

button:hover {
  background-color: #369870;
}
</style>