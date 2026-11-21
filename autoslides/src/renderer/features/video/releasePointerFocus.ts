import { nextTick, type Directive } from 'vue'

const PRESSED = 'button, a[href], summary, [role="button"], [role="menuitem"], [role="option"], input[type="checkbox"], input[type="range"]'
const CHOSEN = 'select, input[type="range"]'

const cleanups = new WeakMap<HTMLElement, () => void>()

/**
 * `v-release-pointer-focus` goes on a player. After a mouse click or a dropdown
 * choice the control gives focus back, so Space means play/pause again. A
 * control reached by keyboard keeps focus and Space still presses it. An open
 * popover keeps its trigger focused so Escape can close it, and a dialog that
 * took focus is left alone.
 */
export const vReleasePointerFocus: Directive<HTMLElement> = {
  mounted(root) {
    let usingPointer = false

    const release = async (control: HTMLElement) => {
      await nextTick()
      // A popover option unmounts as it closes, which leaves focus on the body.
      const active = document.activeElement
      if (active !== control && active !== document.body) return
      if (control.closest('.dual-popover-anchor')?.querySelector('.dual-popover')) return
      // A player that listens on its own root needs focus to stay on that root.
      if (root.hasAttribute('tabindex')) root.focus({ preventScroll: true })
      else control.blur()
    }

    const onPointerDown = () => { usingPointer = true }
    const onKeyDown = () => { usingPointer = false }
    const onClick = (event: MouseEvent) => {
      if (event.detail === 0 || !(event.target instanceof Element)) return
      const control = event.target.closest<HTMLElement>(PRESSED)
      if (control && root.contains(control)) void release(control)
    }
    const onChange = (event: Event) => {
      if (!usingPointer || !(event.target instanceof HTMLElement)) return
      if (event.target.matches(CHOSEN)) void release(event.target)
    }

    root.addEventListener('pointerdown', onPointerDown, true)
    root.addEventListener('keydown', onKeyDown, true)
    root.addEventListener('click', onClick)
    root.addEventListener('change', onChange)
    cleanups.set(root, () => {
      root.removeEventListener('pointerdown', onPointerDown, true)
      root.removeEventListener('keydown', onKeyDown, true)
      root.removeEventListener('click', onClick)
      root.removeEventListener('change', onChange)
    })
  },
  beforeUnmount(root) {
    cleanups.get(root)?.()
    cleanups.delete(root)
  },
}
