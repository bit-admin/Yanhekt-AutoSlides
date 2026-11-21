import type { Directive } from 'vue'

const cleanups = new WeakMap<HTMLElement, () => void>()

/**
 * `v-flyout` is for a submenu that CSS opens on hover and focus. Escape closes
 * it and returns focus to its trigger; it stays closed until the pointer leaves,
 * focus leaves, or the trigger is pressed. A second Escape reaches the parent menu.
 */
export const vFlyout: Directive<HTMLElement> = {
  mounted(el) {
    const trigger = el.querySelector<HTMLElement>('button')
    if (!trigger) return

    const setExpanded = (open: boolean) => trigger.setAttribute('aria-expanded', String(open))
    const reopen = () => { delete el.dataset.dismissed }

    const onKeydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || el.dataset.dismissed !== undefined) return
      event.preventDefault()
      event.stopPropagation()
      el.dataset.dismissed = ''
      setExpanded(false)
      trigger.focus()
    }
    const onFocusIn = () => setExpanded(el.dataset.dismissed === undefined)
    const onFocusOut = (event: FocusEvent) => {
      if (el.contains(event.relatedTarget as Node | null)) return
      reopen()
      setExpanded(el.matches(':hover'))
    }
    const onEnter = () => setExpanded(el.dataset.dismissed === undefined)
    const onLeave = () => {
      reopen()
      setExpanded(el.contains(document.activeElement))
    }
    const onTriggerClick = () => {
      reopen()
      setExpanded(true)
    }

    setExpanded(false)
    el.addEventListener('keydown', onKeydown)
    el.addEventListener('focusin', onFocusIn)
    el.addEventListener('focusout', onFocusOut)
    el.addEventListener('mouseenter', onEnter)
    el.addEventListener('mouseleave', onLeave)
    trigger.addEventListener('click', onTriggerClick)
    cleanups.set(el, () => {
      el.removeEventListener('keydown', onKeydown)
      el.removeEventListener('focusin', onFocusIn)
      el.removeEventListener('focusout', onFocusOut)
      el.removeEventListener('mouseenter', onEnter)
      el.removeEventListener('mouseleave', onLeave)
      trigger.removeEventListener('click', onTriggerClick)
    })
  },
  beforeUnmount(el) {
    cleanups.get(el)?.()
    cleanups.delete(el)
  },
}
