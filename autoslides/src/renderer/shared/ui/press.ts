import type { Directive } from 'vue'

const CONTROL = 'button, a[href], input, select, textarea'

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' && event.key !== ' ') return
  const el = event.currentTarget as HTMLElement
  // A control inside the card keeps its own keys.
  if (event.target !== el) return
  event.preventDefault()
  el.click()
}

/**
 * `v-press` gives a clickable card the keyboard route a button has: it takes
 * focus, and Enter or Space runs its click. A card holding its own controls
 * (Remove, Download…) is a named group, since a button cannot contain buttons.
 */
export const vPress: Directive<HTMLElement, string | undefined> = {
  mounted(el, binding) {
    el.tabIndex = 0
    el.dataset.press = ''
    el.setAttribute('role', el.querySelector(CONTROL) ? 'group' : 'button')
    if (binding.value) el.setAttribute('aria-label', binding.value)
    el.addEventListener('keydown', onKeydown)
  },
  updated(el, binding) {
    if (binding.value) el.setAttribute('aria-label', binding.value)
  },
  beforeUnmount(el) {
    el.removeEventListener('keydown', onKeydown)
  },
}
