import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

type GreetingCategory =
  | 'general'
  | 'morning' | 'afternoon' | 'evening' | 'night'
  | 'monday' | 'tuesday' | 'wednesday' | 'thursday'
  | 'friday' | 'saturday' | 'sunday'

interface Greeting {
  id: string
  text: string
  language: 'en' | 'zh'
  requiresName: boolean
  category: GreetingCategory
  weight: number
}

const CATALOG: Greeting[] = [
  // ── General / EN ─────────────────────────────────────────────────
  { id: 'en_welcome',             text: 'Welcome',                      language: 'en', requiresName: false, category: 'general',   weight: 1 },
  { id: 'en_welcome_name',        text: 'Welcome, {name}',              language: 'en', requiresName: true,  category: 'general',   weight: 1 },
  { id: 'en_hey_there',           text: 'Hey there',                    language: 'en', requiresName: false, category: 'general',   weight: 1 },
  { id: 'en_hey_there_name',      text: 'Hey there, {name}',            language: 'en', requiresName: true,  category: 'general',   weight: 1 },
  { id: 'en_hi_how_are_you',      text: "Hi, how are you?",             language: 'en', requiresName: false, category: 'general',   weight: 1 },
  { id: 'en_hi_name_how_are_you', text: 'Hi {name}, how are you?',      language: 'en', requiresName: true,  category: 'general',   weight: 1 },
  { id: 'en_hows_it_going',       text: "How's it going?",              language: 'en', requiresName: false, category: 'general',   weight: 1 },
  { id: 'en_hows_it_going_name',  text: "How's it going, {name}?",      language: 'en', requiresName: true,  category: 'general',   weight: 1 },
  { id: 'en_whats_new',           text: "What's new?",                  language: 'en', requiresName: false, category: 'general',   weight: 1 },
  { id: 'en_whats_new_name',      text: "What's new, {name}?",          language: 'en', requiresName: true,  category: 'general',   weight: 1 },
  { id: 'en_name_returns',        text: '{name} returns!',              language: 'en', requiresName: true,  category: 'general',   weight: 1 },
  { id: 'en_back_at_it',          text: 'Back at it!',                  language: 'en', requiresName: false, category: 'general',   weight: 1 },
  { id: 'en_back_at_it_name',     text: 'Back at it, {name}',           language: 'en', requiresName: true,  category: 'general',   weight: 1 },
  { id: 'en_ready_to_learn',      text: 'Ready to learn?',              language: 'en', requiresName: false, category: 'general',   weight: 1 },
  { id: 'en_mastering_today',     text: 'What are we mastering today?', language: 'en', requiresName: false, category: 'general',   weight: 1 },
  { id: 'en_whats_on_mind',       text: "What's on your mind?",         language: 'en', requiresName: false, category: 'general',   weight: 1 },
  { id: 'en_whats_on_mind_name',  text: "What's on your mind, {name}?", language: 'en', requiresName: true,  category: 'general',   weight: 1 },
  { id: 'en_coffee_study',        text: 'Coffee and study time?',       language: 'en', requiresName: false, category: 'morning',   weight: 1 },
  { id: 'en_never_stop',          text: 'Never stop learning',          language: 'en', requiresName: false, category: 'general',   weight: 1 },
  { id: 'en_keep_going',          text: "Keep going, you've got this",  language: 'en', requiresName: false, category: 'general',   weight: 1 },

  // ── General / ZH ─────────────────────────────────────────────────
  { id: 'zh_welcome',             text: '欢迎回来',                      language: 'zh', requiresName: false, category: 'general',   weight: 1 },
  { id: 'zh_welcome_name',        text: '{name}，欢迎回来',               language: 'zh', requiresName: true,  category: 'general',   weight: 1 },
  { id: 'zh_how_are_you',         text: '今天怎么样？',                   language: 'zh', requiresName: false, category: 'general',   weight: 1 },
  { id: 'zh_how_are_you_name',    text: '{name}，今天怎么样？',            language: 'zh', requiresName: true,  category: 'general',   weight: 1 },
  { id: 'zh_ready',               text: '准备上课？',                   language: 'zh', requiresName: false, category: 'general',   weight: 1 },
  { id: 'zh_what_today',          text: '今天学些什么？',                   language: 'zh', requiresName: false, category: 'general',   weight: 1 },
  { id: 'zh_coffee',              text: '来杯咖啡，开始学习？',             language: 'zh', requiresName: false, category: 'morning',   weight: 1 },
  { id: 'zh_hey_name',            text: '嘿，{name}',                    language: 'zh', requiresName: true,  category: 'general',   weight: 1 },
  { id: 'zh_never_stop',          text: '今天的课多么？',                  language: 'zh', requiresName: false, category: 'general',   weight: 1 },

  // ── Morning 5–11 / EN ────────────────────────────────────────────
  { id: 'en_good_morning',        text: 'Good morning',                 language: 'en', requiresName: false, category: 'morning',   weight: 1 },
  { id: 'en_good_morning_name',   text: 'Good morning, {name}',         language: 'en', requiresName: true,  category: 'morning',   weight: 1 },

  // ── Morning 5–11 / ZH ────────────────────────────────────────────
  { id: 'zh_good_morning',        text: '早上好',                        language: 'zh', requiresName: false, category: 'morning',   weight: 1 },
  { id: 'zh_zaoan',               text: '早安',                          language: 'zh', requiresName: false, category: 'morning',   weight: 1 },
  { id: 'zh_good_morning_name',   text: '{name}，早上好',                 language: 'zh', requiresName: true,  category: 'morning',   weight: 1 },

  // ── Afternoon 12–17 / EN ─────────────────────────────────────────
  { id: 'en_good_afternoon',      text: 'Good afternoon',               language: 'en', requiresName: false, category: 'afternoon', weight: 1 },
  { id: 'en_good_afternoon_name', text: 'Good afternoon, {name}',       language: 'en', requiresName: true,  category: 'afternoon', weight: 1 },
  { id: 'en_how_was_day',         text: 'How was your day?',            language: 'en', requiresName: false, category: 'afternoon', weight: 1 },
  { id: 'en_how_was_day_name',    text: 'How was your day, {name}?',    language: 'en', requiresName: true,  category: 'afternoon', weight: 1 },

  // ── Afternoon 12–17 / ZH ─────────────────────────────────────────
  { id: 'zh_good_afternoon',      text: '下午好',                        language: 'zh', requiresName: false, category: 'afternoon', weight: 1 },
  { id: 'zh_good_afternoon_name', text: '{name}，下午好',                 language: 'zh', requiresName: true,  category: 'afternoon', weight: 1 },

  // ── Evening 18–20 / EN ───────────────────────────────────────────
  { id: 'en_good_evening',        text: 'Good evening',                 language: 'en', requiresName: false, category: 'evening',   weight: 1 },
  { id: 'en_good_evening_name',   text: 'Good evening, {name}',         language: 'en', requiresName: true,  category: 'evening',   weight: 1 },
  { id: 'en_evening',             text: 'Evening',                      language: 'en', requiresName: false, category: 'evening',   weight: 1 },
  { id: 'en_evening_name',        text: 'Evening, {name}',              language: 'en', requiresName: true,  category: 'evening',   weight: 1 },

  // ── Evening 18–20 / ZH ───────────────────────────────────────────
  { id: 'zh_good_evening',        text: '晚上好',                        language: 'zh', requiresName: false, category: 'evening',   weight: 1 },
  { id: 'zh_good_evening_name',   text: '{name}，晚上好',                 language: 'zh', requiresName: true,  category: 'evening',   weight: 1 },
  { id: 'zh_fangwan',             text: '有晚课？',                          language: 'zh', requiresName: false, category: 'evening',   weight: 1 },

  // ── Night 21–3 / EN ──────────────────────────────────────────────
  { id: 'en_night_owl',           text: 'Hello, night owl',             language: 'en', requiresName: false, category: 'night',     weight: 2 },
  { id: 'en_moonlit_study',       text: 'A moonlit study?',             language: 'en', requiresName: false, category: 'night',     weight: 5 },
  { id: 'en_whats_mind_tonight',  text: "What's on your mind tonight?", language: 'en', requiresName: false, category: 'night',     weight: 1 },

  // ── Night 21–3 / ZH ──────────────────────────────────────────────
  { id: 'zh_night_owl',           text: '哎，夜猫子',                    language: 'zh', requiresName: false, category: 'night',     weight: 2 },
  { id: 'zh_moonlit',             text: '今夜は月が綺麗ですね',             language: 'zh', requiresName: false, category: 'night',     weight: 5 },
  { id: 'zh_late_night',          text: '夜深啦，还在学习？',                language: 'zh', requiresName: false, category: 'night',     weight: 1 },

  // ── Monday ───────────────────────────────────────────────────────
  { id: 'en_happy_monday',        text: 'Happy Monday',                 language: 'en', requiresName: false, category: 'monday',    weight: 1 },
  { id: 'en_happy_monday_name',   text: 'Happy Monday, {name}',         language: 'en', requiresName: true,  category: 'monday',    weight: 1 },
  { id: 'zh_monday',              text: '新的一周！',                     language: 'zh', requiresName: false, category: 'monday',    weight: 1 },
  { id: 'zh_monday_name',         text: '{name}，周一加油',               language: 'zh', requiresName: true,  category: 'monday',    weight: 1 },

  // ── Tuesday ──────────────────────────────────────────────────────
  { id: 'en_happy_tuesday',       text: 'Happy Tuesday',                language: 'en', requiresName: false, category: 'tuesday',   weight: 1 },
  { id: 'en_happy_tuesday_name',  text: 'Happy Tuesday, {name}',        language: 'en', requiresName: true,  category: 'tuesday',   weight: 1 },

  // ── Wednesday ────────────────────────────────────────────────────
  { id: 'en_happy_wednesday',     text: 'Happy Wednesday',              language: 'en', requiresName: false, category: 'wednesday', weight: 1 },
  { id: 'en_happy_wednesday_name',text: 'Happy Wednesday, {name}',      language: 'en', requiresName: true,  category: 'wednesday', weight: 1 },
  { id: 'zh_wednesday',           text: '周三了哦',                        language: 'zh', requiresName: false, category: 'wednesday', weight: 1 },

  // ── Thursday ─────────────────────────────────────────────────────
  { id: 'en_happy_thursday',      text: 'Happy Thursday',               language: 'en', requiresName: false, category: 'thursday',  weight: 1 },
  { id: 'en_happy_thursday_name', text: 'Happy Thursday, {name}',       language: 'en', requiresName: true,  category: 'thursday',  weight: 1 },

  // ── Friday (weight 2) ────────────────────────────────────────────
  { id: 'en_happy_friday',        text: 'Happy Friday',                 language: 'en', requiresName: false, category: 'friday',    weight: 2 },
  { id: 'en_happy_friday_name',   text: 'Happy Friday, {name}',         language: 'en', requiresName: true,  category: 'friday',    weight: 2 },
  { id: 'en_welcome_weekend',     text: 'Welcome to the weekend',       language: 'en', requiresName: false, category: 'friday',    weight: 2 },
  { id: 'en_welcome_weekend_name',text: 'Welcome to the weekend, {name}',language: 'en', requiresName: true, category: 'friday',    weight: 2 },
  { id: 'zh_friday',              text: '周五快乐！',                     language: 'zh', requiresName: false, category: 'friday',    weight: 2 },
  { id: 'zh_friday_name',         text: '{name}，周五了！',               language: 'zh', requiresName: true,  category: 'friday',    weight: 2 },

  // ── Saturday ─────────────────────────────────────────────────────
  { id: 'en_happy_saturday',      text: 'Happy Saturday!',              language: 'en', requiresName: false, category: 'saturday',  weight: 1 },
  { id: 'en_happy_saturday_name', text: 'Happy Saturday, {name}',       language: 'en', requiresName: true,  category: 'saturday',  weight: 1 },
  { id: 'zh_saturday',            text: '周末愉快',                      language: 'zh', requiresName: false, category: 'saturday',  weight: 1 },
  { id: 'zh_saturday_name',       text: '{name}，周末了！',               language: 'zh', requiresName: true,  category: 'saturday',  weight: 1 },

  // ── Sunday ───────────────────────────────────────────────────────
  { id: 'en_happy_sunday',        text: 'Happy Sunday',                 language: 'en', requiresName: false, category: 'sunday',    weight: 1 },
  { id: 'en_happy_sunday_name',   text: 'Happy Sunday, {name}',         language: 'en', requiresName: true,  category: 'sunday',    weight: 1 },
  { id: 'en_sunday_session',      text: 'Sunday session?',              language: 'en', requiresName: false, category: 'sunday',    weight: 1 },
  { id: 'en_sunday_session_name', text: 'Sunday session, {name}?',      language: 'en', requiresName: true,  category: 'sunday',    weight: 1 },
  { id: 'zh_sunday',              text: '周日好',                        language: 'zh', requiresName: false, category: 'sunday',    weight: 1 },
  { id: 'zh_sunday_name',         text: '{name}，周末愉快',               language: 'zh', requiresName: true,  category: 'sunday',    weight: 1 },
]

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

function selectGreeting(opts: {
  lastGreetingId: string
  userOriginalNickname: string
  userDisplayName: string
  isChineseMode: boolean
}): { id: string; text: string } {
  const { lastGreetingId, userOriginalNickname, userDisplayName, isChineseMode } = opts

  const now = new Date()
  const hour = now.getHours()
  const timeCategory = getTimeCategory(hour)
  const dayCategory = DAY_CATEGORIES[now.getDay()]

  const activeCategories = new Set<GreetingCategory>(['general'])
  if (timeCategory) activeCategories.add(timeCategory)
  activeCategories.add(dayCategory)

  const hasName = !!(userOriginalNickname || userDisplayName)
  const isLateNight = hour >= 22 || hour < 4

  let pool = CATALOG.filter((g) => {
    if (!activeCategories.has(g.category)) return false
    if (g.requiresName && !hasName) return false
    if (!isChineseMode && g.language === 'zh') return false
    if (g.id === lastGreetingId) return false
    return true
  })

  // Fallback: all general en greetings without name, excluding last
  if (pool.length === 0) {
    pool = CATALOG.filter(
      (g) => g.category === 'general' && g.language === 'en' && !g.requiresName && g.id !== lastGreetingId
    )
  }

  const weighted = pool.map((g) => {
    let w = g.weight
    if (isChineseMode && g.language === 'zh') w *= 6
    if (timeCategory === 'night' && g.category === 'night') w *= 2
    if (isLateNight && (g.id === 'en_night_owl' || g.id === 'en_moonlit_study' || g.id === 'zh_night_owl' || g.id === 'zh_moonlit')) w *= 1.5
    if (dayCategory === 'friday' && g.category === 'friday') w *= 3
    return { item: g, w }
  })

  const selected = weightedRandom(weighted)

  // Resolve {name}
  let name = ''
  if (selected.requiresName) {
    name = selected.language === 'zh'
      ? userOriginalNickname
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
        const config = await window.electronAPI.config.get()
        const systemLocale = (navigator.language || locale.value || 'en').toLowerCase()
        const isChineseMode = config.languageMode === 'zh' || (config.languageMode === 'system' && systemLocale.startsWith('zh'))

        if (!config.lastGreetingId) {
          window.electronAPI.config.setLastGreetingId('welcome_auto')
          return t('courses.welcome.title')
        }

        const result = selectGreeting({
          lastGreetingId: config.lastGreetingId,
          userOriginalNickname: config.userOriginalNickname ?? '',
          userDisplayName: config.userDisplayName ?? '',
          isChineseMode
        })
        window.electronAPI.config.setLastGreetingId(result.id)
        return result.text
      })()
    }

    greetingText.value = await sessionPromise
  }

  return { greetingText, loadGreeting }
}
