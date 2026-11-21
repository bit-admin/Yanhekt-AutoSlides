import type { Directive } from 'vue'

/**
 * `v-dialog` makes an element behave as a modal: it is named, takes focus, keeps
 * Tab inside, closes the topmost one on Escape, and gives focus back afterwards.
 * Looks stay with the component. Playback tabs stay mounted, so a dialog inside
 * a hidden (inert) tab is ignored until its tab is shown again.
 */
export interface DialogOptions {
  /** Accessible name, when the dialog has no heading to point at. */
  label?: string
  /** Escape calls this. Leave it out where Escape must not dismiss. */
  close?: () => void
  /** While true (a write is running) Escape does nothing. */
  busy?: boolean
}

interface Entry {
  el: HTMLElement
  options: DialogOptions
  returnFocus: Element | null
}

const stack: Entry[] = []
let nextId = 0

const FOCUSABLE = [
  'a[href]', 'button:not(:disabled)', 'input:not(:disabled):not([type="hidden"])',
  'select:not(:disabled)', 'textarea:not(:disabled)', '[tabindex]:not([tabindex="-1"])',
].join(',')

const isShown = (el: HTMLElement): boolean => !el.closest('[inert]') && el.getClientRects().length > 0

/** The dialog that owns input now, if any. */
export function activeDialog(): HTMLElement | null {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (isShown(stack[i].el)) return stack[i].el
  }
  return null
}

const topEntry = (): Entry | null => {
  const el = activeDialog()
  return el ? stack.find((entry) => entry.el === el) ?? null : null
}

function focusables(el: HTMLElement): HTMLElement[] {
  return [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((node) => node.getClientRects().length > 0 && !node.closest('[inert]'))
}

function onKeydown(event: KeyboardEvent): void {
  const top = topEntry()
  if (!top || event.defaultPrevented) return
  if (event.key === 'Escape') {
    if (!top.options.close || top.options.busy) return
    event.preventDefault()
    event.stopPropagation()
    top.options.close()
    return
  }
  if (event.key !== 'Tab') return
  const nodes = focusables(top.el)
  if (nodes.length === 0) {
    event.preventDefault()
    top.el.focus({ preventScroll: true })
    return
  }
  const first = nodes[0]
  const last = nodes[nodes.length - 1]
  const current = document.activeElement
  if (!top.el.contains(current) || current === top.el) {
    event.preventDefault()
    ;(event.shiftKey ? last : first).focus()
  } else if (event.shiftKey && current === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && current === last) {
    event.preventDefault()
    first.focus()
  }
}

function onFocusIn(event: FocusEvent): void {
  const top = topEntry()
  if (top && event.target instanceof Node && !top.el.contains(event.target)) {
    top.el.focus({ preventScroll: true })
  }
}

function name(el: HTMLElement, options: DialogOptions): void {
  if (options.label) {
    el.setAttribute('aria-label', options.label)
    el.removeAttribute('aria-labelledby')
    return
  }
  if (el.hasAttribute('aria-labelledby')) return
  const heading = el.querySelector<HTMLElement>('h1, h2, h3')
  if (!heading) return
  if (!heading.id) heading.id = `dialog-title-${++nextId}`
  el.setAttribute('aria-labelledby', heading.id)
}

export const vDialog: Directive<HTMLElement, DialogOptions | undefined> = {
  mounted(el, binding) {
    const options = binding.value ?? {}
    if (stack.length === 0) {
      document.addEventListener('keydown', onKeydown)
      document.addEventListener('focusin', onFocusIn)
    }
    stack.push({ el, options, returnFocus: document.activeElement })
    el.setAttribute('role', 'dialog')
    el.setAttribute('aria-modal', 'true')
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1')
    name(el, options)
    // The surface itself, so Enter cannot press a destructive button by accident.
    // A component that focuses a field does so right after this.
    if (isShown(el) && !el.contains(document.activeElement)) el.focus({ preventScroll: true })
  },
  updated(el, binding) {
    const entry = stack.find((item) => item.el === el)
    if (!entry) return
    entry.options = binding.value ?? {}
    name(el, entry.options)
  },
  beforeUnmount(el) {
    const index = stack.findIndex((item) => item.el === el)
    if (index === -1) return
    const [entry] = stack.splice(index, 1)
    if (stack.length === 0) {
      document.removeEventListener('keydown', onKeydown)
      document.removeEventListener('focusin', onFocusIn)
    }
    const back = entry.returnFocus
    if (back instanceof HTMLElement && back.isConnected && !back.closest('[inert]') && el.contains(document.activeElement)) {
      queueMicrotask(() => back.focus({ preventScroll: true }))
    }
  },
}
