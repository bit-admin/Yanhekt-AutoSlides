/**
 * Yanhe 2.0 → Calendar page state.
 *
 * Two views over two reads in main: All Courses is one school day grouped by
 * period, My Courses is the signed-in account's own week. The JWT never comes
 * here; the page sends a date and gets plain rows back.
 *
 * The host passes the account badge and whether its Yanhe 2.0 session is live,
 * so this domain needs nothing from `features/platform`.
 */
import { computed, ref, watch, type Ref } from 'vue'
import {
  beijingClock,
  beijingDate,
  isCalendarDate,
  shiftDate,
  weekStartOf,
  type Yanhe2CalendarPeriod,
  type Yanhe2ScheduleDay,
} from '@common/yanhe2Calendar'
import { createLogger } from '@shared/utils/logger'

const log = createLogger('Yanhe2Calendar')

export type Yanhe2CalendarView = 'all' | 'mine'
/** Why the current view has nothing to show. `signed_out` is handled by the host's session state. */
export type Yanhe2CalendarProblem = 'network' | 'failed'

const KEYWORD_DEBOUNCE_MS = 400

export function useYanhe2Calendar(options: {
  /** Signed-in account's student id, '' when there is none. */
  badge: Ref<string>
  /** That account has a live Yanhe 2.0 session. */
  signedIn: Ref<boolean>
  /** The Calendar page is the one on screen. */
  active: Ref<boolean>
}) {
  const { badge, signedIn, active } = options

  const view = ref<Yanhe2CalendarView>('all')
  const today = ref(beijingDate(Date.now()))

  // ---- All Courses: one day ------------------------------------------------
  const date = ref(today.value)
  const keyword = ref('')
  /** What the day on screen was filtered by; `keyword` runs ahead of it while typing. */
  const appliedKeyword = ref('')
  const periods = ref<Yanhe2CalendarPeriod[]>([])
  const expanded = ref<Set<number>>(new Set())
  const loadingPeriods = ref<Set<number>>(new Set())
  const dayLoading = ref(false)
  const dayProblem = ref<Yanhe2CalendarProblem | null>(null)
  /** `account|date|keyword` the periods on screen belong to. */
  let dayKey = ''
  let dayTicket = 0

  // ---- My Courses: one week ------------------------------------------------
  const weekStart = ref(weekStartOf(today.value))
  const weekEnd = computed(() => shiftDate(weekStart.value, 6))
  const days = ref<Yanhe2ScheduleDay[]>([])
  const weekLoading = ref(false)
  const weekProblem = ref<Yanhe2CalendarProblem | null>(null)
  let weekKey = ''
  let weekTicket = 0

  const sessionCount = computed(() => periods.value.reduce((n, p) => n + p.sessions.length, 0))
  const isToday = computed(() => date.value === today.value)
  const isThisWeek = computed(() => weekStart.value === weekStartOf(today.value))

  /** Open the period that is on now (today) or the first one with classes; every match when filtering. */
  function defaultExpanded(list: Yanhe2CalendarPeriod[], filtered: boolean): Set<number> {
    if (filtered) return new Set(list.filter((p) => p.sessions.length > 0).map((p) => p.id))
    let pick: Yanhe2CalendarPeriod | undefined
    if (date.value === today.value) {
      const clock = beijingClock(Math.floor(Date.now() / 1000))
      pick = list.find((p) => p.endTime >= clock)
    }
    pick ??= list.find((p) => p.sessions.length > 0 || !p.loaded) ?? list[0]
    return new Set(pick ? [pick.id] : [])
  }

  async function loadDay(): Promise<void> {
    const account = badge.value
    if (!account || !signedIn.value || !isCalendarDate(date.value)) return
    const term = keyword.value.trim()
    const key = `${account}|${date.value}|${term}`
    const ticket = ++dayTicket
    // A revisit refreshes what is on screen in place; a new day or filter starts clean.
    const sameDay = key === dayKey
    if (!sameDay) {
      periods.value = []
      loadingPeriods.value = new Set()
    }
    dayLoading.value = true
    dayProblem.value = null
    try {
      const result = await window.electronAPI.yanhe2.calendarDay(account, { date: date.value, keyword: term })
      if (ticket !== dayTicket) return
      if (result.kind === 'ok') {
        periods.value = result.data.periods
        appliedKeyword.value = term
        if (!sameDay) expanded.value = defaultExpanded(result.data.periods, term !== '')
        dayKey = key
        for (const period of result.data.periods) {
          if (!period.loaded && expanded.value.has(period.id)) void loadPeriod(period.id)
        }
      } else if (result.kind !== 'signed_out') {
        dayProblem.value = result.kind
      }
    } catch (error) {
      log.warn('Day list failed:', error)
      if (ticket === dayTicket) dayProblem.value = 'failed'
    } finally {
      if (ticket === dayTicket) dayLoading.value = false
    }
  }

  /** Fill one period the day answer left out. */
  async function loadPeriod(periodId: number): Promise<void> {
    const account = badge.value
    if (!account || !signedIn.value || loadingPeriods.value.has(periodId)) return
    const ticket = dayTicket
    loadingPeriods.value = new Set(loadingPeriods.value).add(periodId)
    try {
      const result = await window.electronAPI.yanhe2.calendarDay(account, {
        date: date.value,
        keyword: appliedKeyword.value,
        periodId,
      })
      if (ticket !== dayTicket) return
      if (result.kind === 'ok') {
        const fresh = result.data.periods.find((p) => p.id === periodId)
        if (fresh) periods.value = periods.value.map((p) => (p.id === periodId ? fresh : p))
      } else if (result.kind !== 'signed_out') {
        dayProblem.value = result.kind
      }
    } catch (error) {
      log.warn('Period list failed:', error)
    } finally {
      if (ticket === dayTicket) {
        const next = new Set(loadingPeriods.value)
        next.delete(periodId)
        loadingPeriods.value = next
      }
    }
  }

  function togglePeriod(period: Yanhe2CalendarPeriod): void {
    const next = new Set(expanded.value)
    if (next.has(period.id)) {
      next.delete(period.id)
    } else {
      next.add(period.id)
      if (!period.loaded) void loadPeriod(period.id)
    }
    expanded.value = next
  }

  async function loadWeek(): Promise<void> {
    const account = badge.value
    if (!account || !signedIn.value) return
    const key = `${account}|${weekStart.value}`
    const ticket = ++weekTicket
    if (key !== weekKey) days.value = []
    weekLoading.value = true
    weekProblem.value = null
    try {
      const result = await window.electronAPI.yanhe2.calendarWeek(account, {
        startDate: weekStart.value,
        endDate: weekEnd.value,
      })
      if (ticket !== weekTicket) return
      if (result.kind === 'ok') {
        days.value = result.data
        weekKey = key
      } else if (result.kind !== 'signed_out') {
        weekProblem.value = result.kind
      }
    } catch (error) {
      log.warn('Week schedule failed:', error)
      if (ticket === weekTicket) weekProblem.value = 'failed'
    } finally {
      if (ticket === weekTicket) weekLoading.value = false
    }
  }

  function refresh(): Promise<void> {
    today.value = beijingDate(Date.now())
    return view.value === 'all' ? loadDay() : loadWeek()
  }

  function setDate(value: string): void {
    if (isCalendarDate(value)) date.value = value
  }
  const stepDay = (delta: number) => setDate(shiftDate(date.value, delta))
  const goToday = () => {
    today.value = beijingDate(Date.now())
    date.value = today.value
  }
  const stepWeek = (delta: number) => {
    weekStart.value = shiftDate(weekStart.value, delta * 7)
  }
  const setWeek = (value: string) => {
    if (isCalendarDate(value)) weekStart.value = weekStartOf(value)
  }
  const goThisWeek = () => {
    today.value = beijingDate(Date.now())
    weekStart.value = weekStartOf(today.value)
  }

  let keywordTimer: ReturnType<typeof setTimeout> | null = null
  function cancelKeywordTimer(): void {
    if (keywordTimer) clearTimeout(keywordTimer)
    keywordTimer = null
  }
  /** Enter in the filter box: search now instead of waiting out the debounce. */
  function submitKeyword(): void {
    cancelKeywordTimer()
    void loadDay()
  }
  watch(keyword, () => {
    cancelKeywordTimer()
    keywordTimer = setTimeout(() => {
      keywordTimer = null
      if (active.value && view.value === 'all') void loadDay()
    }, KEYWORD_DEBOUNCE_MS)
  })

  // Opening the page, a sign-in, an account switch, or a new day / week / view
  // each reload the view on screen. Nothing is fetched while the page is hidden.
  watch(
    [active, signedIn, badge, view, date, weekStart],
    ([isActive, isSignedIn]) => {
      if (!isSignedIn) {
        dayTicket++
        weekTicket++
        cancelKeywordTimer()
        periods.value = []
        days.value = []
        dayKey = ''
        weekKey = ''
        dayLoading.value = false
        weekLoading.value = false
        return
      }
      if (isActive) void refresh()
    },
    { immediate: true },
  )

  return {
    view,
    today,
    date,
    keyword,
    appliedKeyword,
    periods,
    expanded,
    loadingPeriods,
    dayLoading,
    dayProblem,
    sessionCount,
    isToday,
    weekStart,
    weekEnd,
    days,
    weekLoading,
    weekProblem,
    isThisWeek,
    refresh,
    setDate,
    stepDay,
    goToday,
    stepWeek,
    setWeek,
    goThisWeek,
    togglePeriod,
    submitKeyword,
  }
}
