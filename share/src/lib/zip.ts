import JSZip from 'jszip';
import { safeName, triggerDownload, urlExt } from './files';

/**
 * Fetch every resolved image and bundle them into a zip of ordered
 * `Slide_NNN.<ext>` files. Unresolved images are skipped.
 * When `timelineJson` is set, also writes `timeline.json` next to the slides.
 */
export async function downloadAllZip(
  urls: (string | null)[],
  title: string,
  timelineJson?: string | null,
): Promise<void> {
  const present = urls.filter((u): u is string => !!u);
  if (present.length === 0) return;

  const zip = new JSZip();
  const width = Math.max(3, String(present.length).length);

  let n = 0;
  for (const url of present) {
    n += 1;
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) continue;
    const blob = await res.blob();
    zip.file(`Slide_${String(n).padStart(width, '0')}.${urlExt(url)}`, blob);
  }
  if (timelineJson) zip.file('timeline.json', timelineJson);

  const out = await zip.generateAsync({ type: 'blob' });
  triggerDownload(out, `${safeName(title)}.zip`);
}
