/**
 * Yanhe 2.0 course search — the Search page's third source, beside Live and
 * Recorded.
 *
 * The whole aita catalogue by keyword (course name or teacher), in one term or
 * all of them, a page at a time. Two reads in main; the JWT never comes here.
 *
 * The host passes the keyword, the account badge and whether its Yanhe 2.0
 * session is live, so this domain needs nothing from `features/platform` or
 * `features/course`.
 */
import { ref, watch, type Ref } from 'vue'
import type { Yanhe2Course } from '@common/yanhe2Curriculum'
import { YANHE2_SEARCH_PAGE_SIZE, type Yanhe2Term } from '@common/yanhe2Search'
import { createLogger } from '@shared/utils/logger'
import { yanhe2Reads } from './yanhe2Reads'

const log = createLogger('Yanhe2Search')

/** Same settle time as the Yanhekt search-as-you-type. */
const SEARCH_DEBOUNCE_MS = 400

/** Why there is nothing to show. `signed_out` is handled by the host's session state. */
export type Yanhe2SearchProblem = 'network' | 'failed'

export function useYanhe2Search(options: {
  /** The sidebar search bar's text. */
  keyword: Ref<string>
  /** Signed-in account's student id, '' when there is none. */
  badge: Ref<string>
  /** That account has a live Yanhe 2.0 session. */
  signedIn: Ref<boolean>
  /** The Search page is on screen and set to Yanhe 2.0. */
  active: Ref<boolean>
}) {
  const { keyword, badge, signedIn, active } = options

  const terms = ref<Yanhe2Term[]>([])
  /** The term searched; null is every term. aita filters by one term only. */
  const termId = ref<number | null>(null)
  /** Account the term list (and the default term picked from it) belongs to. */
  let termsKey = ''

  const results = ref<Yanhe2Course[]>([])
  const page = ref(1)
  const pageCount = ref(1)
  const loading = ref(false)
  const problem = ref<Yanhe2SearchProblem | null>(null)
  /** True once the grid on screen is a real answer, so "no courses" is not shown before one. */
  const loaded = ref(false)

  /** The text the page number belongs to: a search for anything else starts at page 1. */
  let pagedText = ''
  let ticket = 0
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  const cancelPending = () => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
  }

  function clear(): void {
    cancelPending()
    ticket++
    terms.value = []
    termId.value = null
    termsKey = ''
    pagedText = ''
    results.value = []
    page.value = 1
    pageCount.value = 1
    loading.value = false
    problem.value = null
    loaded.value = false
  }

  async function load(): Promise<void> {
    cancelPending()
    const account = badge.value
    if (!account || !signedIn.value || !active.value) return
    const text = keyword.value.trim()
    if (text !== pagedText) page.value = 1
    pagedText = text
    const mine = ++ticket
    loading.value = true
    problem.value = null
    try {
      // First search for this account: the terms, and the running one as the
      // default filter — an unfiltered catalogue is every course since 2024.
      if (termsKey !== account) {
        const listed = await yanhe2Reads.terms(account)
        if (mine !== ticket) return
        if (listed.kind !== 'ok') {
          if (listed.kind !== 'signed_out') problem.value = listed.kind
          return
        }
        terms.value = listed.data
        termId.value = listed.data.find((term) => term.current)?.id ?? null
        termsKey = account
      }
      const result = await yanhe2Reads.searchCourses(account, {
        keyword: text,
        termId: termId.value,
        page: page.value,
      })
      if (mine !== ticket) return
      if (result.kind === 'ok') {
        results.value = result.data.courses
        pageCount.value = Math.max(1, Math.ceil(result.data.total / YANHE2_SEARCH_PAGE_SIZE))
        loaded.value = true
      } else if (result.kind !== 'signed_out') {
        problem.value = result.kind
        results.value = []
      }
    } catch (error) {
      log.warn('Course search failed:', error)
      if (mine === ticket) {
        problem.value = 'failed'
        results.value = []
      }
    } finally {
      if (mine === ticket) loading.value = false
    }
  }

  function setTerm(id: number | null): void {
    if (termId.value === id) return
    termId.value = id
    page.value = 1
    void load()
  }

  function goToPage(next: number): void {
    if (next < 1 || next > pageCount.value || next === page.value) return
    page.value = next
    void load()
  }

  // Search-as-you-type, only while this is the source on screen. Text typed
  // under Live or Recorded is picked up when the page switches over.
  watch(keyword, () => {
    if (!active.value) return
    cancelPending()
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      void load()
    }, SEARCH_DEBOUNCE_MS)
  })

  // Switching to Yanhe 2.0, a sign-in or an account switch each run the search;
  // coming back with the same text keeps the page the user was on. Nothing is
  // fetched while another source, or another page, is showing.
  watch(
    [active, signedIn, badge],
    ([isActive, isSignedIn, account], previous) => {
      // `previous` is `[]` on the immediate run, which is not an account switch.
      if (!isSignedIn || (previous && previous.length > 0 && account !== previous[2])) clear()
      if (isSignedIn && isActive) void load()
    },
    { immediate: true },
  )

  return {
    terms,
    termId,
    results,
    page,
    pageCount,
    loading,
    problem,
    loaded,
    refresh: load,
    setTerm,
    goToPage,
  }
}
