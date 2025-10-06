import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import zh from './locales/zh.json'
import ja from './locales/ja.json'
import ko from './locales/ko.json'

export type MessageLanguages = keyof typeof en
export type MessageSchema = typeof en

const messages = {
  en,
  zh,
  ja,
  ko
}

// Create i18n instance
export const i18n = createI18n({
  legacy: false, // Use Composition API mode
  locale: 'en' as 'en' | 'zh' | 'ja' | 'ko', // Default locale, will be overridden by config
  fallbackLocale: 'en',
  messages,
  globalInjection: true // Enable global $t function
})

// Helper function to set locale
export function setI18nLanguage(locale: 'en' | 'zh' | 'ja' | 'ko') {
  i18n.global.locale.value = locale
}

// Helper function to get current locale
export function getCurrentLocale(): 'en' | 'zh' | 'ja' | 'ko' {
  return i18n.global.locale.value
}

// Helper function to detect system language
export function detectSystemLanguage(): 'en' | 'zh' | 'ja' | 'ko' {
  const systemLang = navigator.language || navigator.languages?.[0] || 'en'

  // Check if system language is Chinese (simplified or traditional)
  if (systemLang.startsWith('zh')) {
    return 'zh'
  }

  // Check if system language is Japanese
  if (systemLang.startsWith('ja')) {
    return 'ja'
  }

  // Check if system language is Korean
  if (systemLang.startsWith('ko')) {
    return 'ko'
  }

  // Default to English for all other languages
  return 'en'
}