import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import zh from './locales/zh.json'

export type MessageLanguages = keyof typeof en
export type MessageSchema = typeof en

const messages = {
  en,
  zh
}

// Create i18n instance
export const i18n = createI18n<[MessageSchema], 'en' | 'zh'>({
  legacy: false, // Use Composition API mode
  locale: 'en', // Default locale, will be overridden by config
  fallbackLocale: 'en',
  messages,
  globalInjection: true // Enable global $t function
})

// Helper function to set locale
export function setI18nLanguage(locale: 'en' | 'zh') {
  i18n.global.locale.value = locale
}

// Helper function to get current locale
export function getCurrentLocale(): 'en' | 'zh' {
  return i18n.global.locale.value
}

// Helper function to detect system language
export function detectSystemLanguage(): 'en' | 'zh' {
  const systemLang = navigator.language || navigator.languages?.[0] || 'en'

  // Check if system language is Chinese (simplified or traditional)
  if (systemLang.startsWith('zh')) {
    return 'zh'
  }

  // Default to English for all other languages
  return 'en'
}