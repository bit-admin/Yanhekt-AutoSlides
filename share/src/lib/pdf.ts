import { jsPDF } from 'jspdf';
import { safeName } from './files';

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // The coss CDN reflects any Origin (ACAO), so anonymous CORS lets us draw to
    // a canvas without tainting it — required for jsPDF's PNG export.
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });
}

async function toPng(url: string): Promise<{ dataUrl: string; w: number; h: number }> {
  const img = await loadImage(url);
  const w = img.naturalWidth || 1;
  const h = img.naturalHeight || 1;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  ctx.drawImage(img, 0, 0);
  return { dataUrl: canvas.toDataURL('image/png'), w, h };
}

/**
 * Render the resolved images into a single PDF, one slide per page sized to the
 * image. Unresolved images are skipped.
 */
export async function saveAsPdf(urls: (string | null)[], title: string): Promise<void> {
  const present = urls.filter((u): u is string => !!u);
  if (present.length === 0) return;

  let pdf: jsPDF | null = null;
  for (const url of present) {
    let page;
    try {
      page = await toPng(url);
    } catch {
      continue;
    }
    const orientation = page.w >= page.h ? 'landscape' : 'portrait';
    if (!pdf) {
      pdf = new jsPDF({ unit: 'px', format: [page.w, page.h], orientation, compress: true });
    } else {
      pdf.addPage([page.w, page.h], orientation);
    }
    pdf.addImage(page.dataUrl, 'PNG', 0, 0, page.w, page.h);
  }

  if (pdf) pdf.save(`${safeName(title)}.pdf`);
}
