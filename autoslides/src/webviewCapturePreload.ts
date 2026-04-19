/**
 * Guest preload for the Web Capture add-on.
 * Loaded into every page rendered inside the Add-ons "Web Capture" <webview>.
 *
 * Host -> Guest (via webview.send):
 *   capture:start  { selector?, downsampleW, downsampleH }
 *   capture:tick
 *   capture:stop
 *   picker:start | picker:cancel
 *   blocker:start | blocker:cancel | blocker:clear
 *   detect:video
 *
 * Guest -> Host (via ipcRenderer.sendToHost):
 *   video:detected { selector, width, height, rect }
 *   video:none
 *   frame          { width, height, buffer }
 *   capture:tainted
 *   capture:noVideo
 *   picker:result  { selector }
 *   picker:cancel
 *   blocker:result { selector }
 *   blocker:cancel
 */

import { ipcRenderer } from 'electron';

type CaptureConfig = {
  selector?: string;
  downsampleW: number;
  downsampleH: number;
};

type PickerMode = 'pick' | 'block' | null;

const state: {
  captureActive: boolean;
  captureConfig: CaptureConfig | null;
  captureCanvas: HTMLCanvasElement | null;
  captureCtx: CanvasRenderingContext2D | null;
  pickerMode: PickerMode;
  pickerOverlay: HTMLDivElement | null;
  pickerHighlight: HTMLDivElement | null;
  injectedStyles: HTMLStyleElement[];
  detectedSelector: string | null;
  mutationObserver: MutationObserver | null;
} = {
  captureActive: false,
  captureConfig: null,
  captureCanvas: null,
  captureCtx: null,
  pickerMode: null,
  pickerOverlay: null,
  pickerHighlight: null,
  injectedStyles: [],
  detectedSelector: null,
  mutationObserver: null,
};

function isHtmlElement(node: unknown): node is HTMLElement {
  return !!node && typeof node === 'object' && (node as Node).nodeType === 1;
}

function escapeSelectorPart(value: string): string {
  if (typeof (window as unknown as { CSS?: { escape?: (s: string) => string } }).CSS?.escape === 'function') {
    return (window as unknown as { CSS: { escape: (s: string) => string } }).CSS.escape(value);
  }
  return value.replace(/([^\w-])/g, '\\$1');
}

function buildSelector(el: Element): string {
  if (el.id) {
    const attempt = `#${escapeSelectorPart(el.id)}`;
    try {
      if (document.querySelectorAll(attempt).length === 1) return attempt;
    } catch {
      // fall through
    }
  }
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node.nodeType === 1 && node !== document.documentElement) {
    let part = node.tagName.toLowerCase();
    if (node.id) {
      part += `#${escapeSelectorPart(node.id)}`;
      parts.unshift(part);
      break;
    }
    const classList = Array.from(node.classList).filter(c => !!c).slice(0, 2);
    if (classList.length > 0) {
      part += classList.map(c => `.${escapeSelectorPart(c)}`).join('');
    }
    const parent = node.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(c => c.tagName === node!.tagName);
      if (siblings.length > 1) {
        const index = siblings.indexOf(node) + 1;
        part += `:nth-of-type(${index})`;
      }
    }
    parts.unshift(part);
    node = node.parentElement;
    if (parts.length > 8) break;
  }
  return parts.join(' > ');
}

function findBestVideo(): HTMLVideoElement | null {
  const candidates = Array.from(document.querySelectorAll('video')) as HTMLVideoElement[];
  let best: HTMLVideoElement | null = null;
  let bestArea = 0;
  for (const v of candidates) {
    const w = v.videoWidth || v.clientWidth;
    const h = v.videoHeight || v.clientHeight;
    const area = w * h;
    if (area < 10_000) continue;
    if (area > bestArea) {
      bestArea = area;
      best = v;
    }
  }
  return best;
}

function reportDetectedVideo(): void {
  const v = findBestVideo();
  if (!v) {
    state.detectedSelector = null;
    ipcRenderer.sendToHost('video:none');
    return;
  }
  const selector = buildSelector(v);
  state.detectedSelector = selector;
  const rect = v.getBoundingClientRect();
  ipcRenderer.sendToHost('video:detected', {
    selector,
    width: v.videoWidth,
    height: v.videoHeight,
    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
  });
}

function resolveCaptureVideo(): HTMLVideoElement | null {
  const sel = state.captureConfig?.selector || state.detectedSelector;
  if (sel) {
    try {
      const el = document.querySelector(sel);
      if (el instanceof HTMLVideoElement) return el;
    } catch {
      // fall through to best match
    }
  }
  return findBestVideo();
}

function captureTick(): void {
  if (!state.captureActive || !state.captureConfig) return;
  const video = resolveCaptureVideo();
  if (!video) {
    ipcRenderer.sendToHost('capture:noVideo');
    return;
  }
  if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
    return;
  }
  const targetW = Math.max(1, state.captureConfig.downsampleW || video.videoWidth);
  const targetH = Math.max(1, state.captureConfig.downsampleH || video.videoHeight);
  let canvas = state.captureCanvas;
  if (!canvas || canvas.width !== targetW || canvas.height !== targetH) {
    canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    state.captureCanvas = canvas;
    state.captureCtx = canvas.getContext('2d', { willReadFrequently: true });
  }
  const ctx = state.captureCtx;
  if (!ctx) return;
  try {
    ctx.drawImage(video, 0, 0, targetW, targetH);
    const imageData = ctx.getImageData(0, 0, targetW, targetH);
    ipcRenderer.sendToHost('frame', {
      width: imageData.width,
      height: imageData.height,
      buffer: imageData.data.buffer,
    });
  } catch (err) {
    const name = (err as { name?: string })?.name;
    if (name === 'SecurityError') {
      ipcRenderer.sendToHost('capture:tainted');
      state.captureActive = false;
      return;
    }
    // Other errors: swallow; host may try again on next tick
  }
}

// ---- Picker / blocker ----

function ensurePickerHighlight(): HTMLDivElement {
  if (state.pickerHighlight && document.documentElement.contains(state.pickerHighlight)) {
    return state.pickerHighlight;
  }
  const div = document.createElement('div');
  div.style.cssText = [
    'position:fixed',
    'pointer-events:none',
    'z-index:2147483646',
    'border:2px solid #ff3b30',
    'background:rgba(255,59,48,0.15)',
    'box-sizing:border-box',
    'transition:all 60ms linear',
    'display:none',
  ].join(';');
  document.documentElement.appendChild(div);
  state.pickerHighlight = div;
  return div;
}

function positionHighlight(rect: DOMRect | { left: number; top: number; width: number; height: number }): void {
  const div = ensurePickerHighlight();
  div.style.left = `${rect.left}px`;
  div.style.top = `${rect.top}px`;
  div.style.width = `${rect.width}px`;
  div.style.height = `${rect.height}px`;
  div.style.display = 'block';
}

function hideHighlight(): void {
  if (state.pickerHighlight) state.pickerHighlight.style.display = 'none';
}

function findPickTarget(x: number, y: number): HTMLElement | null {
  // Hide our highlight so it doesn't become the target
  const hl = state.pickerHighlight;
  const prevDisplay = hl?.style.display;
  if (hl) hl.style.display = 'none';
  const el = document.elementFromPoint(x, y);
  if (hl && prevDisplay) hl.style.display = prevDisplay;
  return isHtmlElement(el) ? el : null;
}

function onPickerMove(e: MouseEvent): void {
  if (!state.pickerMode) return;
  const target = findPickTarget(e.clientX, e.clientY);
  if (!target) {
    hideHighlight();
    return;
  }
  const rect = target.getBoundingClientRect();
  positionHighlight(rect);
}

function onPickerClick(e: MouseEvent): void {
  if (!state.pickerMode) return;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  const target = findPickTarget(e.clientX, e.clientY);
  if (!target) return;
  const selector = buildSelector(target);
  const mode = state.pickerMode;
  stopPicker();
  if (mode === 'pick') {
    ipcRenderer.sendToHost('picker:result', { selector });
  } else {
    injectBlockStyle(selector);
    ipcRenderer.sendToHost('blocker:result', { selector });
  }
}

function onPickerKey(e: KeyboardEvent): void {
  if (!state.pickerMode) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    const mode = state.pickerMode;
    stopPicker();
    ipcRenderer.sendToHost(mode === 'pick' ? 'picker:cancel' : 'blocker:cancel');
  }
}

function startPicker(mode: 'pick' | 'block'): void {
  if (state.pickerMode) stopPicker();
  state.pickerMode = mode;
  ensurePickerHighlight();
  document.addEventListener('mousemove', onPickerMove, true);
  document.addEventListener('click', onPickerClick, true);
  document.addEventListener('keydown', onPickerKey, true);
  document.documentElement.style.cursor = 'crosshair';
}

function stopPicker(): void {
  state.pickerMode = null;
  document.removeEventListener('mousemove', onPickerMove, true);
  document.removeEventListener('click', onPickerClick, true);
  document.removeEventListener('keydown', onPickerKey, true);
  document.documentElement.style.cursor = '';
  hideHighlight();
}

function injectBlockStyle(selector: string): void {
  const style = document.createElement('style');
  style.setAttribute('data-autoslides-block', '1');
  style.textContent = `${selector} { display: none !important; }`;
  document.head?.appendChild(style);
  state.injectedStyles.push(style);
}

function clearInjectedBlocks(): void {
  for (const s of state.injectedStyles) {
    s.remove();
  }
  state.injectedStyles = [];
}

// ---- Startup + IPC routing ----

function startVideoObserver(): void {
  if (state.mutationObserver) return;
  const obs = new MutationObserver(() => {
    // Only update if detection result would change
    const v = findBestVideo();
    const selector = v ? buildSelector(v) : null;
    if (selector !== state.detectedSelector) {
      reportDetectedVideo();
    }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
  state.mutationObserver = obs;
}

function onDomReady(): void {
  reportDetectedVideo();
  startVideoObserver();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', onDomReady, { once: true });
} else {
  onDomReady();
}

ipcRenderer.on('capture:start', (_event, config: CaptureConfig) => {
  state.captureConfig = {
    selector: config?.selector,
    downsampleW: Number(config?.downsampleW) || 480,
    downsampleH: Number(config?.downsampleH) || 270,
  };
  state.captureActive = true;
});

ipcRenderer.on('capture:tick', () => {
  captureTick();
});

ipcRenderer.on('capture:stop', () => {
  state.captureActive = false;
  state.captureConfig = null;
  state.captureCanvas = null;
  state.captureCtx = null;
});

ipcRenderer.on('picker:start', () => startPicker('pick'));
ipcRenderer.on('picker:cancel', () => {
  const wasActive = state.pickerMode === 'pick';
  stopPicker();
  if (wasActive) ipcRenderer.sendToHost('picker:cancel');
});

ipcRenderer.on('blocker:start', () => startPicker('block'));
ipcRenderer.on('blocker:cancel', () => {
  const wasActive = state.pickerMode === 'block';
  stopPicker();
  if (wasActive) ipcRenderer.sendToHost('blocker:cancel');
});
ipcRenderer.on('blocker:clear', () => {
  clearInjectedBlocks();
});

ipcRenderer.on('detect:video', () => reportDetectedVideo());
