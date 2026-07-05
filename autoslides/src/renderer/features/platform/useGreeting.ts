import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { configStore } from '@shared/services/configStore'
import { overrides } from '@shared/overrideRegistry'

import {
  GREETING_CATALOG,
  type Greeting,
  type GreetingCategory,
  type GreetingLanguage,
} from './greetingCatalog'

const DAY_CATEGORIES: GreetingCategory[] = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
]

function getTimeCategory(hour: number): GreetingCategory | null {
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 18) return 'afternoon'
  if (hour >= 18 && hour < 21) return 'evening'
  if (hour >= 21 || hour < 4) return 'night'
  return null
}

function weightedRandom(pool: Array<{ item: Greeting; w: number }>): Greeting {
  const total = pool.reduce((s, e) => s + e.w, 0)
  let r = Math.random() * total
  for (const entry of pool) {
    r -= entry.w
    if (r <= 0) return entry.item
  }
  return pool[pool.length - 1].item
}

function resolveGreetingLanguage(
  languageMode: 'system' | GreetingLanguage,
  systemLocale: string
): GreetingLanguage {
  if (languageMode !== 'system') return languageMode
  if (systemLocale.startsWith('zh')) return 'zh'
  if (systemLocale.startsWith('ja')) return 'ja'
  if (systemLocale.startsWith('ko')) return 'ko'
  return 'en'
}

function selectGreeting(opts: {
  lastGreetingId: string
  userOriginalNickname: string
  userDisplayName: string
  preferredLanguage: GreetingLanguage
}): { id: string; text: string } {
  const { lastGreetingId, userOriginalNickname, userDisplayName, preferredLanguage } = opts

  const now = new Date()
  const hour = now.getHours()
  const timeCategory = getTimeCategory(hour)
  const dayCategory = DAY_CATEGORIES[now.getDay()]

  const activeCategories = new Set<GreetingCategory>(['general'])
  if (timeCategory) activeCategories.add(timeCategory)
  activeCategories.add(dayCategory)

  const hasName = !!(userOriginalNickname || userDisplayName)
  const isLateNight = hour >= 22 || hour < 4

  let pool = GREETING_CATALOG.filter((g) => {
    if (!activeCategories.has(g.category)) return false
    if (g.requiresName && !hasName) return false
    if (g.language !== 'en' && g.language !== preferredLanguage) return false
    if (g.id === lastGreetingId) return false
    return true
  })

  // Fallback: all general en greetings without name, excluding last
  if (pool.length === 0) {
    pool = GREETING_CATALOG.filter(
      (g) => g.category === 'general' && g.language === 'en' && !g.requiresName && g.id !== lastGreetingId
    )
  }

  const weighted = pool.map((g) => {
    let w = g.weight
    if (preferredLanguage !== 'en' && g.language === preferredLanguage) w *= 6
    if (timeCategory === 'night' && g.category === 'night') w *= 2
    if (isLateNight && g.category === 'night') w *= 1.5
    if ((dayCategory === 'friday' || dayCategory === 'saturday' || dayCategory === 'sunday') && g.category === dayCategory) w *= 3
    return { item: g, w }
  })

  const selected = weightedRandom(weighted)

  let name = ''
  if (selected.requiresName) {
    const usesOriginalName = selected.language === 'zh' || selected.language === 'ja' || selected.language === 'ko'
    name = usesOriginalName
      ? (userOriginalNickname || userDisplayName)
      : (userDisplayName || userOriginalNickname)
  }
  const text = selected.text.replace('{name}', name)

  return { id: selected.id, text }
}

// Module-level session singleton — computed once per app session
let sessionPromise: Promise<string> | null = null

export function useGreeting() {
  const { t, locale } = useI18n()
  const greetingText = ref('')

  const loadGreeting = async () => {
    if (!sessionPromise) {
      sessionPromise = (async () => {
        const config = configStore
        const systemLocale = (navigator.language || locale.value || 'en').toLowerCase()
        const preferredLanguage = resolveGreetingLanguage(config.languageMode, systemLocale)

        // A registered override (demo mode) returns one fixed, deterministic
        // greeting instead of rolling a random one — so screenshots are stable.
        if (overrides.greeting) {
          return overrides.greeting()
        }

        if (!config.lastGreetingId) {
          window.electronAPI.config.setLastGreetingId('welcome_auto')
          return t('courses.welcome.title')
        }

        const result = selectGreeting({
          lastGreetingId: config.lastGreetingId,
          userOriginalNickname: config.userOriginalNickname ?? '',
          userDisplayName: config.userDisplayName ?? '',
          preferredLanguage
        })
        window.electronAPI.config.setLastGreetingId(result.id)
        return result.text
      })()
    }

    greetingText.value = await sessionPromise
  }

  return { greetingText, loadGreeting }
}
