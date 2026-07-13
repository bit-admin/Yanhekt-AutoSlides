import { nextTick, onActivated, onDeactivated, type Ref } from "vue";

// KeepAlive detaches the DOM on deactivation, which resets every inner
// scroller. Pages cached in MainContent's KeepAlive register their scroll
// container(s) here to restore position on return (the pre-router CSS-hidden
// containers kept scroll implicitly). Works in nested children too —
// activated/deactivated hooks propagate through the kept-alive subtree.
export function useKeepScroll(...elements: Ref<HTMLElement | null>[]) {
  const saved = new Array<number>(elements.length).fill(0);

  onDeactivated(() => {
    elements.forEach((el, i) => {
      saved[i] = el.value?.scrollTop ?? 0;
    });
  });

  onActivated(() => {
    void nextTick(() => {
      elements.forEach((el, i) => {
        if (el.value) el.value.scrollTop = saved[i];
      });
    });
  });
}
