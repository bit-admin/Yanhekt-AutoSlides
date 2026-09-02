/**
 * Editor.js injects `.codex-editor ::selection { background-color: #d4ecff }`
 * at runtime. Electron/Chromium honors that rule for the highlight fill and
 * ignores later app CSS `background` on ::selection (color still applies),
 * which is why Drive looked ice-blue in dark mode. Rewrite the injected
 * stylesheet and pin a higher-specificity override after every mount.
 */

import { onColorSchemeChange, themeToken } from '@shared/utils/prefersDark'

const STYLE_ID = 'autoslides-editor-selection'
const EDITORJS_INLINE = '#d4ecff'
const EDITORJS_BLOCK = '#e1f2ff'

// Colors come from theme.css tokens (light + dark defined there); this module
// only turns them into the literals Chromium requires inside ::selection.
function colors(): { inline: string; block: string; fg: string } {
  const bg = themeToken('--editor-selection-bg') || '#b5d4f5'
  const fg = themeToken('--editor-selection-fg') || '#1a1a1a'
  return { inline: bg, block: bg, fg }
}

function rewriteSheet(sheet: CSSStyleSheet, inline: string, block: string): void {
  const walk = (rules: CSSRuleList): void => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSMediaRule) {
        walk(rule.cssRules)
        continue
      }
      if (!(rule instanceof CSSStyleRule)) continue
      const sel = rule.selectorText ?? ''
      if (sel.includes('::selection') || sel.includes('::-moz-selection')) {
        rule.style.setProperty('background-color', inline, 'important')
        rule.style.setProperty('background', inline, 'important')
        rule.style.setProperty('color', colors().fg, 'important')
      }
      if (sel.includes('ce-block--selected')) {
        rule.style.setProperty('background', block, 'important')
        rule.style.setProperty('background-color', block, 'important')
      }
    }
  }
  walk(sheet.cssRules)
}

const styleOriginals = new WeakMap<HTMLStyleElement, string>()

function rewriteStyleTags(inline: string, block: string): void {
  for (const el of Array.from(document.querySelectorAll('style'))) {
    if (el.id === STYLE_ID) continue
    let original = styleOriginals.get(el)
    if (!original) {
      const css = el.textContent ?? ''
      if (!css.includes(EDITORJS_INLINE) && !css.includes(EDITORJS_BLOCK)) continue
      styleOriginals.set(el, css)
      original = css
    }
    el.textContent = original
      .split(EDITORJS_INLINE).join(inline)
      .split(EDITORJS_BLOCK).join(block)
  }
}

function pinOverride(inline: string, fg: string, block: string): void {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = STYLE_ID
  }
  // Re-append so this sheet is last, after Editor.js's runtime inject.
  document.head.appendChild(el)
  el.textContent = `
.codex-editor {
  --inlineSelectionColor: ${inline};
  --selectionColor: ${block};
}
.codex-editor .ce-paragraph::selection,
.codex-editor .ce-paragraph *::selection,
.codex-editor .ce-header::selection,
.codex-editor .ce-header *::selection,
.codex-editor .cdx-block::selection,
.codex-editor .cdx-block *::selection,
.codex-editor [contenteditable]::selection,
.codex-editor [contenteditable] *::selection {
  background: ${inline} !important;
  background-color: ${inline} !important;
  color: ${fg} !important;
  -webkit-text-fill-color: ${fg} !important;
}
.codex-editor .ce-block--selected .ce-block__content {
  background: ${block} !important;
}
`
}

let listening = false

export function syncEditorJsSelectionStyles(): void {
  const { inline, block, fg } = colors()
  rewriteStyleTags(inline, block)
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      rewriteSheet(sheet, inline, block)
    } catch {
      // cross-origin or unreadable
    }
  }
  pinOverride(inline, fg, block)

  if (!listening) {
    listening = true
    onColorSchemeChange(syncEditorJsSelectionStyles)
  }
}
