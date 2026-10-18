import { watch, type Ref } from 'vue'

/**
 * Keep a Settings field's buffered value in step with the stored setting when
 * it changes outside the page (`autoslides config <key> <value>`), unless the
 * field was edited here. Without it, Save would write the page's old copy back
 * over the outside change. The page re-seeds every buffer when it opens, so
 * this only matters while it is open.
 */
export function followOutsideChange<T>(stored: () => T | undefined, temp: Ref<T>): void {
  watch(stored, (next, previous) => {
    if (next !== undefined && temp.value === previous) temp.value = next
  })
}
