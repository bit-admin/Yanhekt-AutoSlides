/**
 * Demo install order. Run from `indexMain.tsx` / `viewerMain.tsx` BEFORE the
 * real entry is imported, so nothing has had a chance to fetch yet.
 *
 * Dependency direction is one way: this folder imports the app, never the other
 * way round. Deleting `demo/` and the two demo Vite configs leaves the real site
 * untouched.
 */

import { demoHooks } from '../src/lib/demoRegistry';
import { shareImageRefs, type SharePayload } from '../../autoslides/src/shared/shareLink';
import type { ResolvedShareImage } from '../../autoslides/src/shared/shareResolve';
import { fragmentFor } from './demoData';
import { slideImages } from './slides';
import { installTransport } from './transport';

declare global {
  interface Window {
    /** Screenshot escape hatch: hide the demo pill before a capture. */
    __demoChrome?: (visible: boolean) => void;
  }
}

/** The viewer lives one level under the index's base: `/demo/` → `/demo/v1/`. */
function viewerBase(): string {
  const base = import.meta.env.BASE_URL;
  return base.endsWith('/v1/') ? base : `${base}v1/`;
}

/** The real page this demo stands in for: `/demo/` → `/`, `/demo/v1/` → `/v1/`. */
function realBase(): string {
  return import.meta.env.BASE_URL.replace(/^\/demo/, '') || '/';
}

async function resolveImages(payload: SharePayload): Promise<ResolvedShareImage[]> {
  const images = await slideImages();
  return shareImageRefs(payload).map((ref) => ({
    index: ref.index,
    prefix: ref.prefix,
    short: ref.short,
    url: images[ref.index % images.length],
  }));
}

function installBanner(): void {
  const zh = navigator.language.toLowerCase().startsWith('zh');

  const pill = document.createElement('a');
  pill.id = 'demo-banner';
  pill.href = realBase();
  pill.append(zh ? '演示模式 · 数据均为虚构' : 'Demo mode · everything here is fictional');

  const exit = document.createElement('span');
  exit.textContent = zh ? '返回正式站' : 'Back to the site';
  exit.style.cssText = 'margin-left:10px;padding-left:10px;border-left:1px solid rgba(251,250,248,.28)';
  pill.appendChild(exit);

  pill.style.cssText = [
    'position:fixed',
    'left:50%',
    'bottom:16px',
    'transform:translateX(-50%)',
    'z-index:10001',
    'display:flex',
    'align-items:center',
    'padding:6px 14px',
    'border-radius:999px',
    "font:500 12px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC',sans-serif",
    'color:#fbfaf8',
    'background:rgba(21,20,18,.86)',
    'box-shadow:0 2px 10px rgba(0,0,0,.18)',
    'text-decoration:none',
    'white-space:nowrap',
    'user-select:none',
  ].join(';');
  document.body.appendChild(pill);

  // The screenshot script hides the pill (the README says it once, in prose).
  window.__demoChrome = (visible: boolean) => {
    pill.style.display = visible ? '' : 'none';
  };
}

export async function installDemo(): Promise<void> {
  // Statically imported on purpose. A dynamic import would put the transport in
  // its own chunk, which imports demoData back out of the entry chunk — and the
  // entry is suspended on the top-level await below, so that import would never
  // resolve and the page would hang with no error.
  installTransport();

  demoHooks.viewerHref = (shareId) => `${viewerBase()}#${fragmentFor(shareId)}`;
  demoHooks.resolveImages = resolveImages;

  // Rasterizing the deck once up front keeps the first paint of a share page
  // from flashing empty figures.
  await slideImages();

  if (document.body) installBanner();
  else document.addEventListener('DOMContentLoaded', installBanner, { once: true });
}
