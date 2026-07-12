// Ported from autoslides/src/shared/sanitizeFileName.ts (unchanged).
// Canonical sanitizer used for slide folder names — must stay identical to the
// desktop app so folder naming matches across both clients.
export function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .trim();
}
