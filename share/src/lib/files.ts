/** Filename-safe version of a note title for download artifacts. */
export function safeName(title: string): string {
  const cleaned = title.replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, ' ').trim();
  return cleaned || 'AutoSlides';
}

/** Trigger a browser download of a Blob. */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Extension of a CDN image URL (defaults to png). */
export function urlExt(url: string): string {
  const base = url.split('/').pop() ?? '';
  const ext = base.split('.').pop()?.split(/[?#]/)[0];
  return ext && ext.length <= 5 ? ext : 'png';
}
